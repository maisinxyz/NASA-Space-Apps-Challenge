// Vineyard estates near Pirque, Santiago Metropolitan Region (Chile). Scouting candidate, NOT VALIDATED: needs the 3D check in /dev/farms-check and a visual check by a person.
// Why: Large vineyard estates with clear winery buildings on the edge of Santiago, Andes foothills.
// TODO(verify): location -33.637, -70.575 is from memory; confirm on the source page or OpenStreetMap, then frame the main buildings.
// Source: https://conchaytoro.com/en/blog/concha-y-toro-wine-center-a-place-where-heritage-lives-in-every-corner/ (found by web search 2026-11-14; not opened, sandbox network policy). Risk: Private company land: area only, no owner named; source page is the estate's own visitor blog.
// Private land: described by area only, never by owner or address (user rule).
import type { Candidate } from "./index";

export const PIRQUE_VINEYARDS: Candidate = {
  farm: {
    id: "pirque-vineyards",
    name: "Vineyard estates near Pirque, Santiago Metropolitan Region",
    owner: "Private vineyard estates (area only)",
    country: "Chile",
    locality: "Pirque, Santiago Metropolitan Region", // TODO(verify): from search results, source page not opened
    lon: -70.575,
    lat: -33.637,
    tier: "explore",
    sourceUrl: "https://conchaytoro.com/en/blog/concha-y-toro-wine-center-a-place-where-heritage-lives-in-every-corner/",
    coordsVerified: false,
    radiusM: 1500,
    minRangeM: 250,
    note: { text: "Private working farmland, area only. No owners or addresses are shown." },
  },
  privacy: "private",
  expected3d: "med",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "not-validated",
};
