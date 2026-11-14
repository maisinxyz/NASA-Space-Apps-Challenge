import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer, smoothstep } from "./shared";

const STORM_END = 0.7; // the storm fills the first ~70% of progress, the rest is drain

/** Cumulative share of a sin^2 rain curve (peaks mid-storm), x 0..1 -> 0..1. */
export const cumRain = (x: number): number => clamp01(x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));

export const storm: GroundEvaluator = (run) => {
  const p = clamp01(run.progress);
  const peak = clamp01(input(run, "peak_rain_mm_h") / 100);
  const w0 = clamp01(input(run, "antecedent_wetness") / 100);
  const reach = 0.5 + 0.5 * smoothstep(0, 72, input(run, "duration_h")); // longer storms soak more
  const x = clamp01(p / STORM_END);
  const peakWet = w0 + (1 - w0) * reach * cumRain(1);
  const wet = (w0 + (1 - w0) * reach * cumRain(x)) * (1 - 0.6 * smoothstep(STORM_END, 1, p));
  const bump = p < STORM_END ? Math.sin(Math.PI * x) ** 2 : 0;
  const pool = peak * (0.4 + 0.6 * reach) * smoothstep(0.35, STORM_END, p) * (1 - smoothstep(0.85, 1, p));
  return [
    layer(run, "storm-wetness", "wetness", Math.max(wet, 0.05 * peakWet)),
    layer(run, "storm-water", "water", pool, { params: { lowSpotOnly: 1, ripples: pool } }),
    layer(run, "storm-runoff", "runoff", peak * bump, { params: { flow: peak * bump } }),
  ];
};
