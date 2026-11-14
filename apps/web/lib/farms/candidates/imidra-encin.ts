// Finca El Encin, IMIDRA (Spain). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Regional research farm with vineyard and field crops near Madrid; semi-arid Mediterranean.
// TODO(verify): location 40.52, -3.29 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.comunidad.madrid/centros/finca-encin-alcala-henares (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Coordinates need care.
import type { Candidate } from "./index";

export const IMIDRA_ENCIN: Candidate = {
  farm: {
    id: "imidra-encin",
    name: "Finca El Encin, IMIDRA",
    owner: "IMIDRA (Comunidad de Madrid)",
    country: "Spain",
    locality: "Alcala de Henares, Madrid", // TODO(verify): from search results, source page not opened
    lon: -3.29,
    lat: 40.52,
    tier: "explore",
    sourceUrl: "https://www.comunidad.madrid/centros/finca-encin-alcala-henares",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "cnigMdt05",
  boundaries: "osm",
  validation: "not-validated",
};
