// Which engine site (services/api) backs which farm on the globe. Add a pair when a farm gets a seeded site.
import type { ForecastRequest } from "@/lib/api/types";

import kpuRequest from "./kpu-request.json";
import ubcRequest from "./ubc-request.json";

export const FARM_SITE: Readonly<Record<string, string>> = { "ubc-farm": "site_ubc_farm", "kpu-langley": "site_kpu_langley" };

export const siteForFarm = (farmId: string | null): string | null => (farmId ? (FARM_SITE[farmId] ?? null) : null);

// The farm's own request: fields, crop pool and constraints. TODO(verify) with UBC Farm: fields are OSM plot outlines;
// the demo crop pool is limited to crops with sourced traits (docs/progress/FT-FE-ubc.md).
// KPU: four OSM farmland outlines near the pin (lib/farms/bc.ts), existing rotation = the site's stored preset (B4).
const REQUESTS: Record<string, ForecastRequest> = {
  site_ubc_farm: ubcRequest as unknown as ForecastRequest,
  site_kpu_langley: kpuRequest as unknown as ForecastRequest,
};

/** The unmodified request of a site (the rotation planner edits a copy). */
export const baseRequest = (siteId: string): ForecastRequest | null => REQUESTS[siteId] ?? null;

/**
 * Credit for the field outlines sent in each site's request. UBC: OpenStreetMap ways 801371132, 801371128, 801371116,
 * 801371115, 801371122, 801371107 (named UBC Farm plots), fetched 2026-11-15 from overpass-api.de with
 * way(around:700,49.249786,-123.236786)["landuse"]; areas are planar ring areas. Community mapping, not UBC records.
 */
export const FIELD_SOURCES: Readonly<Record<string, string>> = {
  site_ubc_farm: "Field outlines: UBC Farm plots from OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0. Community mapping, not farm records.",
  site_kpu_langley: "Field outlines: OpenStreetMap farmland ways 95899267, 95899276, 96026582, 95899281 near the KPU Langley pin, © OpenStreetMap contributors, ODbL 1.0. Not confirmed as KPU fields.",
};

/** The request for a site, with the what-if sliders applied as scenario adjustments (0 = none). */
export function requestFor(siteId: string, whatIf: { rainPct: number; tempC: number } = { rainPct: 0, tempC: 0 }): ForecastRequest | null {
  const base = REQUESTS[siteId];
  if (!base) return null;
  if (whatIf.rainPct === 0 && whatIf.tempC === 0) return base;
  return { ...base, scenario: { preset: "baseline", rain_scale_pct: whatIf.rainPct, temp_offset_c: whatIf.tempC } };
}
