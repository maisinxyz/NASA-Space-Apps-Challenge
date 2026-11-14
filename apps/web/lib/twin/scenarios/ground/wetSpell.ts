import type { GroundEvaluator, ScenarioRun } from "../../scenario";
import { clamp01, input, layer, smoothstep } from "./shared";

const DAYS = 28; // matches clock.ts (wet-spell = 28 daily steps)
/** ASSUMED threshold (basis "assumed"): modeled wetness above this counts as too wet to work the field. Not a measurement. */
export const TOO_WET = 0.7;

/** Modeled wetness 0..1 at progress p: rises toward a saturation target over weeks. Assumed shape, not data. */
export function wetAt(run: ScenarioRun, p: number): number {
  const rd = clamp01(input(run, "rain_days_per_week") / 7);
  const target = clamp01(0.1 + 0.6 * clamp01(input(run, "wetness") / 100) + 0.5 * rd);
  const rate = 0.05 + 0.1 * rd;
  return 0.15 + (target - 0.15) * (1 - Math.exp(-rate * clamp01(p) * DAYS));
}

/** Days so far (of 28) where modeled wetness exceeds the assumed TOO_WET threshold. */
export function tooWetDays(run: ScenarioRun): number {
  const n = Math.floor(clamp01(run.progress) * DAYS);
  let c = 0;
  for (let d = 1; d <= n; d++) if (wetAt(run, d / DAYS) > TOO_WET) c++;
  return c;
}

export const wetSpell: GroundEvaluator = (run) => {
  const w = wetAt(run, run.progress);
  const sheen = smoothstep(TOO_WET, 0.95, w);
  return [
    layer(run, "wet-spell-wetness", "wetness", w),
    layer(run, "wet-spell-water", "water", sheen, { opacity: 0.6, params: { lowSpotOnly: 1, ripples: 0.2 * sheen } }),
  ];
};
