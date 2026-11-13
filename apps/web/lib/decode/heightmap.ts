// 16-bit heightmap PNG -> elevations in meters (PRD §6.2).
// Uses fast-png because browser canvas decoding drops 16-bit PNGs to 8 bits.
import { decode } from "fast-png";

export interface Heightmap {
  width: number;
  height: number;
  /** Row-major, row 0 = north edge. Meters. */
  elevations: Float32Array;
  minM: number;
  maxM: number;
}

export function decodeHeightmap(png: ArrayBuffer | Uint8Array, minM: number, maxM: number): Heightmap {
  const img = decode(png);
  if (img.depth !== 16 || img.channels !== 1) {
    throw new Error(`heightmap must be 16-bit grayscale, got ${img.depth}-bit x${img.channels}`);
  }
  const values = img.data as Uint16Array;
  const span = maxM - minM;
  const elevations = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    // elevation_m = min_m + (value / 65535) * (max_m - min_m)
    elevations[i] = minM + (values[i] / 65535) * span;
  }
  return { width: img.width, height: img.height, elevations, minM, maxM };
}
