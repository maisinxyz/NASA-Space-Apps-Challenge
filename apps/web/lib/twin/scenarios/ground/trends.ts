import type { GroundEvaluator } from "../../scenario";
import { clamp01, input, layer } from "./shared";

/**
 * 2-meter assimilated air temperature, monthly MERRA-2 (regional context).
 * GIBS Time dimension, checked 2026-11-14:
 * 1980-01-01/2000-03-01/P1M, 2000-04-01/2025-04-01/P1M,
 * 2025-07-01/2025-07-01/P1M, 2025-09-01/2026-08-01/P1M.
 * Additional singleton dates are advertised in March 2000 and April–June 2025;
 * the ranges are not continuous. Every January from 1980 through 2026 is available.
 * Source: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
 */
export const TRENDS_FIXTURE_LAYER = "MERRA2_2m_Air_Temperature_Assimilated_Monthly";
const FIRST_IMAGERY_YEAR = 1980;
const LAST_IMAGERY_YEAR = 2026;
/** Fixed "now" year so the sweep is deterministic (no Date.now in a pure evaluator). */
export const NOW_YEAR = 2026;
export const GIBS_CREDIT = "NASA Global Imagery Browse Services for EOSDIS";

export const trendsYear = (start: number, p: number): number => {
  const first = Math.max(FIRST_IMAGERY_YEAR, Math.min(LAST_IMAGERY_YEAR, Math.floor(Number.isFinite(start) ? start : FIRST_IMAGERY_YEAR)));
  const last = Math.min(NOW_YEAR, LAST_IMAGERY_YEAR);
  const steps = Math.max(1, last - first + 1);
  return first + Math.min(steps - 1, Math.floor(clamp01(p) * steps));
};

export const trends: GroundEvaluator = (run) => {
  const date = `${trendsYear(input(run, "start_year"), run.progress)}-01-01`;
  return [{ ...layer(run, "trends-imagery", "nasaImagery", 1), imagery: { layerId: TRENDS_FIXTURE_LAYER, date, credit: GIBS_CREDIT } }];
};
