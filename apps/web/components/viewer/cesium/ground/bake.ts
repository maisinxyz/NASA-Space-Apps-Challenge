// Textures built ONCE per farm/bbox (never per frame): field coverage planes (256 px) and a 64x64 height/gradient grid.
import { Cartographic, createWorldTerrainAsync, sampleTerrainMostDetailed } from "cesium";

import { type Bbox, type Ring, MAX_FIELDS, heightsToRgba, indexToCoverage, rasterizeFieldIndex } from "./geometry";

export const COVER_PX = 256;
export const HEIGHT_PX = 64;

const canvasOf = (px: number, rgba: Uint8ClampedArray) => {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  c.getContext("2d")!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, px, px), 0, 0);
  return c;
};

/** Three RGB coverage planes for up to MAX_FIELDS fields (plane p = fields 3p..3p+2). */
export function bakeCoverage(fields: readonly { ring: Ring }[], bbox: Bbox): HTMLCanvasElement[] {
  const index = rasterizeFieldIndex(fields.slice(0, MAX_FIELDS), bbox, COVER_PX);
  return [0, 1, 2].map((p) => canvasOf(COVER_PX, indexToCoverage(index, p)));
}

/** Flat mid-grey height canvas: used while real heights load or when they fail. */
export function flatHeightCanvas(): HTMLCanvasElement {
  return canvasOf(HEIGHT_PX, heightsToRgba(new Float32Array(HEIGHT_PX * HEIGHT_PX), HEIGHT_PX));
}

/** Terrain heights (m) on a HEIGHT_PX grid, row 0 = south. null on any failure (no Ion token, offline, ...). */
export async function sampleHeights(bbox: Bbox): Promise<Float64Array | null> {
  try {
    const terrain = await createWorldTerrainAsync();
    const [w, s, e, n] = bbox;
    const pts: Cartographic[] = [];
    for (let y = 0; y < HEIGHT_PX; y++)
      for (let x = 0; x < HEIGHT_PX; x++)
        pts.push(Cartographic.fromDegrees(w + ((x + 0.5) / HEIGHT_PX) * (e - w), s + ((y + 0.5) / HEIGHT_PX) * (n - s)));
    const out = await sampleTerrainMostDetailed(terrain, pts);
    return Float64Array.from(out, (c) => c.height ?? 0);
  } catch {
    return null;
  }
}

export const heightCanvas = (heights: Float64Array) => canvasOf(HEIGHT_PX, heightsToRgba(heights, HEIGHT_PX));

/** Approximate bbox size in metres (spherical-earth scale; only used to scale noise patterns). */
export function bboxSizeM(b: Bbox): [number, number] {
  const midLat = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  return [(b[2] - b[0]) * 111_320 * Math.cos(midLat), (b[3] - b[1]) * 110_574];
}
