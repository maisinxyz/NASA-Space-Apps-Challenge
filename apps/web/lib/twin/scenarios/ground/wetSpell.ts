import type { GroundEvaluator, ScenarioRun } from "../../scenario";
import { WET_SPELL_DAYS as DAYS, wetSpellRainy } from "../atmosphere/evaluators";
import { clamp01, input, layer, smoothstep } from "./shared";

/** ASSUMED threshold (basis "assumed"): modeled wetness above this counts as too wet to work the field. Not a measurement. */
export const TOO_WET = 0.7;
const DRY = 0.15;

/**
 * Modeled wetness 0..1 at progress p, day by day on the sky's rain pattern (wetSpellRainy): rainy days soak toward a
 * saturation target, dry days drain slowly back. Assumed shape, not data.
 */
export function wetAt(run: ScenarioRun, p: number): number {
  const perWeek = input(run, "rain_days_per_week");
  const target = clamp01(0.2 + 0.55 * clamp01(input(run, "wetness") / 100) + 0.3 * clamp01(perWeek / 7));
  const t = clamp01(p) * DAYS;
  let w = DRY;
  for (let d = 0; d < t; d++) {
    const dt = Math.min(1, t - d);
    w = wetSpellRainy(d, perWeek) ? w + (target - w) * (1 - Math.exp(-0.6 * dt)) : w - (w - DRY) * (1 - Math.exp(-0.15 * dt));
  }
  return w;
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
