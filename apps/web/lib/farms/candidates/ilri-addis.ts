// ILRI Addis Ababa campus (Ethiopia). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 34 ha urban research campus; Ethiopian highland climate.
// TODO(verify): location 9.0163, 38.8143 is from https://www.cgiar.org/locations/ethiopia-ilri-addis-ababa-campus (an institute or campus point, not a surveyed farm centre); confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.cgiar.org/locations/ethiopia-ilri-addis-ababa-campus (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Few fields on campus.
import type { Candidate } from "./index";

export const ILRI_ADDIS: Candidate = {
  farm: {
    id: "ilri-addis",
    name: "ILRI Addis Ababa campus",
    owner: "International Livestock Research Institute (ILRI)",
    country: "Ethiopia",
    locality: "Addis Ababa", // TODO(verify): from search results, source page not opened
    lon: 38.8143,
    lat: 9.0163,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/locations/ethiopia-ilri-addis-ababa-campus",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
