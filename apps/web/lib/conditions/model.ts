// Condition layers for the 2D and 3D maps: one hue per condition, intensity (light -> dark) = how much of it, per year.
// Pure and deterministic. Real engine numbers are the baseline wherever the forecast has them (crop trajectories, climate
// outlook, exposure); the year-to-year ramp, per-plot terrain/soil factors and the stretched scale are built here so that
// each plot and each year reads differently. Plot factors come from a hand-built terrain (elev) and a plot-id hash.
import type { Forecast } from "@/lib/api/types";
import { engineSeries, pointAt } from "@/lib/farm-future/data";

export type CondId =
  | "heat" | "temp" | "lastFrost" | "firstFrost" | "rain" | "extremeRain" | "et" | "soilMoist" | "waterBal" | "groundwater"
  | "vulnSeason" | "bare" | "erosion" | "waterStress" | "frostPocket"
  | "soilOm" | "nitrogen" | "infiltration" | "runoff" | "pest"
  | "quota";

export type GroupId = "climate" | "vuln" | "soil" | "farm";
export type Cond = {
  id: CondId;
  group: GroupId;
  label: string;
  hue: number;
  sat: number;
  unit: string;
  /** Darker = earlier (first fall frost): the raw value is inverted for the scale. */
  invert?: boolean;
  /** Spatial hotspot: also draws zone polygons. */
  zones?: boolean;
  /** One-line meaning of dark vs light for the legend. */
  low: string;
  high: string;
  fmt?: (v: number) => string;
};

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: "climate", label: "Future climate & water balance" },
  { id: "vuln", label: "Field vulnerability & seasonal timing" },
  { id: "soil", label: "Soil health & ecology (per strategy)" },
  { id: "farm", label: "Farm outcomes (per strategy)" },
];

const doy = (v: number) => {
  const d = new Date(Date.UTC(2025, 0, Math.round(v)));
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
};

export const CONDITIONS: Cond[] = [
  { id: "heat", group: "climate", label: "Heat-stress days", hue: 2, sat: 78, unit: "days/yr", low: "fewer days", high: "more days" },
  { id: "temp", group: "climate", label: "Seasonal temperature drift", hue: 28, sat: 88, unit: "°C vs now", low: "close to now", high: "warmer" },
  { id: "lastFrost", group: "climate", label: "Last spring frost", hue: 200, sat: 85, unit: "date", low: "earlier", high: "later", fmt: doy },
  { id: "firstFrost", group: "climate", label: "First fall frost", hue: 255, sat: 70, unit: "date", invert: true, low: "later", high: "earlier", fmt: doy },
  { id: "rain", group: "climate", label: "Seasonal rainfall", hue: 225, sat: 80, unit: "mm/yr", low: "drier", high: "wetter" },
  { id: "extremeRain", group: "climate", label: "Extreme-rain days", hue: 285, sat: 62, unit: "days/yr", low: "fewer", high: "more" },
  { id: "et", group: "climate", label: "Evapotranspiration (ET)", hue: 168, sat: 70, unit: "mm/yr", low: "slower loss", high: "faster loss" },
  { id: "soilMoist", group: "climate", label: "Soil-moisture deficit", hue: 50, sat: 85, unit: "% below normal", low: "near normal", high: "drier than normal" },
  { id: "waterBal", group: "climate", label: "Net water-balance deficit", hue: 330, sat: 65, unit: "mm", low: "surplus / small gap", high: "large deficit" },
  { id: "groundwater", group: "climate", label: "Groundwater decline (regional)", hue: 182, sat: 38, unit: "index", low: "stable", high: "falling" },

  { id: "vulnSeason", group: "vuln", label: "Vulnerable crop seasons", hue: 346, sat: 82, unit: "weeks exposed", low: "few weeks", high: "many weeks" },
  { id: "bare", group: "vuln", label: "Bare-field window", hue: 34, sat: 52, unit: "weeks/yr", low: "covered", high: "bare longer" },
  { id: "erosion", group: "vuln", label: "Erosion-risk zones", hue: 12, sat: 62, unit: "risk index", zones: true, low: "low risk", high: "high risk" },
  { id: "waterStress", group: "vuln", label: "Water-stress hotspots", hue: 62, sat: 90, unit: "risk index", zones: true, low: "low stress", high: "high stress" },
  { id: "frostPocket", group: "vuln", label: "Frost-prone pockets", hue: 190, sat: 92, unit: "risk index", zones: true, low: "low risk", high: "high risk" },

  { id: "soilOm", group: "soil", label: "Soil organic matter", hue: 135, sat: 55, unit: "index (yr 0 = 100)", low: "lower", high: "higher" },
  { id: "nitrogen", group: "soil", label: "Nitrogen balance", hue: 92, sat: 70, unit: "kg N/ha", low: "less N", high: "more N" },
  { id: "infiltration", group: "soil", label: "Water infiltration", hue: 172, sat: 75, unit: "index (yr 0 = 100)", low: "less soaks in", high: "more soaks in" },
  { id: "runoff", group: "soil", label: "Runoff", hue: 265, sat: 58, unit: "index (yr 0 = 100)", low: "less runoff", high: "more runoff" },
  { id: "pest", group: "soil", label: "Pest & disease pressure", hue: 305, sat: 66, unit: "index 0-100", low: "broken cycle", high: "building up" },

  { id: "quota", group: "farm", label: "Water demand vs quota", hue: 150, sat: 80, unit: "mm/yr", low: "within quota", high: "needs more water" },
];
export const condById = (id: CondId | null) => CONDITIONS.find((c) => c.id === id) ?? null;

// ---- plot factors ---------------------------------------------------------------------------------------------

export type PlotFeat = { id: string; phase: number; slope: number; low: number; soilK: number; ring: [number, number][] };
type Ring = [number, number][];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};
/** Hand-built rolling terrain over the farm (x, y in -1..1 across the farm). Higher = higher ground. */
const elev = (x: number, y: number) => 0.5 + 0.3 * Math.sin(1.9 * x + 0.7) + 0.25 * Math.cos(1.4 * y - 0.3) + 0.22 * y;

const rankNorm = (v: number[]) => {
  const lo = Math.min(...v), hi = Math.max(...v), s = hi - lo || 1;
  return v.map((x) => (x - lo) / s);
};

export function plotFeats(fields: { id: string; ring: Ring }[]): PlotFeat[] {
  if (!fields.length) return [];
  const cs = fields.map((f) => [f.ring.reduce((a, p) => a + p[0], 0) / f.ring.length, f.ring.reduce((a, p) => a + p[1], 0) / f.ring.length]);
  const cx = cs.reduce((a, c) => a + c[0], 0) / cs.length, cy = cs.reduce((a, c) => a + c[1], 0) / cs.length;
  const sx = Math.max(...cs.map((c) => Math.abs(c[0] - cx)), 1e-6), sy = Math.max(...cs.map((c) => Math.abs(c[1] - cy)), 1e-6);
  const e = cs.map((c) => elev((c[0] - cx) / sx, (c[1] - cy) / sy));
  const d = 0.05;
  const slope = cs.map((c) => {
    const x = (c[0] - cx) / sx, y = (c[1] - cy) / sy;
    return Math.hypot(elev(x + d, y) - elev(x - d, y), elev(x, y + d) - elev(x, y - d)) / (2 * d);
  });
  const low = rankNorm(e.map((v) => -v));
  const sl = rankNorm(slope);
  return fields.map((f, i) => ({ id: f.id, phase: i % 3, slope: sl[i], low: low[i], soilK: hash(f.id) * 2 - 1, ring: f.ring }));
}

// ---- raw values -----------------------------------------------------------------------------------------------

export type Ctx = { forecast: Forecast | null; engineId: string };
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const p50 = (x: Loose | undefined | null, d: number) => (x && typeof x.p50 === "number" ? x.p50 : x && typeof x.value === "number" ? x.value : d);

const trajectory = (ctx: Ctx, metric: string, f: PlotFeat, year: number, fallback: number) => {
  if (!ctx.forecast) return fallback;
  const s = engineSeries(ctx.forecast, ctx.engineId, metric, f.id) ?? engineSeries(ctx.forecast, ctx.engineId, metric, null);
  if (!s) return fallback;
  return pointAt(s, ((year - 1 + f.phase) % 10) + 1).p50; // plots sit at different points of the 3-year rotation
};

function raw(c: CondId, f: PlotFeat, y: number, ctx: Ctx): number {
  const co: Loose = (ctx.forecast as unknown as Loose)?.climate_outlook ?? {};
  const ex: Loose = (ctx.forecast as unknown as Loose)?.exposure ?? {};
  const wob = Math.sin(y * 1.7 + f.soilK * 3) * 0.5; // small year-to-year wobble, plot-specific
  switch (c) {
    case "heat": return p50(co.heat_stress_days?.[0]?.days?.points?.[y - 1], 0) + 3 + 1.5 * y + 2.2 * f.soilK + wob * 2;
    case "temp": return 0.1 * y + 0.35 * f.soilK + wob * 0.15;
    case "lastFrost": return p50(co.frost_windows?.last_spring_frost?.baseline_doy, 111) - 0.9 * y + 9 * f.low + wob * 2;
    case "firstFrost": return p50(co.frost_windows?.first_fall_frost?.baseline_doy, 303) + 0.7 * y - 8 * f.low + wob * 2;
    case "rain": {
      const t = co.rainfall?.seasonal_totals ?? {};
      const base = ["winter", "spring", "summer", "fall"].reduce((a, s) => a + p50(t[s]?.baseline, 250), 0);
      return base * (1 + 0.012 * Math.sin(y * 1.3) - 0.004 * y) + 22 * f.low;
    }
    case "extremeRain": return p50(co.rainfall?.extreme_rain_days?.baseline, 10) + 0.4 * y + 1.2 * f.slope + wob;
    case "et": return 520 + 7 * y + 24 * f.soilK + wob * 4;
    case "soilMoist": return 3 + 1.0 * y + 4 * f.soilK + 2.5 * f.slope + wob;
    case "waterBal": return Math.max(0, -p50(co.water_balance?.seasonal?.summer?.baseline, -120)) * (1 + 0.03 * y) + 30 * f.soilK + 12 * f.slope + wob * 5;
    case "groundwater": return 1.1 * y + 3 * f.low + wob;
    case "vulnSeason": {
      const weeks = (ex.vulnerable_seasons as Loose[] | undefined)?.reduce((a, s) => a + (s.weeks?.length ?? 0), 0) ?? 20;
      return Math.min(26, weeks) * (0.75 + 0.25 * f.phase) + 1.6 * y + wob; // weeks per year, capped below 52
    }
    case "bare": return trajectory(ctx, "bare_weeks", f, y, 30) + 0.2 * y + 2 * f.slope;
    case "erosion": return 8 * f.slope + 0.35 * trajectory(ctx, "bare_weeks", f, y, 30) + 0.45 * y + wob;
    case "waterStress": return 0.12 * trajectory(ctx, "irrigation_need_mm", f, y, 40) + 3 * f.soilK + 0.5 * y + wob;
    case "frostPocket": return 9 * f.low + 0.04 * (p50(co.frost_windows?.last_spring_frost?.baseline_doy, 111) - 0.9 * y) + 0.15 * y + wob;
    case "soilOm": return trajectory(ctx, "soil_organic_index", f, y, 100) + 0.6 * f.soilK;
    case "nitrogen": return trajectory(ctx, "n_balance_kg_ha", f, y, 0) + 2 * f.soilK;
    case "infiltration": return trajectory(ctx, "infiltration_index", f, y, 100) - 3 * f.slope;
    case "runoff": return trajectory(ctx, "runoff_index", f, y, 100) + 4 * f.slope;
    case "pest": return trajectory(ctx, "pest_pressure_index", f, y, 30) + 2.5 * y + 3 * f.phase;
    case "quota": return trajectory(ctx, "water_demand_mm", f, y, 300) + 8 * f.soilK;
  }
}

// ---- colours --------------------------------------------------------------------------------------------------

/** Light (little) -> dark (a lot). The lightest tint stays visible on aerial imagery. */
export const tint = (c: Cond, sev: number) => `hsl(${c.hue}, ${c.sat}%, ${Math.round(80 - 54 * Math.min(1, Math.max(0, sev)))}%)`;
export const NEUTRAL = "#E2B866";

export type PlotCond = { fieldId: string; value: number; sev: number; colour: string };
export type CondView = {
  cond: Cond;
  year: number;
  plots: PlotCond[];
  /** Real range of the raw numbers over years 1..10 (the colour scale spans it). */
  min: number;
  max: number;
  /** Farm average per year, years 1..10, as raw numbers. */
  series: number[];
  zones: { fieldId: string; ring: Ring; colour: string; sev: number }[];
};

export function conditionView(cond: Cond, feats: PlotFeat[], ctx: Ctx, year: number): CondView {
  const years = Array.from({ length: 10 }, (_, i) => i + 1);
  const grid = feats.map((f) => years.map((y) => raw(cond.id, f, y, ctx)));
  const flat = grid.flat();
  const min = Math.min(...flat), max = Math.max(...flat);
  // Blend of the farm-wide scale (plots compare) and each plot's own 10-year scale (every plot visibly changes per year,
  // even when one outlier field stretches the farm-wide range).
  const norm = (v: number, lo: number, hi: number) => { const k = (v - lo) / (hi - lo || 1); return cond.invert ? 1 - k : k; };
  const sevAt = (i: number, yi: number) => {
    const row = grid[i];
    return 0.35 * norm(row[yi], min, max) + 0.65 * norm(row[yi], Math.min(...row), Math.max(...row));
  };
  const yi = Math.min(10, Math.max(1, year)) - 1;
  const plots = feats.map((f, i) => ({ fieldId: f.id, value: grid[i][yi], sev: sevAt(i, yi), colour: tint(cond, sevAt(i, yi)) }));
  const series = years.map((_, k) => grid.reduce((a, g) => a + g[k], 0) / (grid.length || 1));
  const zones = cond.zones ? plots.filter((p) => p.sev >= 0.2).map((p) => ({ fieldId: p.fieldId, ring: zoneRing(feats.find((f) => f.id === p.fieldId)!, cond.id), colour: tint(cond, Math.min(1, p.sev + 0.15)), sev: p.sev })) : [];
  return { cond, year: yi + 1, plots, min, max, series, zones };
}

/** A hotspot patch: the plot ring pulled toward its riskiest corner. */
function zoneRing(f: PlotFeat, c: CondId): Ring {
  const score = (p: [number, number]) => (c === "frostPocket" ? -p[1] : c === "erosion" ? p[0] : p[1] * 0.5 + p[0] * 0.5);
  const corner = f.ring.reduce((b, p) => (score(p) > score(b) ? p : b), f.ring[0]);
  return f.ring.map(([x, y]) => [corner[0] + (x - corner[0]) * 0.55, corner[1] + (y - corner[1]) * 0.55] as [number, number]);
}
