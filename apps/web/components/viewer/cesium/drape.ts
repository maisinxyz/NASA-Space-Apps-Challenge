// Drape a per-frame-updated raster (water depth frames) over a geographic rectangle, on whichever surface
// is active (Google 3D tiles in tier A, globe terrain in B/C), optionally limited to one side of the
// scene's split divider (scene.splitPosition, 0..1) so two drapes can be compared under one camera.
import "./base";
import {
  type Cesium3DTileset,
  ClassificationType,
  EllipsoidSurfaceAppearance,
  GeometryInstance,
  GroundPrimitive,
  ImageryLayer,
  Material,
  Rectangle,
  RectangleGeometry,
  SingleTileImageryProvider,
  SplitDirection,
  type Viewer,
} from "cesium";

/** Matches what lib/decode/ftw1.ts yields: one Uint8Array per frame, row-major, row 0 = north. */
export type DrapeSource = {
  frames: Uint8Array[];
  width: number;
  height: number;
  /** Depth of byte 255, mm. Not used for colour (bytes are already relative to it); kept for legends. */
  maxDepthMm: number;
  /** [minLon, minLat, maxLon, maxLat], degrees. */
  bbox: [number, number, number, number];
};

/**
 * "classification": GroundPrimitive + canvas-backed material, ClassificationType.BOTH (terrain and 3D tiles).
 * "imagery": SingleTileImageryProvider layer on the globe, or on tileset.imageryLayers when a tileset is given.
 */
export type DrapeMethod = "classification" | "imagery";
export type DrapeSide = "both" | "left" | "right";

export type Drape = {
  /** Show the frame at a fractional index (frameCoord() from components/viewer/timing.ts): 12.25 = 25 % from 12 to 13. */
  setFrame(coord: number): void;
  destroy(): void;
};

// Spike palette (not a legend): shallow light blue -> deep blue. TODO(verify): replace with the product water ramp.
const SHALLOW = [150, 210, 255];
const DEEP = [10, 60, 200];

/**
 * Pure: blend the two frames around `coord` and colour them into an RGBA buffer (width*height*4).
 * Byte 0 = dry = fully transparent. Clamps `coord` to the frame range.
 */
export function frameToRgba(frames: readonly Uint8Array[], width: number, height: number, coord: number, out = new Uint8ClampedArray(width * height * 4)): Uint8ClampedArray {
  const n = frames.length;
  if (n === 0) return out.fill(0);
  const c = Math.min(n - 1, Math.max(0, coord));
  const i0 = Math.floor(c);
  const a = frames[i0];
  const b = frames[Math.min(n - 1, i0 + 1)];
  const t = c - i0;
  for (let i = 0, o = 0; i < width * height; i++, o += 4) {
    const d = (a[i] + (b[i] - a[i]) * t) / 255;
    out[o] = SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * d;
    out[o + 1] = SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * d;
    out[o + 2] = SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * d;
    out[o + 3] = d > 0 ? (0.35 + 0.55 * d) * 255 : 0;
  }
  return out;
}

const SPLIT: Record<DrapeSide, SplitDirection> = { both: SplitDirection.NONE, left: SplitDirection.LEFT, right: SplitDirection.RIGHT };

// Fragment-level split for the classification drape: GroundPrimitive has no splitDirection, but Cesium's own
// shaders split with czm_splitPosition (pixels) against gl_FragCoord.x, so the material does the same.
const SPLIT_MATERIAL_SOURCE = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec4 c = texture(image, materialInput.st);
  if ((side < 0.0 && gl_FragCoord.x > czm_splitPosition) || (side > 0.0 && gl_FragCoord.x < czm_splitPosition)) {
    c.a = 0.0;
  }
  material.diffuse = c.rgb;
  material.alpha = c.a;
  return material;
}`;

export function createDrape(viewer: Viewer, source: DrapeSource, opts: { method: DrapeMethod; side?: DrapeSide; tileset?: Cesium3DTileset }): Drape {
  const { scene } = viewer;
  const { width, height, frames } = source;
  const side = opts.side ?? "both";
  const rectangle = Rectangle.fromDegrees(...source.bbox);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const image = new ImageData(rgba, width, height);
  const newCanvas = () => Object.assign(document.createElement("canvas"), { width, height });
  const paint = (canvas: HTMLCanvasElement, coord: number) => {
    frameToRgba(frames, width, height, coord, rgba);
    canvas.getContext("2d")!.putImageData(image, 0, 0);
    return canvas;
  };

  if (opts.method === "classification") {
    // Material only re-uploads a texture when the uniform is a different object, so alternate two canvases.
    const canvases = [newCanvas(), newCanvas()];
    let flip = 0;
    const material = new Material({
      translucent: true,
      fabric: {
        uniforms: { image: paint(canvases[0], 0), side: side === "left" ? -1 : side === "right" ? 1 : 0 },
        source: SPLIT_MATERIAL_SOURCE,
      },
    });
    const primitive = scene.primitives.add(
      new GroundPrimitive({
        geometryInstances: new GeometryInstance({ geometry: new RectangleGeometry({ rectangle, vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT }) }),
        appearance: new EllipsoidSurfaceAppearance({ material, flat: true }),
        classificationType: ClassificationType.BOTH,
      }),
    );
    return {
      setFrame(coord) {
        flip ^= 1;
        material.uniforms.image = paint(canvases[flip], coord);
        scene.requestRender();
      },
      destroy() {
        if (!viewer.isDestroyed()) scene.primitives.remove(primitive);
      },
    };
  }

  // Imagery: a single-tile provider cannot change its image, so every frame is a new layer.
  // ponytail: the previous layer is dropped after a fixed delay (its replacement needs a moment to decode);
  // layers pile up while scrubbing fast. Fine for the spike; swap for a custom ImageryProvider if this method is chosen.
  const layers = opts.tileset ? opts.tileset.imageryLayers : viewer.imageryLayers;
  const canvas = newCanvas();
  const live = new Set<ImageryLayer>();
  const drop = (layer: ImageryLayer) => {
    live.delete(layer);
    if (!viewer.isDestroyed() && layers.contains(layer)) layers.remove(layer, true);
    if (!viewer.isDestroyed()) scene.requestRender();
  };
  let current: ImageryLayer | undefined;
  return {
    setFrame(coord) {
      const provider = new SingleTileImageryProvider({ url: paint(canvas, coord).toDataURL(), rectangle, tileWidth: width, tileHeight: height });
      const next = new ImageryLayer(provider, { splitDirection: SPLIT[side] });
      layers.add(next);
      live.add(next);
      const old = current;
      current = next;
      if (old) setTimeout(() => drop(old), 150);
      scene.requestRender();
    },
    destroy() {
      current = undefined;
      for (const layer of [...live]) drop(layer);
    },
  };
}
