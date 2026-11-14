// Kadoorie Farm and Botanic Garden, Hong Kong. Scouting candidate added 2026-11-14 to fill the South China gap.
// Why: hillside terraced farm and garden in Hong Kong, where Google 3D is dense (probe: 63 % of 16 OSM buildings
// >= 3 m, median 3.3 m; relief 76 %, mostly trees on the slope).
// Location: OSM node 4959391427 "嘉道理農場 Kadoorie Farm" via Nominatim (2026-11-14); approximate, TODO(verify).
import type { Candidate } from "../datasets";

export const KADOORIE_FARM: Candidate = {
  farm: {
    id: "kadoorie-farm",
    name: "Kadoorie Farm and Botanic Garden",
    owner: "Kadoorie Farm and Botanic Garden",
    country: "Hong Kong",
    locality: "Lam Kam Road, New Territories", // from the OSM address of the node above
    lon: 114.1173,
    lat: 22.4335,
    tier: "explore",
    sourceUrl: "https://www.openstreetmap.org/node/4959391427",
    coordsVerified: false,
    radiusM: 1500,
  },
  privacy: "public",
  expected3d: "high",
  elevation: "copDem30",
  boundaries: "osm",
  validation: "fail",
};
