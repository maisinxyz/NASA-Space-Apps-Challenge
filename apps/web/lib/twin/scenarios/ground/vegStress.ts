import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, cropCoverLayer, fieldIds, input, isGrowing, layer } from "./shared";

/** Normal greenness over the year: spring rise, summer peak, autumn fall (illustrative curve, t in months 0..12). */
export const normalGreen = (t: number): number => 0.3 + 0.7 * Math.max(0, Math.sin((Math.PI * (t - 2)) / 9));
/** Where stress bites: a 5-month bump starting at `startMonth` (1 = Jan), peaking mid-bump. */
const stressShape = (t: number, startMonth: number): number => Math.sin(Math.PI * clamp01((t - (startMonth - 1)) / 5));

/**
 * Only growing fields are tinted by stress. Bare fields get vegetation 0 (= "not rated": the renderer must skip it,
 * see the shader note in the progress report) plus a plain bare-brown cropCover underneath.
 */
export const vegStress: GroundEvaluator = (run) => {
  const t = clamp01(run.progress) * 12;
  const month = Math.min(11, Math.floor(t));
  const sev = clamp01(input(run, "stress_severity") / 100);
  const start = input(run, "stress_start_month");
  const normal = normalGreen(t);
  const byField: Record<string, number> = {};
  const params: Record<string, number> = {};
  for (const id of fieldIds(run.farmId)) {
    const growing = isGrowing(cropAt(run.farmId, run.rotationId, id, 0, month));
    const g = growing ? Math.max(0.02, normal * (1 - sev * stressShape(t, start))) : 0;
    byField[id] = g;
    params[`delta_${id}`] = growing ? Math.max(-1, Math.min(1, g - normal)) : 0;
  }
  return [
    cropCoverLayer(run, 0, month, { only: (c) => !isGrowing(c) }),
    layer(run, "veg-stress", "vegetation", normal * (1 - sev * stressShape(t, start)), { opacity: 0.8, byField, params }),
  ];
};
