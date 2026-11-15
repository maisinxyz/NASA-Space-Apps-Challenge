// Crop rotation planner (v4 PRD F7): pure helpers. The request is the farm's base request (lib/forecast/sites.ts)
// with the farmer's crop pool, pins, exclusions, constraints, strategy count, water quota and custom rotation.
import type { CropTraitV2, Forecast, ForecastRequest, RotationSlot } from "@/lib/api/types";

export type Season = RotationSlot["season"];
export const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];
export const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter" };
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
/** Meteorological seasons (northern hemisphere): Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov fall. */
export const MONTH_SEASON: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];

/** Category order and labels for the pool picker; unknown categories still show, under their own name. */
export const CATEGORY_LABEL: Record<string, string> = { vegetable: "Vegetables", grain: "Grains", forage: "Forage", cover: "Cover crops", fruit_perennial: "Fruit" };
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c.replace(/_/g, " ");

export const RULE_STATUS: Record<string, { label: string; tone: "good" | "bad" | "neutral" }> = {
  met: { label: "Met", tone: "good" },
  broken: { label: "Broken", tone: "bad" },
  unknown: { label: "Unknown", tone: "neutral" },
};
export const ruleStatus = (s: string) => RULE_STATUS[s] ?? { label: s, tone: "neutral" as const };

export const ROLE_LABEL: Record<string, string> = {
  nitrogen_fixing: "Nitrogen-fixing",
  cover: "Cover",
  deep_rooting: "Deep-rooting",
  drought_tolerant: "Drought-tolerant",
  other: "Other",
};
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r.replace(/_/g, " ");

const PALETTE = ["#d9b44a", "#a8d46a", "#3f9a86", "#7cb85a", "#c98a4b", "#8db6d9", "#b07fc4", "#e07a6a", "#5f8f3a", "#e2c38a", "#6aa3a0", "#c4a25a"];

/** Stable colour per crop id (same id, same colour, everywhere in the planner). Fallow is soil brown. */
export function cropColour(cropId: string): string {
  if (cropId === "fallow") return "#8a6446";
  let h = 0;
  for (let i = 0; i < cropId.length; i++) h = (h * 31 + cropId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Trait sources for display: a missing check is shown in plain words, never as a TODO tag (v4 PRD §2 rule 1). */
export const plainSource = (s: string | undefined) => (s ? s.replace(/\s*TODO\(verify\)\s*/g, " (not yet verified) ").replace(/\s+/g, " ").trim() : "No source listed");

export type PlannerInput = {
  pool: string[];
  pinned: string[];
  excluded: string[];
  constraints: ForecastRequest["constraints"];
  strategyCount: number;
  waterQuotaMm: number | null;
  /** Custom rotation (one cycle); null = none. */
  custom: RotationSlot[] | null;
};

export function inputFrom(base: ForecastRequest): PlannerInput {
  return {
    pool: [...base.selection.crops],
    pinned: [...base.selection.pinned],
    excluded: [...base.selection.excluded],
    constraints: { ...base.constraints, equipment: [...base.constraints.equipment] },
    strategyCount: base.strategy_count ?? 3,
    waterQuotaMm: base.farm_water_quota_mm_per_season ?? null,
    custom: base.custom_strategies?.[0]?.map((slot) => ({ ...slot })) ?? null,
  };
}

/** Problems that stop a run, in plain words. Empty = ok. */
export function validate(i: PlannerInput): string[] {
  const out: string[] = [];
  const usable = i.pool.filter((c) => !i.excluded.includes(c));
  if (usable.length < 2) out.push("Pick at least two crops that are not excluded.");
  if (i.pool.length > 30) out.push("Pick at most 30 crops.");
  if (i.pinned.some((c) => i.excluded.includes(c))) out.push("A crop cannot be both pinned and excluded.");
  if (i.custom && i.custom.length === 0) out.push("The custom rotation has no crops yet.");
  return out;
}

/** The forecast request for the planner input. Pinned and excluded crops are kept inside the pool. */
export function buildRequest(base: ForecastRequest, i: PlannerInput): ForecastRequest {
  const pool = [...new Set([...i.pool, ...i.pinned])].filter((c) => !i.excluded.includes(c) || i.pool.includes(c));
  const body: ForecastRequest = {
    ...base,
    selection: { crops: pool, pinned: i.pinned.filter((c) => pool.includes(c)), excluded: i.excluded.filter((c) => pool.includes(c)) },
    constraints: i.constraints,
    strategy_count: i.strategyCount,
  };
  if (i.waterQuotaMm !== null) body.farm_water_quota_mm_per_season = i.waterQuotaMm;
  else delete body.farm_water_quota_mm_per_season;
  if (i.custom && i.custom.length) body.custom_strategies = [i.custom];
  else delete body.custom_strategies;
  return body;
}

/** Crop in a (year, season) cell of an expanded plan; null = nothing planned that season. */
export function cropAt(plan: RotationSlot[], year: number, season: Season): string | null {
  return plan.find((s) => s.year_index === year && s.season === season)?.crop_id ?? null;
}

/** The 12-month calendar of one plan year, by meteorological season. */
export const calendarOf = (plan: RotationSlot[], year: number) => MONTH_SEASON.map((s) => cropAt(plan, year, s));

/** Set or clear one cell of a custom cycle. Keeps slots sorted by year then season order. */
export function setCell(plan: RotationSlot[], year: number, season: Season, cropId: string | null): RotationSlot[] {
  const rest = plan.filter((s) => !(s.year_index === year && s.season === season));
  const next = cropId ? [...rest, { year_index: year, season, crop_id: cropId }] : rest;
  return next.sort((a, b) => a.year_index - b.year_index || SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season));
}

/** One cycle of a strategy's plan (years 1..cycle). */
export const cycleOf = (plan: RotationSlot[], cycleYears: number) => plan.filter((s) => s.year_index <= cycleYears);

/** Catalog names, falling back to the id. */
export const namesOf = (crops: Pick<CropTraitV2, "id" | "name">[]) => new Map(crops.map((c) => [c.id, c.name]));

/** Strategies of the chosen field (or the first field for the whole-farm plan), in response order. */
export function strategiesFor(f: Forecast, fieldId: string | null) {
  const field = (fieldId && f.fields.find((x) => x.field_id === fieldId)) || f.fields[0];
  return { field, strategies: field?.strategies ?? [] };
}
