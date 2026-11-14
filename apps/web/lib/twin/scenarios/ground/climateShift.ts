import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer } from "./shared";

// Kept simple: a faint constant wetness (more rain) and/or dryness (longer dry spells). Shows nothing when both are <= 0.
export const climateShift: GroundEvaluator = (run) => {
  const rain = input(run, "rain_change_pct");
  const dry = input(run, "dry_spell_change_pct");
  const out = [];
  if (rain > 0) out.push(layer(run, "shift-wetness", "wetness", 0.1 + 0.3 * clamp01(rain / 50), { opacity: 0.5 }));
  if (dry > 0) out.push(layer(run, "shift-dryness", "dryness", 0.1 + 0.3 * clamp01(dry / 50), { opacity: 0.5, params: { cracks: 0 } }));
  return out;
};
