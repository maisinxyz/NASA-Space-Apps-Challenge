// Hatfield Experimental Farm (Innovation Africa@UP), University of Pretoria (South Africa). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Urban experimental farm next to campus (dairy, field trials) in a large city.
// TODO(verify): location -25.75, 28.258 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://www.up.ac.za/news/post_2903902-newly-appointed-director-at-the-university-of-pretorias-innovation-africaup-unit-aims-to-strengthen-ties-with-the-agriculture-sector (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Part of the farm is being built on (Future Africa campus).
import type { Candidate } from "./index";

export const UP_HATFIELD: Candidate = {
  farm: {
    id: "up-hatfield",
    name: "Hatfield Experimental Farm (Innovation Africa@UP), University of Pretoria",
    owner: "University of Pretoria",
    country: "South Africa",
    locality: "Hatfield, Pretoria", // TODO(verify): from search results, source page not opened
    lon: 28.258,
    lat: -25.75,
    tier: "explore",
    sourceUrl: "https://www.up.ac.za/news/post_2903902-newly-appointed-director-at-the-university-of-pretorias-innovation-africaup-unit-aims-to-strengthen-ties-with-the-agriculture-sector",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
