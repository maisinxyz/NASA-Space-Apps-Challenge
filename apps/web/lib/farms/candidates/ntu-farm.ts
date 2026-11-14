// Experimental farm of National Taiwan University, Taipei (Taiwan). Scouting candidate added 2026-11-14 to fill the
// East Asia gap on the globe.
// Why: university farm inside Taipei, where Google 3D is dense (probe: 72 % of 60 OSM buildings >= 3 m, median 4.8 m).
// Location: OSM node 3012324209 "臺大農場" via Nominatim (2026-11-14); approximate, TODO(verify) the field area.
import type { Candidate } from "../datasets";

export const NTU_FARM: Candidate = {
  farm: {
    id: "ntu-farm",
    name: "Experimental Farm, National Taiwan University",
    owner: "National Taiwan University",
    country: "Taiwan",
    locality: "Da'an District, Taipei", // from the OSM address of the node above
    lon: 121.5402,
    lat: 25.0164,
    tier: "explore",
    sourceUrl: "https://www.openstreetmap.org/node/3012324209",
    coordsVerified: false,
    radiusM: 1500,
    pin: "plot-grid",
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "pass",
};
