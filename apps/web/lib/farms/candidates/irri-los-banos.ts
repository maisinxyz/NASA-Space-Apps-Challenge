// IRRI experimental farm (Philippines). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 252 ha of rice paddies with a research campus; humid tropics.
// TODO(verify): location 14.17, 121.25 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://news.irri.org/search/label/Zeigler%20Experiment%20Station (found by web search 2026-11-14; not opened, sandbox network policy). Risk: No official landing page found; source is the IRRI news blog.
import type { Candidate } from "./index";

export const IRRI_LOS_BANOS: Candidate = {
  farm: {
    id: "irri-los-banos",
    name: "IRRI experimental farm",
    owner: "International Rice Research Institute (IRRI)",
    country: "Philippines",
    locality: "Los Banos, Laguna", // TODO(verify): from search results, source page not opened
    lon: 121.25,
    lat: 14.17,
    tier: "explore",
    sourceUrl: "https://news.irri.org/search/label/Zeigler%20Experiment%20Station",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
