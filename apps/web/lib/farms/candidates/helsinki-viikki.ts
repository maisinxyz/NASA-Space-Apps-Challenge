// Viikki Research Farm, University of Helsinki (Finland). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 155 ha of fields inside a capital city; boreal climate.
// TODO(verify): location 60.23, 25.02 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.helsinki.fi/en/research-stations/science-trails/viikki-research-farm-science-trail/welcome-viikki-research-farm (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Coordinates from memory.
import type { Candidate } from "./index";

export const HELSINKI_VIIKKI: Candidate = {
  farm: {
    id: "helsinki-viikki",
    name: "Viikki Research Farm, University of Helsinki",
    owner: "University of Helsinki",
    country: "Finland",
    locality: "Viikki, Helsinki", // TODO(verify): from search results, source page not opened
    lon: 25.02,
    lat: 60.23,
    tier: "explore",
    sourceUrl: "https://www.helsinki.fi/en/research-stations/science-trails/viikki-research-farm-science-trail/welcome-viikki-research-farm",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "nlsFi2m",
  boundaries: "osm",
  validation: "not-validated",
};
