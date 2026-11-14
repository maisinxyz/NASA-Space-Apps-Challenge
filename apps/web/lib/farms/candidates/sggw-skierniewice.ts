// Experimental Station in Skierniewice, Warsaw University of Life Sciences (SGGW) (Poland). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Long-term fertilisation trials since 1921 in a mid-size town; continental climate.
// TODO(verify): location 51.96, 20.16 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://ir.sggw.edu.pl/en/institute-of-agriculture/about-the-institute/experimental-station-in-skierniewice/about-the-station (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Mid-size town: Google 3D may be thinner.
import type { Candidate } from "./index";

export const SGGW_SKIERNIEWICE: Candidate = {
  farm: {
    id: "sggw-skierniewice",
    name: "Experimental Station in Skierniewice, Warsaw University of Life Sciences (SGGW)",
    owner: "Warsaw University of Life Sciences (SGGW)",
    country: "Poland",
    locality: "Skierniewice, Lodz voivodeship", // TODO(verify): from search results, source page not opened
    lon: 20.16,
    lat: 51.96,
    tier: "explore",
    sourceUrl: "https://ir.sggw.edu.pl/en/institute-of-agriculture/about-the-institute/experimental-station-in-skierniewice/about-the-station",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "med",
  elevation: "gugikNmt",
  boundaries: "osm",
  validation: "not-validated",
};
