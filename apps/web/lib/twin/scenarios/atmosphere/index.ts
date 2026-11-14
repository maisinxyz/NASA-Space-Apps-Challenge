// OWNER: Person 1 (sky/weather engine). Folder: lib/twin/scenarios/atmosphere/** (renderer: components/viewer/cesium/weather/**).
// RULES
//  - One evaluator per scenario id: (run: ScenarioRun) => AtmosphereState. Pure and deterministic: same run, same output.
//  - Add your own files in this folder (one per scenario is fine) and register them below. Do not edit the registry,
//    the contract types (components/globe/types.ts, lib/twin/scenario.ts) or ground/**.
//  - Read run.inputs by the input ids in lib/twin/scenarios/registry.ts; run.progress is 0..1; run.timeS is wall seconds.
//  - Only rainRateMmH is data-driven; everything else is mood. The UI captions it "Illustrative weather effect".
//  - Test on /dev/scenarios (turn on "Fixture run source"); the real twin never calls these until the backend exists.
import { type AtmosphereState, CLEAR_SKY } from "@/components/globe/types";

import type { AtmosphereEvaluator, ScenarioId } from "../../scenario";

const clear: AtmosphereEvaluator = (): AtmosphereState => CLEAR_SKY;

export const ATMOSPHERE: Record<ScenarioId, AtmosphereEvaluator> = {
  storm: clear,
  "wet-spell": clear,
  "flood-zones": clear,
  drought: clear,
  "heat-wave": clear,
  frost: clear,
  "bare-soil": clear,
  "veg-stress": clear,
  "multi-year": clear,
  trends: clear,
  "climate-shift": clear,
  compound: clear,
};
