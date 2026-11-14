// Farm twin layers on the Cesium scene: ground-clamped field polygons (illustrative crop looks, pickable)
// and generic ground overlays (any climate scenario renders into a canvas; re-uploaded only when its version changes).
// On Google's photoreal tiles everything classifies the tiles too (ClassificationType.BOTH): overlays are kept off
// roofs by cutting the overlayMask (building footprints) out of each canvas. Tree canopies have no mask and still get painted.
import "./base";
import {
  ClassificationType,
  Color,
  ColorGeometryInstanceAttribute,
  EllipsoidSurfaceAppearance,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  Material,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineColorAppearance,
  PrimitiveCollection,
  Rectangle,
  RectangleGeometry,
  Cartesian3,
} from "cesium";

import type { CropLook, FarmField, GroundOverlay } from "@/components/globe/types";

import { CROP_COLORS, CROP_WORDS } from "@/lib/twin/cropColors";

import { offsetM } from "./clamp";

// ---- Fields ----------------------------------------------------------------------------------------------

// Colour table lives in lib/twin/cropColors.ts (no cesium) so scenario legends use the same hexes as the map.
export { CROP_COLORS };
const FILL_ALPHA = 0.42;
const FILL_ALPHA_SELECTED = 0.68;
const OUTLINE = "#f4ecd2";
const OUTLINE_ALPHA = 0.7;
const OUTLINE_SELECTED = "#ffd54a";
/** Fills off (default, user choice: keep the real imagery visible): faint edges only on the selected / hovered field. */
const OUTLINE_ALPHA_SELECTED_FAINT = 0.75;
const OUTLINE_ALPHA_HOVER_FAINT = 0.3;
const OUTLINE_WIDTH_PX = 1.5;

export type FieldState = { selected?: boolean; hovered?: boolean; /** FarmTwinProps.showCropFills */ fills?: boolean };

/**
 * Pure: fill and outline CSS colour + alpha for a field. Without fills (default) the field is invisible (alpha 0,
 * still pickable) apart from a faint edge while selected or hovered; with fills, the illustrative crop colours.
 */
export function fieldStyle(look: CropLook, st: FieldState): { fill: string; fillAlpha: number; outline: string; outlineAlpha: number } {
  const fill = CROP_COLORS[look] ?? CROP_COLORS.bare;
  if (!st.fills)
    return { fill, fillAlpha: 0, outline: st.selected ? OUTLINE_SELECTED : OUTLINE, outlineAlpha: st.selected ? OUTLINE_ALPHA_SELECTED_FAINT : st.hovered ? OUTLINE_ALPHA_HOVER_FAINT : 0 };
  return {
    fill,
    fillAlpha: st.selected ? FILL_ALPHA_SELECTED : FILL_ALPHA,
    outline: st.selected ? OUTLINE_SELECTED : OUTLINE,
    outlineAlpha: st.selected ? 1 : OUTLINE_ALPHA,
  };
}

export { CROP_WORDS };

/** Pure: hover label text, e.g. "Centre field · Corn (illustrative)". */
export function fieldHoverText(f: Pick<FarmField, "id" | "name" | "crop">, cropByField?: Record<string, CropLook>): string {
  const look = cropByField?.[f.id] ?? f.crop;
  return `${f.name} · ${CROP_WORDS[look] ?? look} (illustrative)`;
}

/** Pure: mean of the ring's vertices (label anchor; inside for the convex-ish fields we draw). */
export function ringCentroid(ring: readonly [number, number][]): [number, number] {
  const n = ring.length || 1;
  return [ring.reduce((a, p) => a + p[0], 0) / n, ring.reduce((a, p) => a + p[1], 0) / n];
}

const FIELD_PREFIX = "field:";
/** Field id from a scene.pick() result, or null. */
export function fieldIdFromPick(picked: unknown): string | null {
  const id = (picked as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id.startsWith(FIELD_PREFIX) ? id.slice(FIELD_PREFIX.length) : null;
}

const colorValue = (css: string, alpha: number) => ColorGeometryInstanceAttribute.toValue(Color.fromCssColorString(css).withAlpha(alpha));

export type FieldLayer = {
  /** Rebuild the primitives (fields or classification changed). Async in Cesium: colours apply once ready. */
  setFields(fields: readonly FarmField[], classification: ClassificationType): void;
  /**
   * Recolour without rebuilding (crop override, selection, hover or fills changed). `fills` false (default, or
   * while the A/B split draws fills on canvases, see createFieldCanvas): the fill primitive is fully transparent
   * but stays pickable.
   */
  paint(cropByField: Record<string, CropLook> | undefined, selectedId: string | null | undefined, fills?: boolean, hoveredId?: string | null): void;
  /** Call every frame: applies a pending paint once the primitives are ready. Returns true if it painted. */
  flush(): boolean;
};

export function createFieldLayer(collection: PrimitiveCollection): FieldLayer {
  let fields: readonly FarmField[] = [];
  let fill: GroundPrimitive | undefined;
  let outline: GroundPolylinePrimitive | undefined;
  let look: { crop?: Record<string, CropLook>; selected?: string | null; fills?: boolean; hovered?: string | null } = {};
  let dirty = false;

  const styleOf = (f: FarmField) => fieldStyle(look.crop?.[f.id] ?? f.crop, { selected: f.id === look.selected, hovered: f.id === look.hovered, fills: look.fills });

  return {
    setFields(next, classification) {
      collection.removeAll();
      fill = outline = undefined;
      fields = next.filter((f) => f.ring.length >= 3);
      if (!fields.length) return;
      fill = collection.add(
        new GroundPrimitive({
          geometryInstances: fields.map((f) => {
            const s = styleOf(f);
            return new GeometryInstance({
              id: FIELD_PREFIX + f.id,
              geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(f.ring.flat())) }),
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(s.fill).withAlpha(s.fillAlpha)) },
            });
          }),
          appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
          classificationType: classification,
        }),
      ) as GroundPrimitive;
      outline = collection.add(
        new GroundPolylinePrimitive({
          geometryInstances: fields.map((f) => {
            const s = styleOf(f);
            const ring = [...f.ring, f.ring[0]];
            return new GeometryInstance({
              id: FIELD_PREFIX + f.id,
              geometry: new GroundPolylineGeometry({ positions: Cartesian3.fromDegreesArray(ring.flat()), width: OUTLINE_WIDTH_PX }),
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(s.outline).withAlpha(s.outlineAlpha)) },
            });
          }),
          appearance: new PolylineColorAppearance(),
          classificationType: classification,
        }),
      ) as GroundPolylinePrimitive;
      dirty = false; // built with the current look
    },
    paint(crop, selected, fills, hovered) {
      look = { crop, selected, fills, hovered };
      dirty = true;
    },
    flush() {
      if (!dirty || !fill || !outline || !fill.ready || !outline.ready) return false;
      dirty = false;
      for (const f of fields) {
        const s = styleOf(f);
        fill.getGeometryInstanceAttributes(FIELD_PREFIX + f.id).color = colorValue(s.fill, s.fillAlpha);
        outline.getGeometryInstanceAttributes(FIELD_PREFIX + f.id).color = colorValue(s.outline, s.outlineAlpha);
      }
      return true;
    },
  };
}

/** Pure: [west, south, east, north] around all field rings. */
export function fieldsBbox(fields: readonly FarmField[]): [number, number, number, number] {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of fields)
    for (const [lon, lat] of f.ring) {
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
  return [w, s, e, n];
}

/** Longest side of a field canvas, px, and the finest ground resolution it uses, px per metre. */
const FIELD_CANVAS_MAX_PX = 2048;
const FIELD_CANVAS_PX_PER_M = 2;

/**
 * Field fills rasterised into a GroundOverlay canvas, so they can be limited to one side of the A/B split
 * (classification fills with per-instance colours have no split test). Memoised on (fields, crop, selected):
 * a new overlay version only when one of them changes.
 */
export function createFieldCanvas(id: string) {
  const canvas = document.createElement("canvas");
  let key: unknown[] = [];
  let out: GroundOverlay | null = null;
  let version = 0;
  return (fields: readonly FarmField[], crop: Record<string, CropLook> | undefined, selected: string | null | undefined): GroundOverlay | null => {
    const k = [fields, crop, selected];
    if (k.every((v, i) => v === key[i])) return out;
    key = k;
    const list = fields.filter((f) => f.ring.length >= 3);
    if (!list.length) return (out = null);
    const bbox = fieldsBbox(list);
    const [w, s, e, n] = bbox;
    const wM = Math.abs(offsetM({ lon: e, lat: (s + n) / 2 }, { lon: w, lat: (s + n) / 2 }).x);
    const hM = Math.abs(offsetM({ lon: w, lat: n }, { lon: w, lat: s }).y);
    const pxPerM = Math.min(FIELD_CANVAS_PX_PER_M, FIELD_CANVAS_MAX_PX / Math.max(wM, hM, 1));
    const width = Math.max(1, Math.round(wM * pxPerM));
    const height = Math.max(1, Math.round(hM * pxPerM));
    if (canvas.width !== width || canvas.height !== height) Object.assign(canvas, { width, height });
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, width, height);
    for (const f of list) {
      const st = fieldStyle(crop?.[f.id] ?? f.crop, { selected: f.id === selected, fills: true });
      g.globalAlpha = st.fillAlpha;
      g.fillStyle = st.fill;
      g.beginPath();
      f.ring.forEach(([lon, lat], i) => {
        const [x, y] = lonLatToPx(bbox, width, height, lon, lat);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    return (out = { id, bbox, canvas, version: ++version, opacity: 1 });
  };
}

// ---- Overlays --------------------------------------------------------------------------------------------

type OverlayKey = Pick<GroundOverlay, "id" | "version" | "bbox">;

/**
 * Pure: what to do when the overlay list changes. Any change of order, ids, bbox or classification rebuilds
 * every primitive (draw order = list order); otherwise only overlays whose version changed get a new texture.
 */
export function planOverlays(prev: readonly OverlayKey[], next: readonly OverlayKey[], classificationChanged: boolean): { rebuild: boolean; upload: string[] } {
  const same =
    !classificationChanged &&
    prev.length === next.length &&
    prev.every((p, i) => p.id === next[i].id && p.bbox.every((v, k) => v === next[i].bbox[k]));
  if (!same) return { rebuild: true, upload: next.map((o) => o.id) };
  return { rebuild: false, upload: next.filter((o, i) => o.version !== prev[i].version).map((o) => o.id) };
}

// side: 0 = whole screen, -1 = left of the split divider only, 1 = right only. Same fragment test as C1's drape
// (czm_splitPosition is scene.splitPosition in drawing-buffer pixels).
const OVERLAY_MATERIAL_SOURCE = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec4 c = texture(image, materialInput.st);
  if ((side < 0.0 && gl_FragCoord.x > czm_splitPosition) || (side > 0.0 && gl_FragCoord.x < czm_splitPosition)) c.a = 0.0;
  material.diffuse = c.rgb;
  material.alpha = c.a * opacity;
  return material;
}`;

/** Which part of a split screen a layer draws on. */
export type SplitSide = "both" | "left" | "right";
/** Pure: shader value of a side. */
export const sideValue = (s: SplitSide) => (s === "left" ? -1 : s === "right" ? 1 : 0);

/** Pure: which side the A layers (left) and B layers (right) draw on, and the divider; B draws nothing without a split. */
export function splitSides(compare: { divider: number } | null | undefined): { a: SplitSide; b: SplitSide | null; divider: number } {
  if (!compare) return { a: "both", b: null, divider: 0.5 };
  return { a: "left", b: "right", divider: Math.min(1, Math.max(0, compare.divider)) };
}

/** Pure: [lon, lat] -> canvas pixel [x, y] for a north-up canvas of width x height covering bbox [w, s, e, n]. */
export function lonLatToPx(bbox: readonly [number, number, number, number], width: number, height: number, lon: number, lat: number): [number, number] {
  const [w, s, e, n] = bbox;
  return [((lon - w) / (e - w)) * width, ((n - lat) / (n - s)) * height];
}

/** Rings of [lon, lat] where overlays must not draw (FarmTwinProps.overlayMask). */
export type OverlayMask = readonly (readonly [number, number][])[];

/** Punch the mask polygons out of a canvas that covers bbox (destination-out). Rings outside the bbox are clipped away by the canvas. */
function punchMask(g: CanvasRenderingContext2D, bbox: readonly [number, number, number, number], mask: OverlayMask) {
  const { width, height } = g.canvas;
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "#000";
  g.beginPath();
  for (const ring of mask) {
    if (ring.length < 3) continue;
    ring.forEach(([lon, lat], i) => {
      const [x, y] = lonLatToPx(bbox, width, height, lon, lat);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.closePath();
  }
  g.fill("nonzero");
  g.restore();
}

type OverlaySlot = { material: Material; canvases: [HTMLCanvasElement, HTMLCanvasElement]; flip: number };

export type OverlayLayer = {
  /**
   * Cheap when nothing changed (safe to call every frame). Returns true if anything needs a re-render.
   * `mask` polygons are cut out of every overlay; a new mask (by reference) re-uploads every overlay.
   */
  sync(overlays: readonly GroundOverlay[], classification: ClassificationType, mask?: OverlayMask, side?: SplitSide): boolean;
};

export function createOverlayLayer(collection: PrimitiveCollection): OverlayLayer {
  let keys: OverlayKey[] = [];
  let cls: ClassificationType | undefined;
  let lastMask: OverlayMask | undefined;
  const slots = new Map<string, OverlaySlot>();

  // Material only re-uploads a texture when the uniform is a different object, so copy into two canvases
  // and alternate (same trick as drape.ts).
  const upload = (slot: OverlaySlot, src: HTMLCanvasElement, bbox: GroundOverlay["bbox"], mask: OverlayMask | undefined) => {
    slot.flip ^= 1;
    const dst = slot.canvases[slot.flip];
    if (dst.width !== src.width || dst.height !== src.height) Object.assign(dst, { width: src.width, height: src.height });
    const g = dst.getContext("2d")!;
    g.clearRect(0, 0, dst.width, dst.height);
    g.drawImage(src, 0, 0);
    if (mask?.length) punchMask(g, bbox, mask);
    slot.material.uniforms.image = dst;
  };

  return {
    sync(overlays, classification, maskIn, sideIn = "both") {
      const side = sideValue(sideIn);
      const mask = maskIn?.length ? maskIn : undefined; // an empty mask is a no-op (no re-uploads when [] is re-created)
      const plan = planOverlays(keys, overlays, classification !== cls);
      const maskChanged = mask !== lastMask;
      lastMask = mask;
      keys = overlays.map(({ id, version, bbox }) => ({ id, version, bbox }));
      cls = classification;
      if (plan.rebuild) {
        collection.removeAll();
        slots.clear();
        for (const o of overlays) {
          const canvases: [HTMLCanvasElement, HTMLCanvasElement] = [document.createElement("canvas"), document.createElement("canvas")];
          const material = new Material({
            translucent: true,
            fabric: { uniforms: { image: canvases[0], opacity: o.opacity, side }, source: OVERLAY_MATERIAL_SOURCE },
          });
          slots.set(o.id, { material, canvases, flip: 1 });
          collection.add(
            new GroundPrimitive({
              geometryInstances: new GeometryInstance({
                geometry: new RectangleGeometry({ rectangle: Rectangle.fromDegrees(...o.bbox), vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT }),
              }),
              appearance: new EllipsoidSurfaceAppearance({ material, flat: true }),
              classificationType: classification,
            }),
          );
        }
      }
      const toUpload = new Set(plan.upload);
      let changed = plan.rebuild;
      for (const o of overlays) {
        const slot = slots.get(o.id)!;
        const opacity = Math.min(1, Math.max(0, o.opacity));
        if (slot.material.uniforms.opacity !== opacity || slot.material.uniforms.side !== side) {
          slot.material.uniforms.opacity = opacity;
          slot.material.uniforms.side = side;
          changed = true;
        }
        if (maskChanged || toUpload.has(o.id)) {
          upload(slot, o.canvas, o.bbox, mask);
          changed = true;
        }
      }
      return changed;
    },
  };
}
