import type { GroundEvaluator, ScenarioRun } from "../../scenario";
import { clamp01, cropAt, cropCoverLayer, fieldIds, input, layer } from "./shared";

/** Year index and month (0..11) shown for a run; also used by the legend so both agree. */
export function multiYearPos(run: ScenarioRun): { years: number; yi: number; month: number; pos: number } {
  const years = Math.max(1, Math.round(input(run, "years")));
  const pos = clamp01(run.progress) * years;
  const yi = Math.min(years - 1, Math.floor(pos));
  return { years, yi, month: Math.min(11, Math.floor((pos - yi) * 12)), pos };
}

export const multiYear: GroundEvaluator = (run) => {
  const { years, yi, month, pos } = multiYearPos(run);
  // What-if: this share of otherwise bare months gets a cover crop. Relative organic-matter build-up only (the map still shows the rotation as planned).
  const share = clamp01(input(run, "cover_crop_share") / 100);
  const upto = Math.min(years * 12, Math.floor(pos * 12) + 1); // months seen so far, current included
  const ids = fieldIds(run.farmId);
  const byField: Record<string, number> = {};
  let markers = 0;
  for (const id of ids) {
    let n = 0;
    for (let k = 0; k < upto; k++) {
      const c = cropAt(run.farmId, run.rotationId, id, Math.floor(k / 12), k % 12);
      if (c === "legume" || c === "cover") n++;
      else if (c === "bare") n += share;
    }
    byField[id] = n / (years * 12); // relative, normalized by the most cover/legume months possible
    const now = cropAt(run.farmId, run.rotationId, id, yi, month);
    if (now === "legume" || now === "cover") markers = 1;
  }
  const mean = ids.length ? Object.values(byField).reduce((a, b) => a + b, 0) / ids.length : 0;
  return [cropCoverLayer(run, yi, month), layer(run, "organic-matter", "organicMatter", mean, { opacity: 0.6, byField, params: { markers } })];
};
