import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer, smoothstep } from "./shared";

export const frost: GroundEvaluator = (run) => {
  const p = clamp01(run.progress);
  const sev = 0.2 + 0.8 * (0.6 * clamp01(-input(run, "min_temp_c") / 10) + 0.4 * clamp01(input(run, "hours_below_0") / 24));
  const f = smoothstep(0, 0.6, p) * sev * (1 - smoothstep(0.7, 0.95, p)); // deepens through the night, thaws after sunrise
  return [layer(run, "frost", "frost", f, { opacity: 0.85, params: { lowSpotBias: 1 } })];
};
