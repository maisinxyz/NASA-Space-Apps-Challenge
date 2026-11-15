// Per-field colour from the engine trajectories (v4 PRD F2, D4: one colour per field, no 30 m grid).
// Pure: field values for a strategy, metric and forecast year, and a colour ramp from good to poor.
import type { Forecast } from "@/lib/api/types";

import { engineSeries, pointAt } from "./data";

export type FieldMetric = "soil" | "water" | "bare";

export const FIELD_METRICS: Record<FieldMetric, { label: string; metric: string; higherIsBetter: boolean }> = {
  soil: { label: "Soil organic matter", metric: "soil_organic_index", higherIsBetter: true },
  water: { label: "Water stress (irrigation need)", metric: "irrigation_need_mm", higherIsBetter: false },
  bare: { label: "Bare-soil weeks", metric: "bare_weeks", higherIsBetter: false },
};

/** Good -> poor. */
export const RAMP = ["#6FA86B", "#E2B866", "#C46A52"] as const;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Colour for 0 (good) .. 1 (poor). */
export function rampColour(k: number): string {
  const x = Math.min(1, Math.max(0, k)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
  const f = x - i;
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",")})`;
}

export type FieldValue = { fieldId: string; value: number; p10: number | null; p90: number | null; unit: string; colour: string };

/**
 * Values for every field at `year`. The colour scale spans every field and every year 1..horizon of this strategy,
 * so dragging the year changes the colours.
 */
export function fieldValues(f: Forecast, engineId: string, metric: FieldMetric, year: number): { values: FieldValue[]; min: number; max: number; unit: string } {
  const spec = FIELD_METRICS[metric];
  const all: number[] = [];
  const rows = f.fields.map((field) => {
    const s = engineSeries(f, engineId, spec.metric, field.field_id);
    if (!s) return null;
    for (const p of s.points) if (p.year >= 1) all.push(p.p50);
    return { field, s, v: pointAt(s, year) };
  });
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = max - min || 1;
  let unit = "";
  const values = rows.flatMap((r) => {
    if (!r) return [];
    unit = r.v.unit;
    const k = (r.v.p50 - min) / span;
    return [{ fieldId: r.field.field_id, value: r.v.p50, p10: r.v.p10, p90: r.v.p90, unit: r.v.unit, colour: rampColour(spec.higherIsBetter ? 1 - k : k) }];
  });
  return { values, min, max, unit };
}

/** Draws filled field rings onto a north-up canvas covering bbox [w, s, e, n]. */
export function paintFields(canvas: HTMLCanvasElement, bbox: [number, number, number, number], rings: { ring: [number, number][]; colour: string }[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [w, s, e, n] = bbox;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const { ring, colour } of rings) {
    if (ring.length < 3) continue;
    ctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = ((lon - w) / (e - w)) * canvas.width;
      const y = ((n - lat) / (n - s)) * canvas.height;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
}
