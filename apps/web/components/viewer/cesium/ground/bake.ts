// Textures built ONCE per farm/bbox (never per frame): field coverage planes (512 px) and a 64x64 height/gradient grid.
import { Cartographic, createWorldTerrainAsync, sampleTerrainMostDetailed } from "cesium";

import { type Bbox, type Ring, MAX_FIELDS, heightsToRgba, indexToCoverage, rasterizeFieldIndex } from "./geometry";

export const COVER_PX = 512;
export const HEIGHT_PX = 64;

const canvasOf = (px: number, rgba: Uint8ClampedArray) => {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  // Geometry arrays are south-first; DOM ImageData is north-first. Cesium flips canvas
  // uploads so the top row maps to texture v=1 (north), matching materialInput.st.
  const northFirst = new Uint8ClampedArray(rgba.length);
  const stride = px * 4;
  for (let y = 0; y < px; y++) northFirst.set(rgba.subarray(y * stride, (y + 1) * stride), (px - 1 - y) * stride);
  c.getContext("2d")!.putImageData(new ImageData(northFirst, px, px), 0, 0);
  return c;
};

/** Three RGB coverage planes for up to MAX_FIELDS fields (plane p = fields 3p..3p+2). */
export function bakeCoverage(fields: readonly { ring: Ring }[], bbox: Bbox): HTMLCanvasElement[] {
  const index = rasterizeFieldIndex(fields.slice(0, MAX_FIELDS), bbox, COVER_PX);
  return [0, 1, 2].map((p) => canvasOf(COVER_PX, indexToCoverage(index, p)));
}

/** Alpha zero marks unavailable heights while loading or after sampling fails. */
export function flatHeightCanvas(): HTMLCanvasElement {
  const rgba = heightsToRgba(new Float32Array(HEIGHT_PX * HEIGHT_PX), HEIGHT_PX);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 0;
  return canvasOf(HEIGHT_PX, rgba);
}

let warnedHeightFailure = false;
function warnHeightFailure(reason: string) {
  if (warnedHeightFailure) return;
  warnedHeightFailure = true;
  // Do not log Cesium errors: they can contain request URLs and ion tokens.
  console.warn(`[ground] Terrain heights unavailable: ${reason}. Height-dependent effects are disabled.`);
}

/** Safe diagnostic metadata only: Cesium error messages and URLs may contain credentials. */
function failureDetails(error: unknown): string {
  const safeNames = new Set(["Error", "TypeError", "RangeError", "NetworkError", "AbortError", "RuntimeError", "RequestErrorEvent"]);
  const name = error instanceof Error && safeNames.has(error.name) ? error.name : "unknown error";
  const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
  return `${name}${typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? `, HTTP ${status}` : ""}`;
}

/** Terrain heights (m) on a HEIGHT_PX grid, row 0 = south. null on any failure (no Ion token, offline, ...). */
export async function sampleHeights(bbox: Bbox): Promise<Float64Array | null> {
  let stage = "provider initialization";
  try {
    const terrain = await createWorldTerrainAsync();
    stage = "grid sampling";
    const [w, s, e, n] = bbox;
    const pts: Cartographic[] = [];
    for (let y = 0; y < HEIGHT_PX; y++)
      for (let x = 0; x < HEIGHT_PX; x++)
        pts.push(Cartographic.fromDegrees(w + ((x + 0.5) / HEIGHT_PX) * (e - w), s + ((y + 0.5) / HEIGHT_PX) * (n - s)));
    const out = await sampleTerrainMostDetailed(terrain, pts, true);
    if (out.length !== pts.length || out.some((c) => !Number.isFinite(c.height))) {
      warnHeightFailure("terrain returned missing or invalid samples");
      return null;
    }
    return Float64Array.from(out, (c) => c.height);
  } catch (error) {
    warnHeightFailure(`${stage} failed (${failureDetails(error)})`);
    return null;
  }
}

export const heightCanvas = (heights: Float64Array) => canvasOf(HEIGHT_PX, heightsToRgba(heights, HEIGHT_PX));

/** Approximate bbox size in metres (spherical-earth scale; only used to scale noise patterns). */
export function bboxSizeM(b: Bbox): [number, number] {
  const midLat = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  return [(b[2] - b[0]) * 111_320 * Math.cos(midLat), (b[3] - b[1]) * 110_574];
}
