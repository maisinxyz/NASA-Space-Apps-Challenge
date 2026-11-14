// Institute for Sustainable Agro-ecosystem Services (ISAS), University of Tokyo (Japan). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 30 ha of fields and paddy inside the Tokyo urban area.
// TODO(verify): location 35.74, 139.54 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.isas.a.u-tokyo.ac.jp/en/page/about/info (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Small fields; GSI 5 m DEM terms not yet verified, so global DEM listed.
import type { Candidate } from "./index";

export const UTOKYO_ISAS: Candidate = {
  farm: {
    id: "utokyo-isas",
    name: "Institute for Sustainable Agro-ecosystem Services (ISAS), University of Tokyo",
    owner: "The University of Tokyo",
    country: "Japan",
    locality: "Nishitokyo, Tokyo", // TODO(verify): from search results, source page not opened
    lon: 139.54,
    lat: 35.74,
    tier: "explore",
    sourceUrl: "https://www.isas.a.u-tokyo.ac.jp/en/page/about/info",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "maffFude",
  validation: "not-validated",
};
