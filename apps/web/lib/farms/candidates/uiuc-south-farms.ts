// South Farms, University of Illinois Urbana-Champaign (United States). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Research farms on the edge of a large campus, many barns; Corn Belt maize-soybean.
// TODO(verify): location 40.08, -88.225 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://research.illinois.edu/researchunit/crop-science-research-and-education-center (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Point is the South Farms area, not a specific building.
import type { Candidate } from "./index";

export const UIUC_SOUTH_FARMS: Candidate = {
  farm: {
    id: "uiuc-south-farms",
    name: "South Farms, University of Illinois Urbana-Champaign",
    owner: "University of Illinois Urbana-Champaign",
    country: "United States",
    locality: "Urbana, Illinois", // TODO(verify): from search results, source page not opened
    lon: -88.225,
    lat: 40.08,
    tier: "explore",
    sourceUrl: "https://research.illinois.edu/researchunit/crop-science-research-and-education-center",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "usgs3dep",
  boundaries: "osm",
  validation: "not-validated",
};
