// UBC Farm, University of British Columbia (Canada). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 20 to 24 ha teaching farm inside a major city; dense Google 3D expected.
// TODO(verify): location 49.251, -123.238 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://ubcfarm.ubc.ca/about/ (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Small fields; mixed vegetables rather than field crops.
import type { Candidate } from "./index";

export const UBC_FARM: Candidate = {
  farm: {
    id: "ubc-farm",
    name: "UBC Farm, University of British Columbia",
    owner: "University of British Columbia (Centre for Sustainable Food Systems)",
    country: "Canada",
    locality: "Vancouver, British Columbia", // TODO(verify): from search results, source page not opened
    lon: -123.238,
    lat: 49.251,
    tier: "explore",
    sourceUrl: "https://ubcfarm.ubc.ca/about/",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "canHrdem",
  boundaries: "osm",
  validation: "not-validated",
};
