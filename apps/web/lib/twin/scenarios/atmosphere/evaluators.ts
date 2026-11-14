// Sky/air evaluators for the scenarios with a weather look. Pure and deterministic: same ScenarioRun -> same state.
// Every value here is a MOOD choice (illustrative weather effect), except rainRateMmH, which follows the user's
// rain-rate input. Nothing here is a measurement or a prediction.
import { type AtmosphereState, CLEAR_SKY } from "@/components/globe/types";

import type { AtmosphereEvaluator, ScenarioRun } from "../../scenario";

/** A state plus an optional "today" baseline (climate shift only); the engine may draw the baseline left of the A/B split. */
export type AtmosphereWithBaseline = AtmosphereState & { baseline?: AtmosphereState };

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
  return sky({
    cloudCover: lerp(0.2, 1, build),
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

/** Wet spell: 28 days, rainy days spread over each week (day d is rainy when (3d mod 7) < rainy days per week). */
export const wetSpell: AtmosphereEvaluator = (run) => {
  const days = 28;
  const perWeek = input(run, "rain_days_per_week", 4);
  const wet = input(run, "wetness", 70) / 100;
  const t = clamp01(run.progress) * days;
  const rainy = (d: number) => ((3 * d) % 7 < perWeek ? 1 : 0);
  const d = Math.min(days - 1, Math.floor(t));
  const f = t - d;
  // Ease between days so drizzle does not switch on and off in one frame.
  const r = lerp(rainy(d), rainy(Math.min(days - 1, d + 1)), smooth(0.8, 1, f));
  return sky({
    cloudCover: lerp(0.7, 1, r),
    cloudDarkness: lerp(0.35, 0.6, r),
    drizzle: lerp(0.12, 0.75, r),
    fog: lerp(0.2, 0.65, wet),
    sunIntensity: lerp(0.8, 0.62, r),
    tint: [0.82, 0.86, 0.9, 0.3],
    timeOfDayHours: 8.5,
    windSlantDeg: 6,
  });
};

/** Drought: clear, hard sun; dust haze and heat shimmer rise over the weeks. */
export const drought: AtmosphereEvaluator = (run) => {
  const p = clamp01(run.progress);
  const length = clamp01((input(run, "dry_spell_days", 42) - 14) / (91 - 14)); // longer spell, harsher end state
  const k = smooth(0, 1, p) * lerp(0.6, 1, length);
  return sky({
    cloudCover: 0.08 * (1 - p),
    haze: lerp(0.08, 0.6, k),
    heatShimmer: lerp(0, 0.7, k),
    sunIntensity: lerp(1.25, 1.45, k),
    tint: [1, 0.86, 0.66, lerp(0.1, 0.4, k)],
    timeOfDayHours: 13,
  });
};

/** Heat wave: warm orange grade, haze and shimmer build to the peak day (about 65 % through) and ease a little after. */
export const heatWave: AtmosphereEvaluator = (run) => {
  const p = clamp01(run.progress);
  const strength = lerp(0.45, 1, clamp01((input(run, "temp_anomaly_c", 6) - 2) / 10));
  const b = (p <= 0.65 ? smooth(0, 0.65, p) : 1 - 0.3 * smooth(0.65, 1, p)) * strength;
  return sky({
    haze: lerp(0.05, 0.55, b),
    heatShimmer: lerp(0, 0.85, b),
    sunIntensity: lerp(1.2, 1.5, b),
    tint: [1, 0.7, 0.42, lerp(0.12, 0.5, b)],
    timeOfDayHours: 14,
  });
};

/**
 * Frost: the 48-hour clock starts at 18:00, so it shows two nights and two dawns. Frost sparkle builds over the
 * hours below freezing before sunrise (06:00) and thaws within about 1.5 h after it. Colder minimum = stronger.
 */
export const frost: AtmosphereEvaluator = (run) => {
  const hourAbs = 18 + clamp01(run.progress) * 48;
  const hour = hourAbs % 24;
  const below = input(run, "hours_below_0", 6);
  const cold = lerp(0.4, 1, clamp01(-input(run, "min_temp_c", -4) / 10));
  // Hours relative to the nearest sunrise (06:00): negative before, positive after.
  const rel = ((hourAbs - 6 + 12) % 24) - 12;
  const freezing = rel < 0 ? smooth(-below - 0.5, -below + 1, rel) : 1 - smooth(0, 1.5, rel);
  const night = 1 - smooth(5, 7.5, hour) * (1 - smooth(16.5, 19, hour));
  return sky({
    frostSparkle: clamp01(freezing * cold),
    fog: 0.25 * freezing,
    sunIntensity: lerp(1, 0.75, night),
    tint: [0.72, 0.84, 1, lerp(0.15, 0.45, Math.max(night, freezing * 0.8))],
    timeOfDayHours: hour,
  });
};

/** Climate shift, one side: a 48 h storm (an assumed 30 mm/h peak, scaled by the rain change) in a warmer, drier world. */
const SHIFT_BASE_PEAK_MM_H = 30; // assumed reference storm for the what-if; the real reference storm comes from the backend
function shiftedSky(p: number, rainPct: number, dryPct: number, tempC: number): AtmosphereState {
  const base = stormSky(stormCurve(p), SHIFT_BASE_PEAK_MM_H * (1 + rainPct / 100), p);
  const warm = clamp01(tempC / 6);
  const dry = clamp01(dryPct / 50);
  const wetter = clamp01(rainPct / 50);
  const tintW = Math.max(0, warm) * 0.35;
  return {
    ...base,
    cloudCover: clamp01(base.cloudCover * (1 + 0.25 * wetter - 0.2 * dry)),
    cloudDarkness: clamp01(base.cloudDarkness + 0.1 * wetter),
    haze: clamp01(0.08 + 0.35 * dry + 0.2 * warm) * (1 - stormCurve(p)),
    heatShimmer: 0.45 * warm * (1 - smooth(0.05, 0.3, stormCurve(p))),
    sunIntensity: Math.min(1.5, base.sunIntensity + 0.15 * warm),
    tint: tintW > base.tint[3] ? [1, 0.78, 0.55, tintW] : base.tint,
  };
}

/** Climate shift: the state responds live to the sliders; `baseline` is the same storm with every slider at 0 ("today"). */
export const climateShift: AtmosphereEvaluator = (run): AtmosphereWithBaseline => {
  const p = clamp01(run.progress);
  return {
    ...shiftedSky(p, input(run, "rain_change_pct", 20), input(run, "dry_spell_change_pct", 20), input(run, "temp_shift_c", 2)),
    baseline: shiftedSky(p, 0, 0, 0),
  };
};

/** Where the compound run hands off from the dry phase to the storm (progress 0..1). Shared with the ground layers. */
export const compoundHandoff = (phase1Days: number) => phase1Days / (phase1Days + 3);

/** Dry spell, then storm: sun and haze, then clouds roll in over ~a third of a day, then a hard storm on the last 3 days. */
export const compound: AtmosphereEvaluator = (run) => {
  const p = clamp01(run.progress);
  const h = compoundHandoff(input(run, "phase1_days", 14));
  const dryK = smooth(0, h, p);
  const dry = sky({
    cloudCover: 0.05,
    haze: lerp(0.1, 0.5, dryK),
    heatShimmer: lerp(0.05, 0.55, dryK),
    sunIntensity: lerp(1.25, 1.45, dryK),
    tint: [1, 0.84, 0.62, lerp(0.15, 0.4, dryK)],
    timeOfDayHours: 14,
  });
  const q = clamp01((p - h) / (1 - h)); // storm phase progress
  const wet = stormSky(stormCurve(0.05 + 0.9 * q), input(run, "storm_peak_mm_h", 50), 0.25 + 0.75 * q);
  const mix = smooth(h - 0.02, h + 0.02, p); // visible hand-off
  if (mix <= 0) return dry;
  if (mix >= 1) return wet;
  const m = (k: keyof AtmosphereState) => lerp(dry[k] as number, wet[k] as number, mix);
  return {
    cloudCover: Math.max(m("cloudCover"), mix), // clouds lead the hand-off
    cloudDarkness: m("cloudDarkness"),
    rainRateMmH: wet.rainRateMmH * mix,
    drizzle: 0,
    lightning: 0,
    fog: m("fog"),
    haze: m("haze"),
    heatShimmer: m("heatShimmer"),
    frostSparkle: 0,
    sunIntensity: m("sunIntensity"),
    tint: [lerp(dry.tint[0], wet.tint[0], mix), lerp(dry.tint[1], wet.tint[1], mix), lerp(dry.tint[2], wet.tint[2], mix), lerp(dry.tint[3], wet.tint[3], mix)],
    timeOfDayHours: lerp(dry.timeOfDayHours, wet.timeOfDayHours, mix),
    windSlantDeg: m("windSlantDeg"),
  };
};

/** Calm neutral sky for the ground-only scenarios. */
export const calm: AtmosphereEvaluator = () => CLEAR_SKY;
