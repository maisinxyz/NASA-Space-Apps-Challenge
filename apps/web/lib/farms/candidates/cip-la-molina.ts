// International Potato Center (CIP) headquarters fields (Peru). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Fields inside the Lima metro; coastal desert, irrigated.
// TODO(verify): location -12.07694, -76.94611 is from Wikipedia (International Potato Center article) (an institute or campus point, not a surveyed farm centre); confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.cgiar.org/research/center/cip (found by web search 2026-11-14; not opened, sandbox network policy). Risk: NASA POWER grid cell is coarse for the coastal desert; small plots.
import type { Candidate } from "./index";

export const CIP_LA_MOLINA: Candidate = {
  farm: {
    id: "cip-la-molina",
    name: "International Potato Center (CIP) headquarters fields",
    owner: "International Potato Center (CIP)",
    country: "Peru",
    locality: "La Molina, Lima", // TODO(verify): from search results, source page not opened
    lon: -76.94611,
    lat: -12.07694,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/research/center/cip",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
