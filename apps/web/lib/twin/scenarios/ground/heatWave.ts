import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, input, isGrowing, layer, MID_SEASON_MONTH, perField, smoothstep } from "./shared";

/** ASSUMED relative heat stress on growing fields that are not corn or cereal (corn/cereal = 1). Not data. */
export const OTHER_CROP_HEAT = 0.6;

export const heatWave: GroundEvaluator = (run) => {
  const anomaly = clamp01(input(run, "temp_anomaly_c") / 12);
  const portion = 0.2 + 0.6 * clamp01(input(run, "duration_days") / 21); // longer waves ramp up more slowly
  const heat = anomaly * smoothstep(0, portion, run.progress);
  // Every growing field glows; heat-sensitive corn/cereal glow strongest. Bare fields: none.
  // clock.ts counts days, so it gives no month: crops are judged at mid-season (July), an assumption.
  const byField = perField(run, (id) => {
    const c = cropAt(run.farmId, run.rotationId, id, 0, MID_SEASON_MONTH);
    if (!isGrowing(c)) return 0;
    return c === "corn" || c === "cereal" ? heat : heat * OTHER_CROP_HEAT;
  });
  return [layer(run, "heat-glow", "heatGlow", heat, { opacity: 0.9, byField })];
};
