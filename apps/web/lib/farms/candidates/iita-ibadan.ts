// IITA headquarters research farm (Nigeria). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: About 1,000 ha research farm at a major city edge; humid tropics.
// TODO(verify): location 7.4962, 3.9076 is from https://www.cgiar.org/locations/nigeria-iita-ibadan-campus (an institute or campus point, not a surveyed farm centre); confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.iita.org/about-iita/research-hubs-and-stations/headquarters/ (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Google 3D in Nigeria uncertain.
import type { Candidate } from "./index";

export const IITA_IBADAN: Candidate = {
  farm: {
    id: "iita-ibadan",
    name: "IITA headquarters research farm",
    owner: "International Institute of Tropical Agriculture (IITA)",
    country: "Nigeria",
    locality: "Ibadan, Oyo", // TODO(verify): from search results, source page not opened
    lon: 3.9076,
    lat: 7.4962,
    tier: "explore",
    sourceUrl: "https://www.iita.org/about-iita/research-hubs-and-stations/headquarters/",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
