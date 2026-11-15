// Pure read model for Future / Compare modes. Every number the UI shows comes from here, computed from the
// synthetic fixtures + the clock + the what-if offsets. Deterministic: same inputs → same outputs.
import {
  BASELINE, FIELD_FUTURE, FIRST_YEAR, GROUNDWATER_CM, STRATEGIES, WATER_BALANCE_2026, YEAR_COUNT,
  type Strategy, type StrategyId,
} from "./fixtures";

export type WhatIf = { rainPct: number; tempC: number };
export const NO_WHAT_IF: WhatIf = { rainPct: 0, tempC: 0 };
export const whatIfActive = (w: WhatIf) => w.rainPct !== 0 || w.tempC !== 0;

/** Clock position: years since 1 Jan 2026, 0 … 10 (10 = 31 Dec 2035). */
export type ClockT = number;
export const T_MAX = YEAR_COUNT;
export const clampT = (t: number) => Math.min(T_MAX - 1e-6, Math.max(0, t));

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_STARTS = MONTH_DAYS.reduce<number[]>((a, _d, i) => (i ? [...a, a[i - 1] + MONTH_DAYS[i - 1]] : [0]), []);
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type ClockDate = { yearIndex: number; year: number; doy: number; month: number; monthName: string; day: number };

export function dateAt(t: ClockT): ClockDate {
  const c = clampT(t);
  const yearIndex = Math.floor(c);
  const doy = Math.min(364, Math.floor((c - yearIndex) * 365 + 1e-6));
  let month = 11;
  for (let i = 0; i < 12; i++) if (doy < MONTH_STARTS[i] + MONTH_DAYS[i]) { month = i; break; }
  return { yearIndex, year: FIRST_YEAR + yearIndex, doy, month, monthName: MONTH_NAMES[month], day: doy - MONTH_STARTS[month] + 1 };
}
export const tOf = (yearIndex: number, doy: number) => yearIndex + doy / 365;
/** Start of month m (0–11) of a year, as clock t. */
export const monthStartT = (yearIndex: number, month: number) => yearIndex + MONTH_STARTS[month] / 365;
export const monthOfFraction = (f: number) => (f * 365) / 30.4167; // fractional month index in a year

/** Linear interpolation of a per-year series at fractional t (value of year i sits at t = i + 0.5). */
export function seriesAt(series: readonly number[], t: ClockT) {
  const x = Math.min(series.length - 1, Math.max(0, clampT(t) - 0.5));
  const i = Math.floor(x);
  const f = x - i;
  return series[i] + (series[Math.min(series.length - 1, i + 1)] - series[i]) * f;
}

const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/** Headline conditions for the pills, for the clock year, with what-if applied. Deltas are vs 2026. */
export function conditionsAt(t: ClockT, w: WhatIf) {
  const rain = seriesAt(BASELINE.rainMm, t) * (1 + w.rainPct / 100);
  const heat = seriesAt(BASELINE.heatDays, t) + w.tempC * 4.5;
  const frostFree = seriesAt(BASELINE.frostFreeDays, t) + w.tempC * 9;
  const moisture = seriesAt(BASELINE.julyMoisturePct, t) - w.tempC * 1.2 + w.rainPct * 0.25;
  return {
    rainMm: round(rain), rainDeltaPct: round((rain / BASELINE.rainMm[0] - 1) * 100),
    heatDays: round(heat), heatDelta: round(heat - BASELINE.heatDays[0]),
    frostFreeDays: round(frostFree), frostFreeDelta: round(frostFree - BASELINE.frostFreeDays[0]),
    moisturePct: round(moisture), moistureDelta: round(moisture - BASELINE.julyMoisturePct[0]),
    tempAnomalyC: round(seriesAt(BASELINE.tempAnomalyC, t) + w.tempC, 1),
  };
}

/** p10 / p50 / p90 of July root-zone moisture; the spread widens with every year out. */
export function moistureBand(t: ClockT, w: WhatIf) {
  const p50 = conditionsAt(t, w).moisturePct;
  const yearsOut = clampT(t);
  return { p10: round(p50 - (1 + 0.65 * yearsOut)), p50, p90: round(p50 + (1 + 0.9 * yearsOut)) };
}

/** Growing-season water balance, mm. */
export function waterBalanceAt(t: ClockT, w: WhatIf) {
  const yi = clampT(t);
  const rain = WATER_BALANCE_2026.rain * (1 - 0.0095 * yi) * (1 + w.rainPct / 100);
  const cropUse = WATER_BALANCE_2026.cropUse * (1 + 0.0072 * yi) * (1 + 0.035 * w.tempC);
  const runoff = WATER_BALANCE_2026.runoff * (1 + 0.012 * yi) * (1 + Math.max(0, w.rainPct) / 100);
  const irrigation = WATER_BALANCE_2026.irrigation;
  return { rain: round(rain), irrigation, cropUse: round(cropUse), runoff: round(runoff), net: round(rain + irrigation - cropUse - runoff) };
}

export const groundwaterSeries = () => [...GROUNDWATER_CM];

/** Soil-moisture anomaly vs 2026 for a field, points of field capacity. */
export function fieldAnomaly(fieldId: string, t: ClockT, w: WhatIf) {
  const f = FIELD_FUTURE.find((x) => x.id === fieldId);
  if (!f) return 0;
  const scale = clampT(t) / (T_MAX - 1);
  return round(f.moistureAnomalyPts * scale - w.tempC * 1.2 + w.rainPct * 0.25);
}

export const strategyById = (id: StrategyId): Strategy => STRATEGIES.find((s) => s.id === id) ?? STRATEGIES[0];

/** Score in 2035 under the what-if (relative scale; the slider effect is scaled by each strategy's sensitivity). */
export function scoreWithWhatIf(s: Strategy, w: WhatIf) {
  return Math.round(s.score2035 + (w.rainPct * 0.45 - w.tempC * 1.0) * s.sensitivity);
}
/** Score at clock t: ramps from 50 (shared 2026 start) to the 2035 value. */
export function scoreAt(s: Strategy, t: ClockT, w: WhatIf) {
  const end = scoreWithWhatIf(s, w);
  return Math.round(50 + (end - 50) * (clampT(t) / (T_MAX - 1)));
}
export function waterQuotaAt(s: Strategy, t: ClockT, w: WhatIf) {
  const f = clampT(t) / (T_MAX - 1);
  return Math.round((90 + (s.waterQuotaPct2035 - 90) * f) * (1 - w.rainPct / 200) * (1 + 0.04 * w.tempC));
}
export function leaderboard(t: ClockT, w: WhatIf) {
  return STRATEGIES.map((s) => ({ s, score: scoreAt(s, t, w) })).sort((a, b) => b.score - a.score);
}

export function soilHealthAt(s: Strategy, t: ClockT) {
  const yi = clampT(t);
  const om = s.omStart + s.omPerYear * yi;
  const infiltration = s.infiltrationPct.start + s.infiltrationPct.perYear * yi;
  const depthsCm = [0, 20, 40, 60, 80, 100];
  const shape = [1, 0.78, 0.56, 0.37, 0.23, 0.18];
  return {
    omPct: round(om, 1), omChange: round(om - s.omStart, 1),
    infiltrationPct: round(infiltration), infiltrationChange: round(infiltration - s.infiltrationPct.start),
    rootDepthM: round(0.9 + 0.055 * yi * (s.id === "current" ? 0.2 : 1), 1),
    profile2026: depthsCm.map((d, i) => ({ d, v: s.omStart * shape[i] })),
    profileNow: depthsCm.map((d, i) => ({ d, v: om * shape[i] })),
    nitrogen: s.nitrogen,
    pest: s.pestPressure,
  };
}

/** Yearly rain-event bar heights and positions for the timeline (t, mm). */
export function rainEventsT(events: readonly { yearIndex: number; doy: number; mm: number }[]) {
  return events.map((e) => ({ t: tOf(e.yearIndex, e.doy), mm: e.mm }));
}

export const fmtSigned = (v: number, unit = "") => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}${unit}`;
