// INTA Castelar research centre (CNIA) (Argentina). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Pampas research station inside the Buenos Aires metro.
// TODO(verify): location -34.607, -58.668 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.argentina.gob.ar/node/138206 (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Press reports (2025-26) of land sales and transfers at the site.
import type { Candidate } from "./index";

export const INTA_CASTELAR: Candidate = {
  farm: {
    id: "inta-castelar",
    name: "INTA Castelar research centre (CNIA)",
    owner: "National Agricultural Technology Institute (INTA)",
    country: "Argentina",
    locality: "Hurlingham, Buenos Aires province", // TODO(verify): from search results, source page not opened
    lon: -58.668,
    lat: -34.607,
    tier: "explore",
    sourceUrl: "https://www.argentina.gob.ar/node/138206",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
