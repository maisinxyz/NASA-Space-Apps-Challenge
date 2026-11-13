// Agassiz twin: field layout. Real field boundaries and crops for this research farm are NOT public, so:
// - Boundaries: OpenStreetMap landuse=farmland ways within 1.5 km of the farm centre (lat 49.2482, lon -121.7637),
//   fetched 2026-11-13 from https://overpass-api.de/api/interpreter (OSM base timestamp 2026-11-13T19:28:05Z) with
//     [out:json][timeout:60];way["landuse"~"^(farmland|meadow|orchard)$"](around:1500,49.2482,-121.7637);out geom;
//   13 ways came back; only 3 adjacent ones are kept (f2 North paddock, f3 Berry block, f4 Centre field): the ones
//   inside the simulation square AGASSIZ_SIM_BBOX. f4 (largest, rotating) touches f2 (north, rotating, other phase) and
//   wraps f3 (perennial berries), so one square shows neighbours at different stages. Their OSM rings are unchanged.
//   Data (c) OpenStreetMap contributors, ODbL 1.0. OSM farmland outlines are mapped by volunteers and may not match
//   the farm's management fields: the UI says "Approximate field boundaries".
// - Names and crops: made up by us (Fraser Valley-plausible), not farm records: the UI says so.
// - areaHa: planar shoelace area of the ring (local equirectangular projection), rounded to 0.1 ha.
import type { FarmField } from "@/components/globe/types";

export const FIELDS_ATTRIBUTION = "Field outlines: © OpenStreetMap contributors, ODbL";
export const FIELDS_NOTES = ["Approximate field boundaries", "Illustrative field layout and crops (not farm records)"] as const;

export const AGASSIZ_FIELDS: FarmField[] = [
  {
    // OSM way 908624520
    id: "f2",
    name: "North paddock",
    areaHa: 8.2,
    crop: "legume",
    ring: [[-121.77216, 49.256721], [-121.772115, 49.255301], [-121.772, 49.253186], [-121.768604, 49.253647], [-121.767606, 49.253769], [-121.767421, 49.253904], [-121.767767, 49.254176], [-121.769156, 49.255152], [-121.769355, 49.255566], [-121.769838, 49.256231], [-121.770165, 49.25636], [-121.771324, 49.256609], [-121.77186, 49.256704]],
  },
  {
    // OSM way 908624522
    id: "f3",
    name: "Berry block",
    areaHa: 3.9,
    crop: "berry",
    ring: [[-121.762945, 49.251042], [-121.762435, 49.251003], [-121.761137, 49.249434], [-121.761614, 49.249298], [-121.762843, 49.249014], [-121.763363, 49.24878], [-121.763996, 49.248871], [-121.764806, 49.249739], [-121.764618, 49.249837], [-121.764269, 49.249925], [-121.764146, 49.249998], [-121.764028, 49.250247], [-121.764184, 49.250503], [-121.76383, 49.250713], [-121.763454, 49.250891], [-121.763277, 49.250874], [-121.763148, 49.250958], [-121.763116, 49.251028]],
  },
  {
    // OSM way 908624523
    id: "f4",
    name: "Centre field",
    areaHa: 35.5,
    crop: "corn",
    ring: [[-121.759817, 49.24803], [-121.760155, 49.247705], [-121.760203, 49.247599], [-121.760906, 49.247582], [-121.761147, 49.247705], [-121.762285, 49.248275], [-121.762526, 49.24843], [-121.763374, 49.247869], [-121.764398, 49.248135], [-121.764886, 49.2483], [-121.765466, 49.248738], [-121.765793, 49.249771], [-121.765975, 49.249834], [-121.765771, 49.250068], [-121.765128, 49.251213], [-121.764377, 49.251731], [-121.764119, 49.252176], [-121.764076, 49.25247], [-121.764597, 49.252796], [-121.765444, 49.253136], [-121.765841, 49.252968], [-121.766485, 49.253118], [-121.767531, 49.253363], [-121.768808, 49.253374], [-121.769913, 49.253216], [-121.770127, 49.253125], [-121.77038, 49.252848], [-121.771989, 49.252691], [-121.771978, 49.251136], [-121.772488, 49.250632], [-121.769446, 49.248734], [-121.766372, 49.246931], [-121.764334, 49.245638], [-121.76339, 49.245099], [-121.761791, 49.246174], [-121.760589, 49.247039], [-121.759629, 49.246693], [-121.759517, 49.246784], [-121.759914, 49.247158], [-121.759935, 49.247361], [-121.759844, 49.247743]],
  },
];

/**
 * Fields that follow the chosen rotation, with a year offset so neighbouring fields are at different stages
 * (as on a real farm). The others are perennial (grass, berries) and keep their crop.
 */
export const ROTATING_FIELDS: Record<string, number> = { f2: 2, f4: 0 };

/**
 * The simulation square [west, south, east, north]: ~1.4 km x 1.4 km in metres, centred on the kept fields
 * (centre 49.2509 N, -121.7658 E). Half-width 700 m = 0.006288 deg lat = 0.009634 deg lon (cos 49.25 deg = 0.6527).
 */
export const AGASSIZ_SIM_BBOX: [number, number, number, number] = [-121.77543, 49.24461, -121.75617, 49.25719];
export const SIM_AREA_LABEL = "Simulation area (~1.4 km square)";

/**
 * Building footprints (rings of [lon, lat]) inside AGASSIZ_SIM_BBOX, passed to the globe as `overlayMask` so water/risk
 * overlays do not cover roofs on the photoreal surface.
 * TODO(verify): empty on purpose. overpass-api.de was unreachable on 2026-11-13 (connection timeouts, 5 tries). Fetch
 *   [out:json][timeout:60];way["building"](49.24461,-121.77543,49.25719,-121.75617);out geom;
 * from https://overpass-api.de/api/interpreter, store the rings here with the date and OSM base timestamp, and credit
 * "© OpenStreetMap contributors, ODbL". Never draw footprints by hand.
 */
export const AGASSIZ_BUILDINGS: [number, number][][] = [];
