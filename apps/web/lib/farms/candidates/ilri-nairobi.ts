// ILRI Nairobi campus (Kenya). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Large campus with paddocks inside Nairobi; equatorial highland, two rainy seasons.
// TODO(verify): location -1.2699, 36.7258 is from https://www.cgiar.org/node/986 (an institute or campus point, not a surveyed farm centre); confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://ilri.org/knowledge/publications/whos-who-ilri-nairobi-campus (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Mostly livestock and pasture, few crop rotations.
import type { Candidate } from "./index";

export const ILRI_NAIROBI: Candidate = {
  farm: {
    id: "ilri-nairobi",
    name: "ILRI Nairobi campus",
    owner: "International Livestock Research Institute (ILRI)",
    country: "Kenya",
    locality: "Nairobi", // TODO(verify): from search results, source page not opened
    lon: 36.7258,
    lat: -1.2699,
    tier: "explore",
    sourceUrl: "https://ilri.org/knowledge/publications/whos-who-ilri-nairobi-campus",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
