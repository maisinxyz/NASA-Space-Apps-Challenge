// Beltsville Agricultural Research Center (USDA-ARS), MD: field rings from OpenStreetMap (© OpenStreetMap
// contributors, ODbL 1.0, https://www.openstreetmap.org/copyright). Fetched 2026-11-13 from overpass-api.de with:
//   [out:json][timeout:25];(way["landuse"~"^(farmland|meadow)$"](39.005,-76.925,39.06,-76.84);
//   relation["landuse"~"^(farmland|meadow)$"](39.005,-76.925,39.06,-76.84););out geom;
// Ways 224922167 (f1), 224819517 (f2), 224922168 (f3); closing point dropped, 6 decimals. Checked against Google
// Photorealistic 3D Tiles in /dev/trace: the edges match the imagery. OSM mapping is community data, not USDA plot
// boundaries. The farm point (39.0319, -76.8844) is approximate (campus point); TODO(verify) with ARS.
import type { TracedFarm } from "./types";

export const BELTSVILLE_TRACED: TracedFarm = {
  fields: [
    {
      // OSM way 224922167: south and east of the building cluster, north of the road.
      id: "f1",
      ring: [[-76.889591, 39.031993], [-76.889538, 39.030893], [-76.889709, 39.030876], [-76.889656, 39.030051], [-76.889162, 39.030034], [-76.889119, 39.029159], [-76.893615, 39.029067], [-76.893464, 39.027459], [-76.890299, 39.027517], [-76.887596, 39.027817], [-76.887875, 39.029584], [-76.888014, 39.030251], [-76.887885, 39.031851]],
      areaHa: 12.8,
    },
    {
      // OSM way 224819517: east of f1, north of the road.
      id: "f2",
      ring: [[-76.887596, 39.027817], [-76.887875, 39.029584], [-76.888014, 39.030251], [-76.887885, 39.031851], [-76.885858, 39.031768], [-76.884667, 39.031734], [-76.883937, 39.031768], [-76.88383, 39.030176], [-76.884184, 39.029684], [-76.884227, 39.029092], [-76.884055, 39.028176]],
      areaHa: 14.0,
    },
    {
      // OSM way 224922168: south of the road (notch around a wooded lot on its west side).
      id: "f3",
      ring: [[-76.889377, 39.027392], [-76.888958, 39.026059], [-76.889945, 39.025905], [-76.890836, 39.025825], [-76.891404, 39.027226], [-76.893507, 39.027242], [-76.893379, 39.025567], [-76.892853, 39.025559], [-76.892649, 39.025392], [-76.892563, 39.025092], [-76.892628, 39.024683], [-76.892499, 39.024458], [-76.884753, 39.0256], [-76.884742, 39.026934], [-76.885031, 39.026917], [-76.885268, 39.026667], [-76.885525, 39.026725], [-76.885643, 39.027034], [-76.88545, 39.027284], [-76.885429, 39.027701], [-76.886823, 39.027701]],
      areaHa: 16.6,
    },
  ],
  // 1300 m square centred -76.889, 39.0285: the three fields plus the barns/silos to the north-west.
  simBbox: [-76.896516, 39.022662, -76.881484, 39.03434],
  // Looking NNW across the barns, silos and manure ring with f1 on the right.
  framing: { lon: -76.890049, lat: 39.030066, rangeM: 400, pitchDeg: -30, headingDeg: 330 },
  source: "Field rings: © OpenStreetMap contributors (ODbL), ways 224922167, 224819517, 224922168, fetched 2026-11-13.",
};
