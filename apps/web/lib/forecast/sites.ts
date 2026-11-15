// Which engine site (services/api) backs which farm on the globe. Add a pair when a farm gets a seeded site.
import type { ForecastRequest } from "@/lib/api/types";

import ubcRequest from "./ubc-request.json";

export const FARM_SITE: Readonly<Record<string, string>> = { "ubc-farm": "site_ubc_farm" };

export const siteForFarm = (farmId: string | null): string | null => (farmId ? (FARM_SITE[farmId] ?? null) : null);

// The farm's own request: fields, crop pool and constraints. TODO(verify) with UBC Farm: fields are OSM plot outlines;
// the demo crop pool is limited to crops with sourced traits (docs/progress/FT-FE-ubc.md).
const REQUESTS: Record<string, ForecastRequest> = { site_ubc_farm: ubcRequest as unknown as ForecastRequest };

/**
 * Credit for the field outlines sent in each site's request. UBC: OpenStreetMap ways 801371132, 801371128, 801371116,
 * 801371115, 801371122, 801371107 (named UBC Farm plots), fetched 2026-11-15 from overpass-api.de with
 * way(around:700,49.249786,-123.236786)["landuse"]; areas are planar ring areas. Community mapping, not UBC records.
 */
export const FIELD_SOURCES: Readonly<Record<string, string>> = {
  site_ubc_farm: "Field outlines: UBC Farm plots from OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0. Community mapping, not farm records.",
};

/** The request for a site, with the what-if sliders applied as scenario adjustments (0 = none). */
export function requestFor(siteId: string, whatIf: { rainPct: number; tempC: number } = { rainPct: 0, tempC: 0 }): ForecastRequest | null {
  const base = REQUESTS[siteId];
  if (!base) return null;
  if (whatIf.rainPct === 0 && whatIf.tempC === 0) return base;
  return { ...base, scenario: { preset: "baseline", rain_scale_pct: whatIf.rainPct, temp_offset_c: whatIf.tempC } };
}
