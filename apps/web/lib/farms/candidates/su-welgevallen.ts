// Welgevallen Experimental Farm, Stellenbosch University (South Africa). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Experimental farm with vineyards next to campus in a town; Mediterranean climate.
// TODO(verify): location -33.942, 18.867 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.sun.ac.za/english/faculty/agri/Pages/Experimental-Farms.aspx (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Small plots; coordinates from memory.
import type { Candidate } from "./index";

export const SU_WELGEVALLEN: Candidate = {
  farm: {
    id: "su-welgevallen",
    name: "Welgevallen Experimental Farm, Stellenbosch University",
    owner: "Stellenbosch University",
    country: "South Africa",
    locality: "Stellenbosch, Western Cape", // TODO(verify): from search results, source page not opened
    lon: 18.867,
    lat: -33.942,
    tier: "explore",
    sourceUrl: "https://www.sun.ac.za/english/faculty/agri/Pages/Experimental-Farms.aspx",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
