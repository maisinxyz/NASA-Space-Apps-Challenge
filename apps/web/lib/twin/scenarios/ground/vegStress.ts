import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, fieldIds, input, isGrowing, layer } from "./shared";

/** Normal greenness over the year: spring rise, summer peak, autumn fall (illustrative curve, t in months 0..12). */
export const normalGreen = (t: number): number => 0.3 + 0.7 * Math.max(0, Math.sin((Math.PI * (t - 2)) / 9));
/** Where stress bites: peaks in midsummer. */
const stressShape = (t: number): number => Math.sin(Math.PI * clamp01((t - 4) / 5));

export const vegStress: GroundEvaluator = (run) => {
  const t = clamp01(run.progress) * 12;
  const month = Math.min(11, Math.floor(t));
  const sev = clamp01(input(run, "stress_severity") / 100);
  const normal = normalGreen(t);
  const byField: Record<string, number> = {};
  const params: Record<string, number> = {};
  for (const id of fieldIds(run.farmId)) {
    const growing = isGrowing(cropAt(run.farmId, run.rotationId, id, 0, month));
    const g = growing ? normal * (1 - sev * stressShape(t)) : 0.2;
    byField[id] = g;
    params[`delta_${id}`] = growing ? Math.max(-1, Math.min(1, g - normal)) : 0;
  }
  return [layer(run, "veg-stress", "vegetation", normal * (1 - sev * stressShape(t)), { opacity: 0.8, byField, params })];
};
