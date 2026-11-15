// Which engine site (services/api) backs which farm on the globe. Add a pair when a farm gets a seeded site.
import type { ForecastRequest } from "@/lib/api/types";

import ubcRequest from "./ubc-request.json";

export const FARM_SITE: Readonly<Record<string, string>> = { "ubc-farm": "site_ubc_farm" };

export const siteForFarm = (farmId: string | null): string | null => (farmId ? (FARM_SITE[farmId] ?? null) : null);

// The farm's own request: fields, crop pool and constraints. TODO(verify) with UBC Farm: fields are OSM plot outlines;
// the demo crop pool is limited to crops with sourced traits (docs/progress/FT-FE-ubc.md).
const REQUESTS: Record<string, ForecastRequest> = { site_ubc_farm: ubcRequest as unknown as ForecastRequest };

/** The request for a site, with the what-if sliders applied as scenario adjustments (0 = none). */
export function requestFor(siteId: string, whatIf: { rainPct: number; tempC: number } = { rainPct: 0, tempC: 0 }): ForecastRequest | null {
  const base = REQUESTS[siteId];
  if (!base) return null;
  if (whatIf.rainPct === 0 && whatIf.tempC === 0) return base;
  return { ...base, scenario: { preset: "baseline", rain_scale_pct: whatIf.rainPct, temp_offset_c: whatIf.tempC } };
}
