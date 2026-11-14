// Cornell University Ruminant Center, Harford NY (hero twin).
// Verified 2026-11-13 on https://cals.cornell.edu/about/our-locations: "located about 15 miles southeast of our Ithaca
// campus", "some 2600 acres, with dairy, beef and sheep units", managed by the Department of Animal Science.
// Coordinates are NOT printed there: the pin is the OpenStreetMap point of relation 6483196 (-76.2541, 42.4409),
// data © OpenStreetMap contributors, ODbL. TODO(verify): farm centre and extent with Cornell. Area ("some 2600
// acres") is approximate on the source, so no hectare figure is shown.
// Fields, crops and rotation are illustrative (Cornell's field records are not public): the UI says so.
import type { FarmField } from "@/components/globe/types";

import type { FarmInfo, TwinSpec } from "./index";
import { CORNELL_TRACED } from "./traced/cornell";

export const CORNELL: FarmInfo = {
  id: "cornell-ruminant",
  name: "Cornell University Ruminant Center",
  owner: "Cornell University (Department of Animal Science)",
  country: "United States",
  lon: -76.2541,
  lat: 42.4409,
  tier: "twin",
  sourceUrl: "https://cals.cornell.edu/about/our-locations",
  coordsVerified: false,
  radiusM: 1500,
  framing: CORNELL_TRACED.framing,
  note: { text: "Harford, New York: dairy, beef and sheep units, about 15 miles southeast of Ithaca." },
};

/** Names and crops are ours (illustrative, NY dairy); geometry is RENDER's trace (lib/farms/traced/cornell.ts). */
const META: Record<string, { name: string; crop: FarmField["crop"]; phase: number }> = {
  f1: { name: "North hay field", crop: "legume", phase: 2 },
  f2: { name: "Barn field", crop: "corn", phase: 0 },
  f3: { name: "South field", crop: "corn", phase: 1 },
};

export const CORNELL_TWIN: TwinSpec = {
  fields: CORNELL_TRACED.fields.map((f) => ({ ...f, name: META[f.id].name, crop: META[f.id].crop })),
  simBbox: CORNELL_TRACED.simBbox,
  simAreaLabel: "Simulation area (~1.3 km square)",
  phases: Object.fromEntries(CORNELL_TRACED.fields.map((f) => [f.id, META[f.id].phase])),
  overlayMask: [],
  rotationSet: "ny-dairy",
  cropLabels: {
    grass: "Grass pasture",
    corn: "Corn silage",
    cereal: "Oats (small grain)",
    legume: "Alfalfa–grass hay",
    cover: "Winter rye cover crop",
    berry: "Berries",
    bare: "Bare soil",
  },
  labels: ["Approximate field boundaries", "Illustrative field layout and crops (not farm records)"],
  attribution: ["Field outlines traced by FieldTwin on Google 3D imagery (approximate)"],
  outlineSource: "tracedOutlines",
  outlineDate: "2026-11-13",
};
