// Henry A. Wallace Beltsville Agricultural Research Center, Beltsville MD (twin).
// Operator and address ("10300 Baltimore Avenue…") printed on
// https://www.ars.usda.gov/northeast-area/beltsville-md-barc/beltsville-agricultural-research-center/ (2026-11-13);
// no coordinates there, so the pin is approximate: 39.0319, -76.8844 from
// https://en.wikipedia.org/wiki/Henry_A._Wallace_Beltsville_Agricultural_Research_Center (a campus point; the fields
// are elsewhere on the site). Published acreage figures disagree (6,500 to 7,000 acres): area left out.
// TODO(verify): farm centre with USDA ARS. Fields, crops and rotation are illustrative, not ARS records.
import type { FarmField } from "@/components/globe/types";

import type { FarmInfo, TwinSpec } from "./index";
import { BELTSVILLE_TRACED } from "./traced/beltsville";

export const BELTSVILLE: FarmInfo = {
  id: "usda-barc",
  name: "Beltsville Agricultural Research Center",
  owner: "USDA Agricultural Research Service",
  country: "United States",
  locality: "Beltsville, Maryland", // from the source cited above
  lon: -76.8844,
  lat: 39.0319,
  tier: "twin",
  sourceUrl: "https://www.ars.usda.gov/northeast-area/beltsville-md-barc/beltsville-agricultural-research-center/",
  coordsVerified: false,
  radiusM: 1500,
  framing: BELTSVILLE_TRACED.framing,
};

/** Names and crops are ours (illustrative, Maryland grain); rings are OSM via RENDER (lib/farms/traced/beltsville.ts). */
const META: Record<string, { name: string; crop: FarmField["crop"]; phase: number }> = {
  f1: { name: "Barn field", crop: "corn", phase: 0 },
  f2: { name: "East field", crop: "legume", phase: 1 },
  f3: { name: "South field", crop: "cereal", phase: 1 },
};

export const BELTSVILLE_TWIN: TwinSpec = {
  fields: BELTSVILLE_TRACED.fields.map((f) => ({ ...f, name: META[f.id].name, crop: META[f.id].crop })),
  simBbox: BELTSVILLE_TRACED.simBbox,
  simAreaLabel: "Simulation area (~1.3 km square)",
  phases: Object.fromEntries(BELTSVILLE_TRACED.fields.map((f) => [f.id, META[f.id].phase])),
  overlayMask: [],
  rotationSet: "md-grain",
  cropLabels: {
    grass: "Grass / hay",
    corn: "Grain corn",
    cereal: "Winter wheat",
    legume: "Soybean",
    cover: "Cereal rye cover crop",
    berry: "Berries",
    bare: "Bare soil",
  },
  labels: ["Approximate field boundaries", "Illustrative field layout and crops (not farm records)"],
  attribution: ["Field outlines: © OpenStreetMap contributors, ODbL"],
  outlineSource: "osm",
  outlineDate: "2026-11-13",
};
