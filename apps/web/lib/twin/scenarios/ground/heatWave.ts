import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, input, layer, MID_SEASON_MONTH, perField, smoothstep } from "./shared";

export const heatWave: GroundEvaluator = (run) => {
  const anomaly = clamp01(input(run, "temp_anomaly_c") / 12);
  const portion = 0.2 + 0.6 * clamp01(input(run, "duration_days") / 21); // longer waves ramp up more slowly
  const heat = anomaly * smoothstep(0, portion, run.progress);
  // clock.ts counts days, so it gives no month: sensitive crops are judged at mid-season (July), an assumption.
  const byField = perField(run, (id) => {
    const c = cropAt(run.farmId, run.rotationId, id, 0, MID_SEASON_MONTH);
    return c === "corn" || c === "cereal" ? heat : 0;
  });
  return [layer(run, "heat-glow", "heatGlow", heat, { opacity: 0.7, byField })];
};
