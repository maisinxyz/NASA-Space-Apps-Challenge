// Farmland near Intercourse, Lancaster County PA (explore only). Private working farmland: described by area only,
// never by owner, address or a personal source (user decision). The pin is the village centre of Intercourse,
// 40.0383, -76.1075, from https://en.wikipedia.org/wiki/Intercourse,_Pennsylvania (approximate; not a farm).
// minRangeM keeps the camera at least 250 m away for privacy.
import type { FarmInfo } from "./index";
import { LANCASTER_FRAMING, LANCASTER_MIN_RANGE_M } from "./traced/framings";

export const LANCASTER: FarmInfo = {
  id: "lancaster-intercourse",
  name: "Farmland near Intercourse, Lancaster County, PA",
  owner: "Private working farmland (area only)",
  country: "United States",
  locality: "Intercourse, Pennsylvania", // from the source cited above
  lon: -76.1075,
  lat: 40.0383,
  tier: "explore",
  sourceUrl: "https://en.wikipedia.org/wiki/Intercourse,_Pennsylvania",
  coordsVerified: false,
  radiusM: 1500,
  framing: LANCASTER_FRAMING,
  minRangeM: LANCASTER_MIN_RANGE_M,
  note: { text: "Private working farmland, area only. No owners or addresses are shown." },
};
