import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer } from "./shared";

// Static: progress is ignored.
export const floodZones: GroundEvaluator = (run) => {
  const levelM = Math.min(2, Math.max(0, input(run, "water_level_m")));
  return [layer(run, "flood-zones", "floodZones", levelM / 2, { opacity: clamp01(0.5 + 0.1 * levelM), params: { levelM } })];
};
