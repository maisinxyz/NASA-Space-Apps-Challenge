// Farm registry: the pins on the homepage globe (FARMS) and, for "twin" farms, the twin config (twinConfig).
// One file per farm (lib/farms/<id>.ts) holds its facts, sources and twin data. Components read the current farm
// through farmById / twinConfig only and never import a farm file (tested in farms.test.ts). Promoting an explore
// farm to a twin is a data change: give it a twin config and set tier "twin".
import type { CropLook, Farm, FarmField } from "@/components/globe/types";
import type { SourceId } from "@/lib/provenance";
import { ROTATION_SETS, type RotationSetId, type TwinRotation } from "@/lib/twin/rotations";

import { BELTSVILLE, BELTSVILLE_TWIN } from "./beltsville";
import { CANDIDATE_DATASETS, type CandidateDatasetId, passedCandidates } from "./candidates";
import { CORNELL, CORNELL_TWIN } from "./cornell";
import { OAKVILLE } from "./oakville";

export type Bbox = [number, number, number, number];

/** A pin plus an optional card note (e.g. privacy wording, a link to a public source). */
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

export { CANDIDATE_DATASETS, CANDIDATES, type Candidate, type CandidateDatasetId } from "./candidates";

/** Home-globe pins: the three chosen farms plus every scouted candidate that passed the 3D check (candidates/index.ts). */
export const FARMS: FarmInfo[] = [CORNELL, BELTSVILLE, OAKVILLE, ...passedCandidates().map((c) => c.farm)];

/** Elevation and boundary datasets of the pinned candidate farms (Methods page), without duplicates. */
export const pinnedCandidateDatasets = () =>
  [...new Set(passedCandidates().flatMap((c): CandidateDatasetId[] => [c.elevation, c.boundaries]))].map((id) => ({ id, ...CANDIDATE_DATASETS[id] }));

export const farmById = (id: string | null) => FARMS.find((f) => f.id === id) ?? null;

const TWINS: Record<string, TwinConfig> = Object.fromEntries(
  ([[CORNELL.id, CORNELL_TWIN], [BELTSVILLE.id, BELTSVILLE_TWIN]] as const).map(([id, t]) => [id, { ...t, rotations: ROTATION_SETS[t.rotationSet] }]),
);

/** The twin of a "twin"-tier farm, or undefined (explore-only farm or unknown id). */
export const twinConfig = (farmId: string | null): TwinConfig | undefined => (farmId && farmById(farmId)?.tier === "twin" ? TWINS[farmId] : undefined);
