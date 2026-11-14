import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer, smoothstep } from "./shared";

export const compound: GroundEvaluator = (run) => {
  const p = clamp01(run.progress);
  const d1 = input(run, "phase1_days");
  const share = d1 / (d1 + 3);
  const peak = clamp01(input(run, "storm_peak_mm_h") / 100);
  const q = p < share ? p / share : 1;
  const s = p < share ? 0 : (p - share) / (1 - share);
  const dry = 0.9 * q * (1 - smoothstep(0, 0.5, s));
  const bump = Math.sin(Math.PI * s) ** 2;
  const flow = clamp01(peak * 1.5 * bump); // baked dry soil sheds more water
  const pool = peak * smoothstep(0.1, 0.6, s) * (1 - smoothstep(0.9, 1, s));
  return [
    layer(run, "compound-dryness", "dryness", dry, { params: { cracks: smoothstep(0.5, 0.9, dry) } }),
    layer(run, "compound-water", "water", pool, { params: { lowSpotOnly: 1, ripples: pool } }),
    layer(run, "compound-runoff", "runoff", flow, { params: { flow } }),
  ];
};
