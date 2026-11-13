// One RGBA lookup atlas (width x 8 rows) for every overlay, indexed by the raw raster byte.
// Rows 0-3: contract layers in LAYER_ORDER. Row 4: risk. Row 5: diff. Alpha 0 = draw nothing (nodata, mask, no change).
import type { LayerLegend, LayerName } from "@/lib/api/types";
import { DIFF_DRIER, DIFF_WETTER, hexToRgb, rampStops, RISK_STOPS, sampleStops } from "./legends";

export const LAYER_ORDER: readonly LayerName[] = ["slope", "flow_accumulation", "depressions", "cover_class"];
export const LUT_ROWS = 8;
export const RISK_LUT_ROW = 4;
export const DIFF_LUT_ROW = 5;
const OVERLAY_ALPHA = 0.82;

export function buildLut(legends: LayerLegend[], width = 256): Uint8Array {
  const lut = new Uint8Array(width * LUT_ROWS * 4);
  const put = (row: number, i: number, rgb: readonly number[], a: number) => lut.set([rgb[0], rgb[1], rgb[2], Math.round(a * 255)], (row * width + i) * 4);

  LAYER_ORDER.forEach((name, row) => {
    const legend = legends.find((l) => l.name === name);
    if (!legend) return;
    if (legend.kind === "categorical") {
      for (const c of legend.classes ?? []) if (c.color) put(row, c.value, hexToRgb(c.color), OVERLAY_ALPHA);
    } else {
      const stops = rampStops(legend.color_ramp);
      for (let i = 0; i < 255; i++) put(row, i, sampleStops(stops, i / 254), OVERLAY_ALPHA); // 255 = nodata stays transparent
    }
  });

  for (let i = 0; i <= 100; i++) put(RISK_LUT_ROW, i, sampleStops(RISK_STOPS, i / 100), Math.min(0.85, 0.1 + (i / 100) * 1.3));

  for (let i = 0; i < 256; i++) {
    const s = Math.max(-1, Math.min(1, (i - 128) / 127));
    const mag = Math.abs(s) < 0.012 ? 0 : Math.sqrt(Math.abs(s)); // sqrt lifts small differences into view
    put(DIFF_LUT_ROW, i, hexToRgb(s > 0 ? DIFF_WETTER : DIFF_DRIER), mag);
  }
  return lut;
}
