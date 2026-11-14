// Alliance Bioversity-CIAT Palmira campus (Colombia). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Large research campus between Cali and Palmira; tropical valley fields.
// TODO(verify): location 3.503, -76.356 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://alliancebioversityciat.org/fr/taxonomy/term/6397 (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Coordinates unverified; Google 3D in Colombia unknown.
import type { Candidate } from "./index";

export const CIAT_PALMIRA: Candidate = {
  farm: {
    id: "ciat-palmira",
    name: "Alliance Bioversity-CIAT Palmira campus",
    owner: "Alliance of Bioversity International and CIAT",
    country: "Colombia",
    locality: "Palmira, Valle del Cauca", // TODO(verify): from search results, source page not opened
    lon: -76.356,
    lat: 3.503,
    tier: "explore",
    sourceUrl: "https://alliancebioversityciat.org/fr/taxonomy/term/6397",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
