// FutureData: the read model Future / Compare mode panels use. Built from the engine Forecast when the farm has one
// (lib/forecast/store), else from the synthetic fixtures (labelled "Synthetic demo data" by the UI).
// Pure: same forecast in, same object out. The UI never reads Forecast directly for these panels.
import type { Forecast, ForecastStrategy, ReviewFlag, RotationSlot, YearSeries } from "@/lib/api/types";

import { REVIEW_FLAGS, STRATEGIES, type StrategyId } from "./fixtures";

export const STRATEGY_IDS: readonly StrategyId[] = ["current", "a", "b"];
export const SWATCHES: Record<StrategyId, string> = { current: "#C9BFAE", a: "#E2B866", b: "#9CC28A" };
/** Name shown for the farm's existing rotation (product rule 2, D11). */
export const CURRENT_ROTATION = "Current rotation";

export type FutureFlag = {
  id: string;
  severity: string;
  text: string;
  /** Fields this flag was raised on (engine flags repeat per field). */
  fieldIds: string[];
  week: number | null;
  layer: string;
};

export type FutureStrategy = {
  id: StrategyId;
  /** Engine strategy id (rot_existing, rot_alt_1, ...) or the fixture id. */
  engineId: string;
  role: "existing" | "alternative" | "custom";
  /** Picker name: "Current rotation" or the engine label. */
  name: string;
  /** Short crop sequence, e.g. "barley · pea · winter wheat". */
  rotation: string;
  swatch: string;
  cycleYears: number;
  plan: RotationSlot[];
};

export type SeriesPoint = { p50: number; p10: number | null; p90: number | null; unit: string; basis: string };

export type FutureData = {
  source: "engine" | "synthetic";
  strategies: FutureStrategy[];
  flags: Record<StrategyId, FutureFlag[]>;
};

/** "crop_wheat_winter" -> "wheat (winter)". Display only; the catalog names come from /crop-catalog where loaded. */
export function cropName(cropId: string): string {
  if (cropId === "fallow") return "fallow";
  const [head, ...rest] = cropId.replace(/^crop_/, "").split("_");
  return rest.length ? `${head} (${rest.join(" ")})` : head;
}

/** Crops of one rotation cycle in order, without repeats. */
export function rotationText(plan: RotationSlot[], cycleYears: number): string {
  const seen: string[] = [];
  for (const slot of plan) {
    if (slot.year_index > cycleYears) break;
    if (slot.crop_id !== "fallow" && !seen.includes(slot.crop_id)) seen.push(slot.crop_id);
  }
  return seen.map(cropName).join(" · ") || "fallow";
}

/** Flags of one engine strategy across every field, merged by text (the engine repeats them per field). */
function mergeFlags(f: Forecast, engineId: string): FutureFlag[] {
  const byText = new Map<string, FutureFlag>();
  for (const field of f.fields) {
    const s = field.strategies.find((x) => x.id === engineId);
    for (const flag of (s?.review_flags ?? []) as ReviewFlag[]) {
      const hit = byText.get(flag.text);
      if (hit) {
        if (!hit.fieldIds.includes(field.field_id)) hit.fieldIds.push(field.field_id);
        continue;
      }
      byText.set(flag.text, {
        id: flag.id,
        severity: flag.severity,
        text: flag.text,
        fieldIds: [field.field_id],
        week: flag.trigger.week ?? null,
        layer: flag.trigger.layer,
      });
    }
  }
  // Most severe first; unknown severities sort last but still show.
  const rank = (s: string) => ({ verify: 0, caution: 1, info: 2 })[s] ?? 3;
  return [...byText.values()].sort((a, b) => rank(a.severity) - rank(b.severity));
}

function fromEngine(f: Forecast): FutureData {
  const first = f.fields[0]?.strategies ?? [];
  const strategies = first.slice(0, STRATEGY_IDS.length).map((s: ForecastStrategy, i): FutureStrategy => ({
    id: STRATEGY_IDS[i],
    engineId: s.id,
    role: s.role,
    name: s.role === "existing" ? CURRENT_ROTATION : s.label,
    rotation: rotationText(s.plan, s.cycle_years),
    swatch: SWATCHES[STRATEGY_IDS[i]],
    cycleYears: s.cycle_years,
    plan: s.plan,
  }));
  const flags = Object.fromEntries(STRATEGY_IDS.map((id) => [id, [] as FutureFlag[]])) as Record<StrategyId, FutureFlag[]>;
  for (const s of strategies) flags[s.id] = mergeFlags(f, s.engineId);
  return { source: "engine", strategies, flags };
}

function fromFixtures(): FutureData {
  const strategies = STRATEGIES.map((s): FutureStrategy => ({
    id: s.id, engineId: s.id, role: s.id === "current" ? "existing" : "alternative", name: s.name, rotation: s.rotation,
    swatch: s.swatch, cycleYears: 1, plan: [],
  }));
  const flags = Object.fromEntries(
    STRATEGY_IDS.map((id) => [id, REVIEW_FLAGS[id].map((r, i): FutureFlag => ({
      id: `${id}-${i}`, severity: "caution", text: `${r.title}. ${r.detail}`, fieldIds: r.goTo.fieldId ? [r.goTo.fieldId] : [], week: Math.floor(r.goTo.doy / 7), layer: "synthetic",
    }))]),
  ) as Record<StrategyId, FutureFlag[]>;
  return { source: "synthetic", strategies, flags };
}

/** The read model. An engine forecast with at least one strategy wins; otherwise the synthetic fixtures. */
export function buildFutureData(f: Forecast | null): FutureData {
  return f && f.fields[0]?.strategies.length ? fromEngine(f) : fromFixtures();
}

export const strategyOf = (d: FutureData, id: StrategyId) => d.strategies.find((s) => s.id === id) ?? d.strategies[0];

/** One engine trajectory for a strategy: farm rollup, or one field when fieldId is set. */
export function engineSeries(f: Forecast, engineId: string, metric: string, fieldId?: string | null): YearSeries | null {
  const pick = (t: Record<string, YearSeries | undefined> | undefined) => t?.[metric] ?? null;
  if (fieldId) return pick(f.fields.find((x) => x.field_id === fieldId)?.strategies.find((s) => s.id === engineId)?.trajectories as never);
  return pick(f.farm_rollup.strategies.find((s) => s.id === engineId)?.trajectories as never);
}

/** Value of a series at a forecast year; nearest end point outside the range. */
export function pointAt(s: YearSeries, year: number): SeriesPoint {
  const pts = s.points;
  const p = pts.find((x) => x.year === year) ?? (year < pts[0].year ? pts[0] : pts[pts.length - 1]);
  return { p50: p.p50, p10: p.p10 ?? null, p90: p.p90 ?? null, unit: s.unit, basis: s.basis };
}

/** Clock t (years since the first forecast year, 0..10) -> forecast year 1..horizon. */
export const forecastYear = (t: number, horizon = 10) => Math.min(horizon, Math.max(1, Math.floor(t) + 1));
