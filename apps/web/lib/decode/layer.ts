import { decode } from "fast-png";

/** 8-bit single-channel grid, row-major, row 0 = north, column 0 = west. */
export interface Raster8 {
  width: number;
  height: number;
  data: Uint8Array;
}

export const NODATA = 255;

/** Decode an 8-bit grayscale PNG (layers, risk, diff) without any color management. */
export function decodeGray8(png: ArrayBuffer | Uint8Array): Raster8 {
  const img = decode(png);
  if (img.depth !== 8 || img.channels !== 1) throw new Error(`expected 8-bit grayscale PNG, got ${img.depth}-bit x${img.channels}`);
  return { width: img.width, height: img.height, data: img.data as Uint8Array };
}

/**
 * Physical value of a continuous layer byte: `min + byte / 254 * (max - min)` (contracts README).
 * 255 = nodata, returned as null. For categorical layers the byte is the class index: use it directly.
 */
export function layerValue(byte: number, valueRange: readonly number[]): number | null {
  if (byte === NODATA) return null;
  const [min, max] = valueRange;
  return min + (byte / 254) * (max - min);
}
