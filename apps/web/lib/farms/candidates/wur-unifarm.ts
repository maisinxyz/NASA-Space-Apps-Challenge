// Unifarm, Wageningen University & Research (Netherlands). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: University research farm next to campus; best open data (0.5 m lidar, crop parcels).
// TODO(verify): location 51.99, 5.66 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.wur.nl/en/research/facilities/unifarm (found by web search 2026-11-14; not opened, sandbox network policy). Risk: About 410 km from Rothamsted (reserve), coordinates from memory.
import type { Candidate } from "./index";

export const WUR_UNIFARM: Candidate = {
  farm: {
    id: "wur-unifarm",
    name: "Unifarm, Wageningen University & Research",
    owner: "Wageningen University & Research",
    country: "Netherlands",
    locality: "Wageningen, Gelderland", // TODO(verify): from search results, source page not opened
    lon: 5.66,
    lat: 51.99,
    tier: "explore",
    sourceUrl: "https://www.wur.nl/en/research/facilities/unifarm",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "ahn4",
  boundaries: "brp",
  validation: "not-validated",
};
