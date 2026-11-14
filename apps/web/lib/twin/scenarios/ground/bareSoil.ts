import { ATMOSPHERE } from "../atmosphere";
import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, cropCoverLayer, fieldIds, layer, perField } from "./shared";

export const monthOf = (p: number): number => Math.min(11, Math.floor(clamp01(p) * 12));

export const bareSoil: GroundEvaluator = (run) => {
  const month = monthOf(run.progress);
  const out = [cropCoverLayer(run, 0, month)];
  const rain = ATMOSPHERE["bare-soil"](run).rainRateMmH;
  const bare = perField(run, (id) => (cropAt(run.farmId, run.rotationId, id, 0, month) === "bare" ? 1 : 0));
  if (rain > 0 && fieldIds(run.farmId).some((id) => bare[id] === 1)) {
    const s = clamp01(rain / 50);
    out.push(layer(run, "bare-soil-water", "water", s, { byField: bare, params: { lowSpotOnly: 0, ripples: s } }));
    out.push(layer(run, "bare-soil-runoff", "runoff", s, { byField: bare, params: { flow: s } }));
  }
  return out;
};
