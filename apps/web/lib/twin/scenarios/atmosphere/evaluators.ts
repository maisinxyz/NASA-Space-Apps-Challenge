// Sky/air evaluators for the scenarios with a weather look. Pure and deterministic: same ScenarioRun -> same state.
// Every value here is a MOOD choice (illustrative weather effect), except the storm's rainRateMmH, which follows the
// user's rain-rate input (the wet spell's rate is an assumed mood value). Nothing here is a measurement or a prediction.
import { type AtmosphereState, CLEAR_SKY } from "@/components/globe/types";

import type { AtmosphereEvaluator, ScenarioRun } from "../../scenario";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const input = (run: ScenarioRun, id: string, fallback: number) => (Number.isFinite(run.inputs[id]) ? run.inputs[id] : fallback);
const sky = (over: Partial<AtmosphereState>): AtmosphereState => ({ ...CLEAR_SKY, ...over });

/**
 * Storm rain curve (0..1 of the peak) over the storm's progress: dry at the start, peak at ~45 %, easing off and dry
 * again near the end. Shared shape: the ground layers can use the same curve so water follows the rain.
 */
export function stormCurve(p: number): number {
  const s = clamp01((p - 0.05) / 0.88);
  const a = 1.6;
  const b = 2.0;
  const peakAt = a / (a + b);
  const max = peakAt ** a * (1 - peakAt) ** b;
  return clamp01((s ** a * (1 - s) ** b) / max);
}

/** Storm sky for a rain curve value c (0..1) and the peak rain rate in mm/h. */
function stormSky(c: number, peakMmH: number, p: number): AtmosphereState {
  // Clouds arrive before the rain and leave after it.
  const build = Math.max(c, smooth(0, 0.25, p) * (1 - smooth(0.85, 1, p)) * 0.75);
  // The weather shader only rains under cloud: cover is >= ~0.76 for the whole rainy part (p 0.05..0.93).
  const deck = Math.max(build, 0.7 * smooth(0, 0.05, p) * (1 - smooth(0.93, 1, p)));
  return sky({
    cloudCover: lerp(0.2, 1, deck),
    cloudDarkness: lerp(0.1, 0.9, build),
    rainRateMmH: Number((peakMmH * c).toFixed(3)),
    lightning: smooth(0.6, 0.95, c) * clamp01(peakMmH / 40),
    fog: 0.15 * c,
    haze: 0,
    sunIntensity: lerp(1, 0.55, build),
    tint: [0.78, 0.84, 0.92, 0.35 * build],
    timeOfDayHours: 15,
    windSlantDeg: 4 + 14 * c,
  });
}

export const storm: AtmosphereEvaluator = (run) => stormSky(stormCurve(run.progress), input(run, "peak_rain_mm_h", 40), run.progress);

export const WET_SPELL_DAYS = 28;
/**
 * Wet-spell rain pattern, shared with the ground layer (ground/wetSpell.ts) so wetness follows the same days.
 * Exactly `perWeek` rainy days in each week, spread out; day 0 is dry unless perWeek >= 5 (the spell builds up).
 */
export const wetSpellRainy = (d: number, perWeek: number): boolean => (3 * (d + 6)) % 7 < perWeek;
/** ASSUMED mood rain rate on a rainy day of the wet spell, mm/h (steady moderate rain). Not data. */
const WET_SPELL_RAIN_MM_H = 4;

/** Wet spell: 28 days. Day 1 starts with few clouds that build; cloud, rain and drizzle follow each day's rain. */
export const wetSpell: AtmosphereEvaluator = (run) => {
  const days = WET_SPELL_DAYS;
  const perWeek = input(run, "rain_days_per_week", 4);
  const wet = input(run, "wetness", 70) / 100;
  const t = clamp01(run.progress) * days;
  const rainy = (d: number) => (wetSpellRainy(d, perWeek) ? 1 : 0);
  const d = Math.min(days - 1, Math.floor(t));
  const f = t - d;
  // Ease between days so rain does not switch on and off in one frame.
  const pattern = lerp(rainy(d), rainy(Math.min(days - 1, d + 1)), smooth(0.6, 1, f));
  const build = smooth(0, 1, t); // day 1: clouds build from a near-clear sky
  const r = pattern * smooth(0.4, 1, t); // no rain before the deck has built
  return sky({
    // Rain only falls under cloud in the weather shader: rainy = full deck.
    cloudCover: lerp(0.15, lerp(0.55, 1, pattern), build),
    cloudDarkness: lerp(0.2, lerp(0.35, 0.65, pattern), build),
    rainRateMmH: Number((WET_SPELL_RAIN_MM_H * r).toFixed(3)),
    drizzle: lerp(0.05, 0.6, r),
    fog: lerp(0.2, 0.65, wet) * lerp(0.4, 1, build),
    sunIntensity: lerp(0.9, lerp(0.8, 0.62, pattern), build),
    tint: [0.82, 0.86, 0.9, 0.3 * build],
    timeOfDayHours: 8.5,
    windSlantDeg: 6,
  });
};

/**
 * Drought: dusty, desaturated ochre haze under a low afternoon sun, almost no shimmer (heat wave owns the glare).
 * The grade stays light (tint alpha <= 0.22) so the bold field key on the ground is not washed out.
 */
export const drought: AtmosphereEvaluator = (run) => {
  const p = clamp01(run.progress);
  const length = clamp01((input(run, "dry_spell_days", 42) - 14) / (91 - 14)); // longer spell, harsher end state
  const k = smooth(0, 1, p) * lerp(0.6, 1, length);
  return sky({
    cloudCover: 0.08 * (1 - p),
    haze: lerp(0.12, 0.5, k),
    heatShimmer: lerp(0, 0.12, k),
    sunIntensity: lerp(1.05, 1.15, k),
    tint: [0.9, 0.82, 0.64, lerp(0.08, 0.22, k)],
    timeOfDayHours: 16,
  });
};

/**
 * Heat wave: orange-white glare under a high sun, strong shimmer, hot hazy sky; builds to the peak day (about 65 %
 * through) and eases a little after. Tint alpha <= 0.3 so the field heat key stays bold.
 */
export const heatWave: AtmosphereEvaluator = (run) => {
  const p = clamp01(run.progress);
  const strength = lerp(0.45, 1, clamp01((input(run, "temp_anomaly_c", 6) - 2) / 10));
  const b = (p <= 0.65 ? smooth(0, 0.65, p) : 1 - 0.3 * smooth(0.65, 1, p)) * strength;
  return sky({
    haze: lerp(0.05, 0.35, b),
    heatShimmer: lerp(0.1, 1, b),
    sunIntensity: lerp(1.25, 1.5, b),
    tint: [1, 0.8, 0.56, lerp(0.1, 0.3, b)],
    timeOfDayHours: 13,
  });
};

/**
 * Frost timing 0..1 at progress p, shared with the ground layer (ground/frost.ts). The 48-hour clock starts at
 * 18:00, so it shows two nights and two dawns (06:00 on day 2 and day 3). Frost builds over the hours below freezing
 * before each sunrise (never before ~20:00) and thaws over ~2.5 h after it.
 */
export function frostTiming(p: number, hoursBelow: number): number {
  const hourAbs = 18 + clamp01(p) * 48;
  // Hours relative to the nearest sunrise (06:00): negative before, positive after.
  const rel = ((hourAbs - 6 + 12) % 24) - 12;
  const onset = Math.min(Math.max(hoursBelow, 1), 10);
  return rel < 0 ? smooth(-onset - 1, -onset + 1, rel) : 1 - smooth(0, 2.5, rel);
}

/** Frost: two nights and two dawns; frost sparkle follows frostTiming. Colder minimum = stronger. */
export const frost: AtmosphereEvaluator = (run) => {
  const hour = (18 + clamp01(run.progress) * 48) % 24;
  const cold = lerp(0.4, 1, clamp01(-input(run, "min_temp_c", -4) / 10));
  const freezing = frostTiming(run.progress, input(run, "hours_below_0", 6));
  // Wide dawn/dusk ramps (~4 h) so the light never jumps at sunrise.
  const night = 1 - smooth(4.5, 8.5, hour) * (1 - smooth(16, 20, hour));
  return sky({
    frostSparkle: clamp01(freezing * cold),
    fog: 0.25 * freezing,
    sunIntensity: lerp(1, 0.75, night),
    tint: [0.72, 0.84, 1, lerp(0.15, 0.45, Math.max(night, freezing * 0.8))],
    timeOfDayHours: hour,
  });
};

/** Calm neutral sky for the ground-only scenarios. */
export const calm: AtmosphereEvaluator = () => CLEAR_SKY;
