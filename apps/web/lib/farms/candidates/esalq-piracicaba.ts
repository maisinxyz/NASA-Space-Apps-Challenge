// ESALQ/USP Luiz de Queiroz campus farms (Brazil). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Historic agricultural campus inside a city; sugarcane, soybean, maize.
// TODO(verify): location -22.711, -47.631 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://jornal.usp.br/?p=880936 (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Point is the campus; Fazenda Areao location unverified.
import type { Candidate } from "./index";

export const ESALQ_PIRACICABA: Candidate = {
  farm: {
    id: "esalq-piracicaba",
    name: "ESALQ/USP Luiz de Queiroz campus farms",
    owner: "University of Sao Paulo, Luiz de Queiroz College of Agriculture (ESALQ)",
    country: "Brazil",
    locality: "Piracicaba, Sao Paulo", // TODO(verify): from search results, source page not opened
    lon: -47.631,
    lat: -22.711,
    tier: "explore",
    sourceUrl: "https://jornal.usp.br/?p=880936",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
