// Kwantlen Polytechnic University, Langley campus and School of Horticulture (Canada). Pinned 2026-11-14 as the second BC twin.
// Why: teaching campus with a horticulture field lab, greenhouses and gardens in the Fraser Valley (a wetter, more
// suburban setting than UBC Farm); dense Google 3D.
// 3D check (stage 1, /dev/farms-check probe, 2026-11-14): 60 buildings; 87 % >= 3 m; median 7.8 m; relief 35 % / p90 9.2 m.
// The oblique screenshot was not viewed yet. TODO(verify): look at it, then frame the horticulture field lab.
// Location 49.109162, -122.645172: OpenStreetMap way 538627375 "Kwantlen Polytechnic University - Langley Campus"
// (Nominatim lookup 2026-11-14, (c) OpenStreetMap contributors, ODbL). A campus point, not a surveyed farm centre.
// Source: https://www.kpu.ca/ (KPU School of Horticulture, Langley). Risk: the farm part is a small field lab, not a working farm.
import type { Candidate } from "../datasets";

export const KPU_LANGLEY: Candidate = {
  farm: {
    id: "kpu-langley",
    name: "KPU School of Horticulture, Langley",
    owner: "Kwantlen Polytechnic University",
    country: "Canada",
    locality: "Langley, British Columbia",
    lon: -122.645172,
    lat: 49.109162,
    tier: "explore",
    sourceUrl: "https://www.kpu.ca/",
    coordsVerified: false,
    radiusM: 1500,
    pin: "plot-grid",
  },
  privacy: "public",
  expected3d: "high",
  elevation: "canHrdem",
  boundaries: "osm",
  validation: "pass",
};
