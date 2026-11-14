import type { GroundEvaluator } from "../../scenario";
import { frostTiming } from "../atmosphere/evaluators";
import { clamp01, input, layer } from "./shared";

export type FrostLevel = "light" | "moderate" | "hard";

/**
 * Frost severity from the night's minimum air temperature (basis "derived", temperature only). Thresholds:
 * light -2.2 < T <= 0 °C, moderate -4.4 < T <= -2.2 °C, hard T <= -4.4 °C (Koss et al. 1988, NOAA, via WRCC:
 * https://wrcc-archive.dri.edu/Climate/Education/freeze_frost.php). Caveat: how long it stays that cold is not modeled.
 */
export function frostLevel(minTempC: number): FrostLevel {
  if (minTempC <= -4.4) return "hard";
  if (minTempC <= -2.2) return "moderate";
  return "light";
}
const LEVEL_PARAM: Record<FrostLevel, number> = { light: 0, moderate: 0.5, hard: 1 };

// Layer params: lowSpotBias 0..1 (extra frost in low spots when relief is known), level 0 / 0.5 / 1 (light/moderate/hard).
export const frost: GroundEvaluator = (run) => {
  const level = frostLevel(input(run, "min_temp_c"));
  // Extent over the fields: more hours below 0 °C = more of each field white (assumed shape).
  const extent = 0.45 + 0.55 * clamp01(input(run, "hours_below_0") / 12);
  // Same clock as the sky: frost forms before each 06:00 sunrise and thaws after it.
  const f = frostTiming(run.progress, input(run, "hours_below_0")) * extent;
  return [layer(run, "frost", "frost", f, { opacity: 1, params: { lowSpotBias: 1, level: LEVEL_PARAM[level] } })];
};
