// Saskatoon Research Farm, Agriculture and Agri-Food Canada (Canada). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Prairie grain research farm on the city edge; cold semi-arid climate.
// TODO(verify): location 52.158512, -106.580521 is from https://www.tbs-sct.gc.ca/fcsi-rscf/fsi-isf/00001375-eng.aspx (an institute or campus point, not a surveyed farm centre); confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://profils-profiles.science.gc.ca/en/research-centre/saskatoon-research-and-development-centre/saskatoon-research-and-development-centre (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Point is the federal property record, not a confirmed building.
import type { Candidate } from "./index";

export const AAFC_SASKATOON: Candidate = {
  farm: {
    id: "aafc-saskatoon",
    name: "Saskatoon Research Farm, Agriculture and Agri-Food Canada",
    owner: "Agriculture and Agri-Food Canada (Saskatoon Research and Development Centre)",
    country: "Canada",
    locality: "Saskatoon, Saskatchewan", // TODO(verify): from search results, source page not opened
    lon: -106.580521,
    lat: 52.158512,
    tier: "explore",
    sourceUrl: "https://profils-profiles.science.gc.ca/en/research-centre/saskatoon-research-and-development-centre/saskatoon-research-and-development-centre",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "canHrdem",
  boundaries: "osm",
  validation: "not-validated",
};
