import type { GroundEvaluator } from "../../scenario";
import { clamp01, cropAt, fieldIds, input, isGrowing, layer, MID_SEASON_MONTH, perField, smoothstep } from "./shared";

/** Dryness 0..1 at progress p: longer dry spells on shallower soil dry further (assumed shape). */
export const droughtDryness = (dryDays: number, holdingMm: number, p: number): number =>
  clamp01(clamp01(p) * clamp01((dryDays * 3) / holdingMm / 1.5));

export const drought: GroundEvaluator = (run) => {
  const d = droughtDryness(input(run, "dry_spell_days"), input(run, "soil_water_holding"), run.progress);
  const cracks = smoothstep(0.5, 0.9, d);
  // The clock carries no month: growing fields are judged at mid-season (July), an assumption.
  const green = perField(run, (id) => (isGrowing(cropAt(run.farmId, run.rotationId, id, 0, MID_SEASON_MONTH)) ? 1 - 0.6 * d : 0.3));
  const delta = Object.fromEntries(fieldIds(run.farmId).map((id) => [`delta_${id}`, isGrowing(cropAt(run.farmId, run.rotationId, id, 0, MID_SEASON_MONTH)) ? green[id] - 1 : 0]));
  return [
    layer(run, "drought-dryness", "dryness", d, { opacity: 1, params: { cracks } }), // bold key: full opacity
    layer(run, "drought-vegetation", "vegetation", 1 - 0.6 * d, { opacity: 1, byField: green, params: delta }),
  ];
};
