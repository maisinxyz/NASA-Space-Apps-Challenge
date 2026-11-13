import { decode } from "fast-png";

export interface NormalMap {
  width: number;
  height: number;
  /** RGBA bytes (alpha 255), row 0 = north. R = east, G = north, B = up; n = byte / 255 * 2 - 1. */
  rgba: Uint8Array;
}

export function decodeNormalMap(png: ArrayBuffer | Uint8Array): NormalMap {
  const img = decode(png);
  if (img.depth !== 8 || img.channels < 3) throw new Error(`normal map must be 8-bit RGB, got ${img.depth}-bit x${img.channels}`);
  const n = img.width * img.height;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = img.data[i * img.channels];
    rgba[i * 4 + 1] = img.data[i * img.channels + 1];
    rgba[i * 4 + 2] = img.data[i * img.channels + 2];
    rgba[i * 4 + 3] = 255;
  }
  return { width: img.width, height: img.height, rgba };
}

/** Unit-ish vector [east, north, up] at a cell. */
export function normalAt(m: NormalMap, row: number, col: number): [number, number, number] {
  const i = (row * m.width + col) * 4;
  return [(m.rgba[i] / 255) * 2 - 1, (m.rgba[i + 1] / 255) * 2 - 1, (m.rgba[i + 2] / 255) * 2 - 1];
}
