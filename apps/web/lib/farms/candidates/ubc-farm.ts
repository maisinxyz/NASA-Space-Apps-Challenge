// UBC Farm, University of British Columbia (Canada). Scouting candidate, 3D check PASS (2026-11-14, docs/farm-scouting/FARMS.md).
// Why: 20 to 24 ha teaching farm inside a major city; dense Google 3D expected.
// Location 49.249786, -123.236786 = 49°14'59.23"N 123°14'12.43"W, user-supplied from a map 2026-11-15. TODO(verify) against the source page.
// Source: https://ubcfarm.ubc.ca/about/ (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Small fields; mixed vegetables rather than field crops.
import type { Candidate } from "../datasets";

export const UBC_FARM: Candidate = {
  farm: {
    id: "ubc-farm",
    name: "UBC Farm, University of British Columbia",
    owner: "University of British Columbia (Centre for Sustainable Food Systems)",
    country: "Canada",
    locality: "Vancouver, British Columbia", // TODO(verify): from search results, source page not opened
    lon: -123.236786,
    lat: 49.249786,
    tier: "explore",
    sourceUrl: "https://ubcfarm.ubc.ca/about/",
    coordsVerified: false,
    radiusM: 1500,
    pin: "plot-grid",
    // Camera pulled back from the default 400-600 m start so the whole farm is in view. Same target (farm centre), same pitch. TODO(verify) in /dev/trace (Set framing).
    framing: { lon: -123.236786, lat: 49.249786, rangeM: 750, pitchDeg: -30, headingDeg: 0 },
  },
  privacy: "public",
  expected3d: "high",
  elevation: "canHrdem",
  boundaries: "osm",
  validation: "pass",
};
