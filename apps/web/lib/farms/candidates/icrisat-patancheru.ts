// ICRISAT headquarters farm (India). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 1,390 ha semi-arid research farm on the Hyderabad edge.
// TODO(verify): location 17.51, 78.27 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.cgiar.org/locations/india-icrisat-hyderabad-campus (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Coordinates from memory.
import type { Candidate } from "./index";

export const ICRISAT_PATANCHERU: Candidate = {
  farm: {
    id: "icrisat-patancheru",
    name: "ICRISAT headquarters farm",
    owner: "International Crops Research Institute for the Semi-Arid Tropics (ICRISAT)",
    country: "India",
    locality: "Patancheru, Hyderabad, Telangana", // TODO(verify): from search results, source page not opened
    lon: 78.27,
    lat: 17.51,
    tier: "explore",
    sourceUrl: "https://www.cgiar.org/locations/india-icrisat-hyderabad-campus",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
