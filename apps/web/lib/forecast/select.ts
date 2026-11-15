// Pure helpers over a Forecast response: strategy lists, series for charts, deltas. No fetching, no state.
import type { Forecast, YearSeries } from "@/lib/api/types";

export type MetricKey =
  | "soil_organic_index"
  | "infiltration_index"
  | "runoff_index"
  | "pest_pressure_index"
  | "water_demand_mm"
  | "irrigation_need_mm"
  | "bare_weeks"
  | "n_balance";

/** Chart metrics: label, and whether a higher value is better for the farm (null = neither). Wording is ours; units come from the API. */
export const METRICS: { key: MetricKey; label: string; higherIsBetter: boolean | null }[] = [
  { key: "soil_organic_index", label: "Soil organic matter", higherIsBetter: true },
  { key: "infiltration_index", label: "Water infiltration", higherIsBetter: true },
  { key: "runoff_index", label: "Runoff", higherIsBetter: false },
  { key: "pest_pressure_index", label: "Pest pressure", higherIsBetter: false },
  { key: "irrigation_need_mm", label: "Irrigation need", higherIsBetter: false },
  { key: "water_demand_mm", label: "Crop water demand", higherIsBetter: null },
  { key: "bare_weeks", label: "Bare-soil weeks", higherIsBetter: false },
  { key: "n_balance", label: "Nitrogen balance", higherIsBetter: null },
];

export type StrategyView = { id: string; role: "existing" | "alternative" | "custom"; label: string };

/** Strategies in response order (index 0 = the existing rotation), labelled from the first field. */
export function strategiesOf(f: Forecast): StrategyView[] {
  const first = f.fields[0]?.strategies ?? [];
  return first.map((s) => ({ id: s.id, role: s.role, label: s.label }));
}

/** Farm-wide (area-weighted) trajectories, or one field's when `fieldId` is given. */
export function seriesOf(f: Forecast, strategyId: string, metric: MetricKey, fieldId?: string | null): YearSeries | null {
  if (fieldId) return f.fields.find((x) => x.field_id === fieldId)?.strategies.find((s) => s.id === strategyId)?.trajectories[metric] ?? null;
  return f.farm_rollup.strategies.find((s) => s.id === strategyId)?.trajectories[metric] ?? null;
}

/** Value at a forecast year (0 = baseline … horizon); the first/last point is used outside the range. */
export function valueAt(series: YearSeries, year: number) {
  const pts = series.points;
  const p = pts.find((x) => x.year === year) ?? (year < pts[0].year ? pts[0] : pts[pts.length - 1]);
  return { p50: p.p50, p10: p.p10 ?? null, p90: p.p90 ?? null };
}

/** Forecast year (1…horizon) shown for the clock position t (years since the first forecast year, 0…horizon). */
export const yearOfClock = (t: number, horizon: number) => Math.min(horizon, Math.max(1, Math.floor(t) + 1));

export const fmt = (v: number, unit?: string) => {
  const abs = Math.abs(v);
  const s = abs >= 100 ? v.toFixed(0) : abs >= 10 ? v.toFixed(1) : v.toFixed(2);
  return unit ? `${s} ${unit}` : s;
};

/** Scores follow the selected area; absent rollup data is never replaced by a field. */
export function scorecardOf(f: Forecast, strategyId: string, fieldId: string | null) {
  const section = fieldId ? f.fields.find((field) => field.field_id === fieldId) : f.farm_rollup;
  return section?.strategies.find((strategy) => strategy.id === strategyId)?.scorecard ?? [];
}

/** Farm-wide flags include every field, deduplicating repeated messages. */
export function flagsOf(f: Forecast, strategyId: string, fieldId: string | null) {
  const fields = fieldId ? f.fields.filter((field) => field.field_id === fieldId) : f.fields;
  const flags = fields.flatMap((field) => field.strategies.find((strategy) => strategy.id === strategyId)?.review_flags ?? []);
  return [...new Map(flags.map((flag) => [`${flag.severity}:${flag.text}`, flag])).values()];
}

/** Flags grouped by field (one group when a field is selected); fields with no flags are omitted. */
export function flagsByField(f: Forecast, strategyId: string, fieldId: string | null) {
  return (fieldId ? f.fields.filter((x) => x.field_id === fieldId) : f.fields)
    .map((x) => ({ fieldId: x.field_id, fieldName: x.name, flags: x.strategies.find((s) => s.id === strategyId)?.review_flags ?? [] }))
    .filter((g) => g.flags.length > 0);
}
