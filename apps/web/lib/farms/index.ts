// Farm registry: the pins on the homepage globe (FARMS) and, for "twin" farms, the twin config (twinConfig).
// One file per farm (lib/farms/<id>.ts) holds its facts, sources and twin data. Components read the current farm
// through farmById / twinConfig only and never import a farm file (tested in farms.test.ts). Promoting an explore
// farm to a twin is a data change: give it a twin config and set tier "twin".
import type { CropLook, Farm, FarmField } from "@/components/globe/types";
import type { SourceId } from "@/lib/provenance";
import { ROTATION_SETS, type RotationSetId, type TwinRotation } from "@/lib/twin/rotations";

import { BELTSVILLE, BELTSVILLE_TWIN } from "./beltsville";
import { CORNELL, CORNELL_TWIN } from "./cornell";
import { LANCASTER } from "./lancaster";
import { MEAD } from "./mead";
import { OAKVILLE } from "./oakville";

export type Bbox = [number, number, number, number];

/** A pin plus an optional card note (e.g. privacy wording, a link to in-ground data). */
export type FarmInfo = Farm & { note?: { text: string; url?: string; linkText?: string } };

/** What a farm file declares for its twin. */
export type TwinSpec = {
  fields: FarmField[];
  /** Simulation square [west, south, east, north] degrees. */
  simBbox: Bbox;
  simAreaLabel: string;
  /** Fields that follow the chosen rotation, with their year offset; the others keep `field.crop`. */
  phases: Record<string, number>;
  /** Building footprints where overlays must not draw. */
  overlayMask: [number, number][][];
  rotationSet: RotationSetId;
  /** Regional names for the crop looks (e.g. legume = soybean in Maryland, alfalfa–grass hay in New York). */
  cropLabels: Record<CropLook, string>;
  /** Honesty notes always shown over the twin map. */
  labels: string[];
  /** Credit lines for the field outlines and other map data of this twin. */
  attribution: string[];
  /** Where the field outlines come from, and when they were made (ISO date). */
  outlineSource: SourceId;
  outlineDate: string;
};

export type TwinConfig = TwinSpec & { rotations: TwinRotation[] };

export const FARMS: FarmInfo[] = [CORNELL, BELTSVILLE, LANCASTER, OAKVILLE, MEAD];

export const farmById = (id: string | null) => FARMS.find((f) => f.id === id) ?? null;

const TWINS: Record<string, TwinConfig> = Object.fromEntries(
  ([[CORNELL.id, CORNELL_TWIN], [BELTSVILLE.id, BELTSVILLE_TWIN]] as const).map(([id, t]) => [id, { ...t, rotations: ROTATION_SETS[t.rotationSet] }]),
);

/** The twin of a "twin"-tier farm, or undefined (explore-only farm or unknown id). */
export const twinConfig = (farmId: string | null): TwinConfig | undefined => (farmId && farmById(farmId)?.tier === "twin" ? TWINS[farmId] : undefined);
