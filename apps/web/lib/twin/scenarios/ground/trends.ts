import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer } from "./shared";

/**
 * GIBS layer id for the trends imagery. TODO(verify): must be filled from the live GIBS capabilities document
 * (never guessed). While null, trends returns no imagery.
 */
export const TRENDS_FIXTURE_LAYER: string | null = null;
/** Fixed "now" year so the sweep is deterministic (no Date.now in a pure evaluator). */
export const NOW_YEAR = 2026;
export const GIBS_CREDIT = "NASA Global Imagery Browse Services for EOSDIS";

export const trendsYear = (start: number, p: number): number => {
  const steps = Math.max(1, NOW_YEAR - start + 1);
  return start + Math.min(steps - 1, Math.floor(clamp01(p) * steps));
};

export const trends: GroundEvaluator = (run) => {
  if (!TRENDS_FIXTURE_LAYER) return [];
  const date = `${trendsYear(input(run, "start_year"), run.progress)}-01-01`;
  return [{ ...layer(run, "trends-imagery", "nasaImagery", 1), imagery: { layerId: TRENDS_FIXTURE_LAYER, date, credit: GIBS_CREDIT } }];
};
