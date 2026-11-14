// Experiment Farm, Hokkaido University (Japan). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 58 ha city-campus farm dating from 1876; cold humid climate.
// TODO(verify): location 43.075, 141.335 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.fsc.hokudai.ac.jp/farm/en/?p=128 (found by web search 2026-11-14; not opened, sandbox network policy). Risk: GSI 5 m DEM terms not yet verified, so global DEM listed.
import type { Candidate } from "./index";

export const HOKUDAI_FARM: Candidate = {
  farm: {
    id: "hokudai-farm",
    name: "Experiment Farm, Hokkaido University",
    owner: "Hokkaido University (Field Science Center)",
    country: "Japan",
    locality: "Kita-ku, Sapporo, Hokkaido", // TODO(verify): from search results, source page not opened
    lon: 141.335,
    lat: 43.075,
    tier: "explore",
    sourceUrl: "https://www.fsc.hokudai.ac.jp/farm/en/?p=128",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "maffFude",
  validation: "not-validated",
};
