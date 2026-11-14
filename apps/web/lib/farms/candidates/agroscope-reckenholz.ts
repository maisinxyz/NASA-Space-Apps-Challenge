// Agroscope Reckenholz research station (Switzerland). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Federal arable research station inside the city of Zurich.
// TODO(verify): location 47.43, 8.52 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.agroscope.admin.ch/agroscope/en/home/about-us/locations-contacts/reckenholz.html (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Fenced protected trial site is part of the station: frame away from it.
import type { Candidate } from "./index";

export const AGROSCOPE_RECKENHOLZ: Candidate = {
  farm: {
    id: "agroscope-reckenholz",
    name: "Agroscope Reckenholz research station",
    owner: "Agroscope (Swiss federal research)",
    country: "Switzerland",
    locality: "Zurich-Affoltern", // TODO(verify): from search results, source page not opened
    lon: 8.52,
    lat: 47.43,
    tier: "explore",
    sourceUrl: "https://www.agroscope.admin.ch/agroscope/en/home/about-us/locations-contacts/reckenholz.html",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "swissalti3d",
  boundaries: "osm",
  validation: "not-validated",
};
