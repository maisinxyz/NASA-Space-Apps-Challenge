// Cornell University Ruminant Center, Harford NY: fields traced by eye in /dev/trace on Google Photorealistic 3D
// Tiles (via Cesium ion), 2026-11-13. APPROXIMATE: edges follow roads/tree lines/crop changes visible in the imagery
// (~1-5 m), not a survey or an owner map. The Overpass API (overpass-api.de, 2026-11-13) returned no
// landuse=farmland/meadow polygons in 42.432,-76.258,42.452,-76.232, so nothing here comes from OSM.
// The site location itself is approximate (no published coordinates). TODO(verify) with Cornell before any claim.
import type { TracedFarm } from "./types";

export const CORNELL_TRACED: TracedFarm = {
  fields: [
    {
      // North of the barns: between the farm road (W), the county road (N) and the tree line (E).
      id: "f1",
      ring: [[-76.244719, 42.447186], [-76.24265, 42.447207], [-76.24196, 42.446289], [-76.240877, 42.444685], [-76.240241, 42.443178], [-76.243543, 42.443114], [-76.243583, 42.444664], [-76.245132, 42.444795], [-76.245024, 42.446008]],
      areaHa: 11.6,
    },
    {
      // East of the freestall barns, south of f1, north of the east-west farm road (bare patch in its south edge excluded).
      id: "f2",
      ring: [[-76.243457, 42.443095], [-76.240285, 42.443153], [-76.239614, 42.441999], [-76.238817, 42.441033], [-76.240842, 42.44095], [-76.240968, 42.441381], [-76.24145, 42.441438], [-76.241881, 42.441269], [-76.241995, 42.440912], [-76.24244, 42.440894], [-76.242237, 42.441675], [-76.242695, 42.442963]],
      areaHa: 5.3,
    },
    {
      // South of the east-west farm road, east of the southern barn.
      id: "f3",
      ring: [[-76.243354, 42.440762], [-76.238767, 42.440893], [-76.237558, 42.44048], [-76.236756, 42.439751], [-76.236309, 42.438628], [-76.236216, 42.437671], [-76.243756, 42.437514], [-76.244021, 42.438979], [-76.243467, 42.439827]],
      areaHa: 20.6,
    },
  ],
  // 1300 m square centred -76.242608, 42.4424: all three fields plus the barn cluster to the west.
  simBbox: [-76.25052, 42.436561, -76.234695, 42.448239],
  // Looking NNE over the freestall barns at f2 with f1 behind and f3 to the right.
  framing: { lon: -76.242216, lat: 42.441767, rangeM: 400, pitchDeg: -30, headingDeg: 20 },
  source: "Traced by eye on Google Photorealistic 3D Tiles imagery (approximate field edges); no OSM farmland polygons exist here.",
};
