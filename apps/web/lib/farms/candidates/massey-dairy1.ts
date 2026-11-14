// Dairy Farm 1, Massey University (New Zealand). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: 142 ha farm inside the city boundary on the Manawatu River (flood relevance).
// TODO(verify): location -40.38, 175.62 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://massey.ac.nz/about/massey-subsidiaries-and-commercial-ventures/massey-farms/dairy-farm-1 (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Pasture (dairy), not arable rotations.
import type { Candidate } from "./index";

export const MASSEY_DAIRY1: Candidate = {
  farm: {
    id: "massey-dairy1",
    name: "Dairy Farm 1, Massey University",
    owner: "Massey University",
    country: "New Zealand",
    locality: "Palmerston North, Manawatu", // TODO(verify): from search results, source page not opened
    lon: 175.62,
    lat: -40.38,
    tier: "explore",
    sourceUrl: "https://massey.ac.nz/about/massey-subsidiaries-and-commercial-ventures/massey-farms/dairy-farm-1",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "linzLidar",
  boundaries: "osm",
  validation: "not-validated",
};
