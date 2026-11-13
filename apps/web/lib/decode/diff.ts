/** Diff grid byte to millimeters of peak water depth `b - a`. 128 = no change (contracts README). */
export function diffMm(byte: number, maxAbsDiffMm: number): number {
  return ((byte - 128) / 127) * maxAbsDiffMm;
}
