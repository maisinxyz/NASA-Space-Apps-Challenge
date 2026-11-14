// Texas A&M AgriLife Research Farm, Brazos River bottom (United States). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Large irrigated research farm SW of College Station; hot humid climate.
// TODO(verify): location 30.545, -96.43 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://soilcrop.tamu.edu/research/farm-services/ (found by web search 2026-11-14; not opened, sandbox network policy). Risk: HQ point uncertain; farm is outside the city.
import type { Candidate } from "./index";

export const TAMU_RESEARCH_FARM: Candidate = {
  farm: {
    id: "tamu-research-farm",
    name: "Texas A&M AgriLife Research Farm, Brazos River bottom",
    owner: "Texas A&M AgriLife Research",
    country: "United States",
    locality: "College Station, Texas", // TODO(verify): from search results, source page not opened
    lon: -96.43,
    lat: 30.545,
    tier: "explore",
    sourceUrl: "https://soilcrop.tamu.edu/research/farm-services/",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "usgs3dep",
  boundaries: "osm",
  validation: "not-validated",
};
