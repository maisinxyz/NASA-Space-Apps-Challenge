import { NODATA } from "./layer";

/** Risk grid byte to the relative erosion-risk index 0-100. 255 = masked, returned as null. Relative only. */
export function riskIndex(byte: number): number | null {
  return byte === NODATA ? null : byte;
}
