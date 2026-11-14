// Ground & data layer renderer seam. OWNER: Person 2 (ground & data layers). Globe.tsx only creates, updates, destroys it.
// Rules: animated layers must be GPU materials with a time uniform (GroundPrimitive + a custom Fabric Material),
// never per-frame canvas re-uploads. On the Google surface they are masked with `overlayMask` (building footprints)
// so water/frost does not paint roofs. Layers draw inside `simBbox` only. `active` true only while a layer animates.
//
// Procedural kinds: ONE GroundPrimitive (simBbox, mask rings as holes) + ONE uber Material (material.ts). Per frame
// only uniforms change. spec.overlay (backend raster) replaces the procedural look of that layer and goes through
// twin.ts createOverlayLayer. nasaImagery: GIBS WMTS (gibs.ts), see syncImagery.
import {
  Cartesian2,
  Cartesian3,
  ClassificationType,
  Color,
  Credit,
  EllipsoidSurfaceAppearance,
  GeometryInstance,
  GroundPrimitive,
  ImageryLayer,
  Material,
  PolygonGeometry,
  PolygonHierarchy,
  PrimitiveCollection,
  Rectangle,
  RectangleGeometry,
  SceneTransforms,
  WebMapTileServiceImageryProvider,
  type Cartesian4,
  type Viewer,
} from "cesium";

import type { CropLook, DetailLevel, FarmField, FarmSurface, GroundLayerSpec, GroundOverlay } from "@/components/globe/types";

import { createOverlayLayer, fieldsBbox } from "../twin";
import { setAnchor } from "./anchor";
import { bakeCoverage, bboxSizeM, flatHeightCanvas, heightCanvas, sampleHeights } from "./bake";
import { buildGibsTemplate, fetchGibsCapabilities, GIBS_BASE } from "./gibs";
import { type Bbox, bakeKey, clipRingToBbox, ringsInBbox } from "./geometry";
import { createGroundMaterial, FIELD_UNIFORM_NAMES } from "./material";
import { FIELD_KINDS, layersToUniforms, PROCEDURAL_KINDS, type GroundUniforms } from "./uniforms";

export interface GroundContext {
  detail: DetailLevel;
  reducedMotion: boolean;
  /** Seconds since the previous update (capped at 0.1). */
  dtS: number;
  /** Monotonic clock, seconds. */
  nowS: number;
  surface: FarmSurface;
  fields: FarmField[];
  simBbox?: [number, number, number, number];
  overlayMask?: [number, number][][];
  cropByField?: Record<string, CropLook>;
}

export interface GroundRenderer {
  update(layers: GroundLayerSpec[], ctx: GroundContext): void;
  /** True while something animates (Globe keeps requesting frames). */
  readonly active: boolean;
  destroy(): void;
}

const cls = (s: FarmSurface) => (s === "google" ? ClassificationType.BOTH : ClassificationType.TERRAIN);
/** Outer ring is the sim box padded by this fraction per side; the shader cuts the pad off (see material.ts). */
const PAD = 0.01;
const MAX_HOLES = 500;
/** Google surface: the globe is hidden, so GIBS tiles are composited into a canvas draped over a square this wide. */
const IMAGERY_SQUARE_M = 20_000;
const IMAGERY_MAX_TILES = 6;
const IMAGERY_PX = 256;

type Procedural = {
  key: string;
  bbox: Bbox;
  primitive: GroundPrimitive;
  material: Material;
  sig: string;
  lastTime: number;
};

type ImageryState = {
  key: string;
  layer?: ImageryLayer;
  primitive?: GroundPrimitive;
  material?: Material;
  credit?: Credit;
  opacity: number;
};

const v4 = (m: Material, name: string) => m.uniforms[name] as Cartesian4;

function setV4(c: Cartesian4, x: number, y = 0, z = 0, w = 0) {
  c.x = x;
  c.y = y;
  c.z = z;
  c.w = w;
}

/** Write per-frame values into the material uniforms (in place). Returns a signature of the non-time values. */
function applyUniforms(m: Material, u: GroundUniforms): string {
  const U = m.uniforms;
  U.uMotion = u.motion;
  U.uDetail = u.detail;
  PROCEDURAL_KINDS.forEach((k, i) => {
    const q = u.kinds[k];
    setV4(v4(m, `uK${i}`), q ? q.intensity : 0, q ? q.opacity : 0, q?.p1 ?? 0, q?.p2 ?? 0);
  });
  for (const k of FIELD_KINDS) {
    const f = u.fields[k];
    const n = FIELD_UNIFORM_NAMES[k];
    setV4(v4(m, `${n}0`), f[0], f[1], f[2], f[3]);
    setV4(v4(m, `${n}1`), f[4], f[5], f[6], f[7]);
  }
  setV4(v4(m, "uCi0"), u.crops[0], u.crops[1], u.crops[2], u.crops[3]);
  setV4(v4(m, "uCi1"), u.crops[4], u.crops[5], u.crops[6], u.crops[7]);
  return JSON.stringify([u.kinds, u.fields, u.crops, u.detail, u.motion]);
}

export function createGroundRenderer(viewer: Viewer): GroundRenderer {
  const scene = viewer.scene;
  const root = scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection;
  const proceduralCol = root.add(new PrimitiveCollection()) as PrimitiveCollection;
  const overlayCol = root.add(new PrimitiveCollection()) as PrimitiveCollection;
  const imageryCol = root.add(new PrimitiveCollection()) as PrimitiveCollection;
  const overlays = createOverlayLayer(overlayCol);

  let proc: Procedural | null = null;
  let img: ImageryState | null = null;
  let imgToken = 0;
  let hadOverlays = false;
  let active = false;
  let destroyed = false;
  const warned = new Set<string>();
  const warnOnce = (key: string, msg: string) => {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(msg);
  };

  // ---- procedural primitive ----------------------------------------------------------------------------
  function buildProcedural(bbox: Bbox, ctx: GroundContext, key: string) {
    const [w, s, e, n] = bbox;
    const dw = (e - w) * PAD, dh = (n - s) * PAD;
    const outer = Cartesian3.fromDegreesArray([w - dw, s - dh, e + dw, s - dh, e + dw, n + dh, w - dw, n + dh]);
    const inner: Bbox = [w, s, e, n];
    const holes = ringsInBbox(ctx.overlayMask ?? [], inner)
      .slice(0, MAX_HOLES)
      .map((r) => clipRingToBbox(r, inner))
      .filter((r) => r.length >= 3)
      .map((r) => new PolygonHierarchy(Cartesian3.fromDegreesArray(r.flat())));
    const fields = ctx.fields.slice(0, 8);
    const material = createGroundMaterial({ cov: bakeCoverage(fields, bbox), height: flatHeightCanvas() });
    const [wm, hm] = bboxSizeM(bbox);
    setV4(material.uniforms.uSize as Cartesian4, wm, hm, fields.length ? 1 : 0, 0);
    const primitive = new GroundPrimitive({
      geometryInstances: new GeometryInstance({
        geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(outer, holes), vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT }),
      }),
      appearance: new EllipsoidSurfaceAppearance({ material, flat: true }),
      classificationType: cls(ctx.surface),
      allowPicking: false,
      show: false,
    });
    proceduralCol.add(primitive);
    proc = { key, bbox, primitive, material, sig: "", lastTime: NaN };
    void sampleHeights(bbox).then((h) => {
      if (h && proc?.key === key && !destroyed) {
        proc.material.uniforms.uHeight = heightCanvas(h); // new canvas object -> one re-upload
        scene.requestRender();
      }
    });
  }

  function dropProcedural() {
    if (proc) proceduralCol.remove(proc.primitive);
    proc = null;
  }

  // ---- NASA GIBS imagery -------------------------------------------------------------------------------
  function dropImagery() {
    imgToken++;
    if (!img) return;
    if (img.layer) viewer.imageryLayers.remove(img.layer, true);
    if (img.primitive) imageryCol.remove(img.primitive);
    if (img.credit) viewer.creditDisplay.removeStaticCredit(img.credit);
    img = null;
  }

  function startImagery(spec: GroundLayerSpec, key: string, surface: FarmSurface, centre: [number, number]) {
    const im = spec.imagery!;
    const token = ++imgToken;
    const state: ImageryState = { key, opacity: Math.min(1, Math.max(0, spec.opacity)) };
    img = state;
    fetchGibsCapabilities()
      .then(async (layers) => {
        if (token !== imgToken || destroyed) return;
        const l = layers.find((x) => x.id === im.layerId);
        const tms = l?.tileMatrixSets[0];
        const format = l?.formats[0];
        if (!l || !tms || !format) {
          warnOnce(key, `[ground] GIBS layer "${im.layerId}" not found in capabilities (or has no tile matrix set/format); drawing nothing.`);
          return;
        }
        const credit = new Credit(im.credit, true);
        const provider = new WebMapTileServiceImageryProvider({
          url: buildGibsTemplate({ base: GIBS_BASE, layerId: l.id, tileMatrixSet: tms, format, date: im.date }),
          layer: l.id,
          style: "default",
          format,
          tileMatrixSetID: tms,
          maximumLevel: l.maxLevels[tms],
          credit,
        });
        if (surface === "terrain") {
          state.layer = viewer.imageryLayers.addImageryProvider(provider);
          state.layer.alpha = state.opacity;
          scene.requestRender();
          return;
        }
        // Google surface: globe hidden -> composite covering tiles into a canvas and drape it with a GroundPrimitive.
        const half = IMAGERY_SQUARE_M / 2;
        const dLat = half / 111_320;
        const dLon = half / (111_320 * Math.cos((centre[1] * Math.PI) / 180));
        const rect = Rectangle.fromDegrees(centre[0] - dLon, centre[1] - dLat, centre[0] + dLon, centre[1] + dLat);
        const canvas = await compositeTiles(provider, rect, l.maxLevels[tms]);
        if (token !== imgToken || destroyed || !canvas) return;
        const material = createImageryMaterial(canvas, state.opacity);
        state.material = material;
        state.primitive = imageryCol.add(
          new GroundPrimitive({
            geometryInstances: new GeometryInstance({ geometry: new RectangleGeometry({ rectangle: rect, vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT }) }),
            appearance: new EllipsoidSurfaceAppearance({ material, flat: true }),
            classificationType: ClassificationType.BOTH,
            allowPicking: false,
          }),
        );
        viewer.creditDisplay.addStaticCredit(credit);
        state.credit = credit;
        scene.requestRender();
      })
      .catch(() => {
        if (token === imgToken && !destroyed) warnOnce(key, "[ground] GIBS imagery failed; drawing nothing.");
      });
  }

  function syncImagery(layers: GroundLayerSpec[], ctx: GroundContext, bbox: Bbox | undefined) {
    const spec = layers.find((l) => l.kind === "nasaImagery" && l.imagery);
    if (!spec || !bbox) {
      if (img) dropImagery();
      setAnchor(null);
      return;
    }
    const im = spec.imagery!;
    const key = JSON.stringify([im.layerId, im.date, ctx.surface, ctx.surface === "google" ? bbox : null]);
    const centre: [number, number] = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    if (img?.key !== key) {
      dropImagery();
      startImagery(spec, key, ctx.surface, centre);
    } else {
      const a = Math.min(1, Math.max(0, spec.opacity));
      img.opacity = a;
      if (img.layer && img.layer.alpha !== a) { img.layer.alpha = a; scene.requestRender(); }
      if (img.material && img.material.uniforms.color.alpha !== a) { setImageryOpacity(img.material, a); scene.requestRender(); }
    }
    // Anchor for the UI panel: a point ~150 m above the square's centre, in canvas CSS pixels.
    const p = SceneTransforms.worldToWindowCoordinates(scene, Cartesian3.fromDegrees(centre[0], centre[1], 150), new Cartesian2());
    const c = scene.canvas;
    setAnchor(p ? { x: p.x, y: p.y, visible: p.x >= 0 && p.y >= 0 && p.x <= c.clientWidth && p.y <= c.clientHeight } : { x: 0, y: 0, visible: false });
  }

  return {
    get active() {
      return active;
    },
    update(layers, ctx) {
      if (destroyed) return;
      const bbox: Bbox | undefined = ctx.simBbox ?? (ctx.fields.length ? fieldsBbox(ctx.fields) : undefined);

      // procedural
      const u = layersToUniforms(
        layers,
        ctx.fields.map((f) => f.id),
        ctx.detail,
        ctx.reducedMotion,
        ctx.fields.map((f) => ctx.cropByField?.[f.id] ?? f.crop),
      );
      active = u.active;
      if (bbox && u.anyProcedural) {
        const key = bakeKey(bbox, ctx.surface, ctx.fields, ctx.overlayMask);
        if (proc?.key !== key) {
          dropProcedural();
          buildProcedural(bbox, ctx, key);
        }
      } else if (proc && (!bbox || !u.anyProcedural) && proc.primitive.show) {
        proc.primitive.show = false;
        scene.requestRender();
      }
      if (proc && bbox && u.anyProcedural) {
        const sig = applyUniforms(proc.material, u);
        const t = layers.find((l) => l.timeS !== undefined)?.timeS ?? ctx.nowS;
        const timeChanged = u.active && t !== proc.lastTime;
        if (timeChanged) proc.material.uniforms.uTime = t; // frozen while not animating
        if (timeChanged) proc.lastTime = t;
        if (sig !== proc.sig || !proc.primitive.show) {
          proc.sig = sig;
          scene.requestRender();
        }
        proc.primitive.show = true;
      }

      // backend rasters
      const rasters: GroundOverlay[] = layers.flatMap((l) => (l.overlay ? [{ ...l.overlay, opacity: l.overlay.opacity * Math.min(1, Math.max(0, l.opacity)) }] : []));
      if (rasters.length || hadOverlays) {
        if (overlays.sync(rasters, cls(ctx.surface), ctx.overlayMask)) scene.requestRender();
        hadOverlays = rasters.length > 0;
      }

      syncImagery(layers, ctx, bbox);
    },
    destroy() {
      destroyed = true;
      dropImagery();
      dropProcedural();
      setAnchor(null);
      if (!scene.isDestroyed()) scene.primitives.remove(root);
    },
  };
}

/** Composite the tiles covering `rect` at the finest level needing at most IMAGERY_MAX_TILES^2 tiles. */
export async function compositeTiles(provider: WebMapTileServiceImageryProvider, rect: Rectangle, maxLevel: number | undefined): Promise<HTMLCanvasElement | null> {
  const scheme = provider.tilingScheme;
  let level = Math.min(maxLevel ?? 18, 18);
  const range = (L: number) => {
    const nw = scheme.positionToTileXY(Rectangle.northwest(rect), L)!;
    const se = scheme.positionToTileXY(Rectangle.southeast(rect), L)!;
    return { x0: nw.x, y0: nw.y, x1: se.x, y1: se.y };
  };
  while (level > 0) {
    const r = range(level);
    if (r.x1 - r.x0 + 1 <= IMAGERY_MAX_TILES && r.y1 - r.y0 + 1 <= IMAGERY_MAX_TILES) break;
    level--;
  }
  const { x0, y0, x1, y1 } = range(level);
  const size = IMAGERY_PX * IMAGERY_MAX_TILES;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const px = (lon: number, lat: number): [number, number] => [((lon - rect.west) / rect.width) * size, ((rect.north - lat) / rect.height) * size];
  const jobs: Promise<void>[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      jobs.push(
        Promise.resolve(provider.requestImage(x, y, level))
          .then((image) => {
            if (!image) throw new Error("GIBS tile unavailable");
            const tr = scheme.tileXYToRectangle(x, y, level);
            const [ax, ay] = px(tr.west, tr.north);
            const [bx, by] = px(tr.east, tr.south);
            g.drawImage(image as CanvasImageSource, ax, ay, bx - ax, by - ay);
          }),
      );
  await Promise.all(jobs);
  return canvas;
}

/** Cesium Image fabric applies opacity through color alpha. */
export function createImageryMaterial(image: HTMLCanvasElement | string, opacity: number): Material {
  return Material.fromType("Image", { image, color: Color.WHITE.withAlpha(opacity) });
}

export function setImageryOpacity(material: Material, opacity: number): void {
  material.uniforms.color.alpha = opacity;
}
