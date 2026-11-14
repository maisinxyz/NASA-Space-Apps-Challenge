import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, cropCoverLayer, fieldIds, input, layer } from "./shared";

export const multiYear: GroundEvaluator = (run) => {
  const years = Math.max(1, Math.round(input(run, "years")));
  const pos = clamp01(run.progress) * years;
  const yi = Math.min(years - 1, Math.floor(pos));
  const month = Math.min(11, Math.floor((pos - yi) * 12));
  const upto = Math.min(years * 12, Math.floor(pos * 12) + 1); // months seen so far, current included
  const ids = fieldIds(run.farmId);
  const byField: Record<string, number> = {};
  let markers = 0;
  for (const id of ids) {
    let n = 0;
    for (let k = 0; k < upto; k++) {
      const c = cropAt(run.farmId, run.rotationId, id, Math.floor(k / 12), k % 12);
      if (c === "legume" || c === "cover") n++;
    }
    byField[id] = n / (years * 12); // relative, normalized by the most cover/legume months possible
    const now = cropAt(run.farmId, run.rotationId, id, yi, month);
    if (now === "legume" || now === "cover") markers = 1;
  }
  const mean = ids.length ? Object.values(byField).reduce((a, b) => a + b, 0) / ids.length : 0;
  return [cropCoverLayer(run, yi, month), layer(run, "organic-matter", "organicMatter", mean, { opacity: 0.6, byField, params: { markers } })];
};
