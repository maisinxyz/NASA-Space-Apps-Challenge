// Twin configs for the two BC demo farms (v4 PRD F2). The field outlines are the ones sent to the engine in
// lib/forecast/{ubc,kpu}-request.json, so the 3D map, the field list and the forecast share one field list.
// UBC: six named UBC Farm plots from OpenStreetMap (ways 801371132, 801371128, 801371116, 801371115, 801371122,
// 801371107, fetched 2026-11-15). KPU: the four OpenStreetMap landuse=farmland ways nearest the farm pin
// (95899267, 95899276, 96026582, 95899281, Overpass API 2026-11-15); they are not named in OSM and are not confirmed
// as KPU's own fields. © OpenStreetMap contributors, ODbL 1.0.
import type { CropLook, FarmField } from "@/components/globe/types";
import type { ForecastRequest } from "@/lib/api/types";
import kpuRequest from "@/lib/forecast/kpu-request.json";
import ubcRequest from "@/lib/forecast/ubc-request.json";

import type { Bbox, TwinSpec } from "./index";

const M_PER_DEG_LAT = 110_540;

/** Square of side `sizeM` metres centred on (lon, lat), as [west, south, east, north]. */
export function squareAround(lon: number, lat: number, sizeM: number): Bbox {
  const dLat = sizeM / 2 / M_PER_DEG_LAT;
  const dLon = sizeM / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

type ReqField = NonNullable<ForecastRequest["fields"]>[number];

/** Request fields -> twin fields (ring without the closing point). */
export function fieldsFromRequest(req: { fields?: ReqField[] }, crop: CropLook): FarmField[] {
  return (req.fields ?? []).map((f) => {
    const ring = (f.polygon?.coordinates[0] ?? []) as unknown as [number, number][];
    const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
    return { id: f.field_id, name: f.name ?? f.field_id, ring: open, areaHa: f.area_ha, crop };
  });
}

const BC_CROP_LABELS: Record<CropLook, string> = {
  grass: "Grass / pasture",
  corn: "Corn",
  cereal: "Barley / winter wheat",
  legume: "Field pea / soybean",
  cover: "Fall rye cover crop",
  berry: "Berries",
  bare: "Bare soil",
};

const LABELS = ["Approximate field boundaries", "Illustrative field layout and crops (not farm records)"];
const OSM = "Field outlines: © OpenStreetMap contributors, ODbL";

const twinOf = (req: { fields?: ReqField[] }, crop: CropLook, centre: [number, number], area: string, extra: string[] = []): TwinSpec => {
  const fields = fieldsFromRequest(req, crop);
  return {
    fields,
    simBbox: squareAround(centre[0], centre[1], 1200),
    simAreaLabel: area,
    phases: Object.fromEntries(fields.map((f, i) => [f.id, i % 3])),
    overlayMask: [],
    rotationSet: "bc-mixed",
    cropLabels: BC_CROP_LABELS,
    labels: [...LABELS, ...extra],
    attribution: [OSM],
    outlineSource: "osm",
    outlineDate: "2026-11-15",
  };
};

export const UBC_TWIN: TwinSpec = twinOf(ubcRequest as unknown as { fields?: ReqField[] }, "cereal", [-123.236786, 49.249786], "Simulation area (~1.2 km square)");
export const KPU_TWIN: TwinSpec = twinOf(kpuRequest as unknown as { fields?: ReqField[] }, "grass", [-122.639547, 49.120367], "Simulation area (~1.2 km square)", [
  "Field outlines are OpenStreetMap farmland near the pin, not confirmed KPU fields",
]);
