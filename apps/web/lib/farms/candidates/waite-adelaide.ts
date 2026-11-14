// Waite Campus, University of Adelaide (Australia). Scouting candidate, 3D check PASS (2026-11-14, docs/farm-scouting/FARMS.md).
// Why: 184 ha research campus with vineyards in Adelaide's suburbs; Mediterranean climate.
// TODO(verify): location -34.97, 138.63 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://waite.adelaide.edu.au (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Coordinates from memory.
import type { Candidate } from "../datasets";

export const WAITE_ADELAIDE: Candidate = {
  farm: {
    id: "waite-adelaide",
    name: "Waite Campus, University of Adelaide",
    owner: "The University of Adelaide",
    country: "Australia",
    locality: "Urrbrae, Adelaide, South Australia", // TODO(verify): from search results, source page not opened
    lon: 138.63,
    lat: -34.97,
    tier: "explore",
    sourceUrl: "https://waite.adelaide.edu.au",
    coordsVerified: false,
    radiusM: 1500,
    pin: "grape-cluster",
  },
  privacy: "public",
  expected3d: "high",
  elevation: "elvis",
  boundaries: "osm",
  validation: "pass",
};
