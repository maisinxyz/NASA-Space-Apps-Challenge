// CIMMYT headquarters and El Batán experimental station (Mexico). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Clear HQ building cluster with trial plots in the Mexico City metro; highland maize and wheat.
// TODO(verify): location 19.52957, -98.8532 is from https://www.cgiar.org/locations/mexico-cimmyt-texcoco-la-redonda-experimental-station (an institute or campus point, not a surveyed farm centre); confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.cgiar.org/locations/mexico-cimmyt-texcoco-la-redonda-experimental-station (found by web search 2026-11-14; not opened, sandbox network policy). Risk: CGIAR lists a second La Redonda point 15 km east.
import type { Candidate } from "./index";

export const CIMMYT_EL_BATAN: Candidate = {
  farm: {
    id: "cimmyt-el-batan",
    name: "CIMMYT headquarters and El Bat\u00e1n experimental station",
    owner: "International Maize and Wheat Improvement Center (CIMMYT)",
    country: "Mexico",
    locality: "Texcoco, State of Mexico", // TODO(verify): from search results, source page not opened
    lon: -98.8532,
    lat: 19.52957,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/locations/mexico-cimmyt-texcoco-la-redonda-experimental-station",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
