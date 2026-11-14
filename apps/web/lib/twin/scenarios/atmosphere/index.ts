// OWNER: Person 1 (sky/weather engine). Folder: lib/twin/scenarios/atmosphere/** (renderer: components/viewer/cesium/weather/**).
// RULES
//  - One evaluator per scenario id: (run: ScenarioRun) => AtmosphereState. Pure and deterministic: same run, same output.
//  - Add your own files in this folder (one per scenario is fine) and register them below. Do not edit the registry,
//    the contract types (components/globe/types.ts, lib/twin/scenario.ts) or ground/**.
//  - Read run.inputs by the input ids in lib/twin/scenarios/registry.ts; run.progress is 0..1; run.timeS is wall seconds.
//  - Only rainRateMmH is data-driven; everything else is mood. The UI captions it "Illustrative weather effect".
//  - Test on /dev/scenarios (turn on "Fixture run source"); the real twin never calls these until the backend exists.
import type { AtmosphereEvaluator, ScenarioId } from "../../scenario";
import { calm, climateShift, compound, drought, frost, heatWave, storm, wetSpell } from "./evaluators";

export { compoundHandoff, stormCurve, type AtmosphereWithBaseline } from "./evaluators";

export const ATMOSPHERE: Record<ScenarioId, AtmosphereEvaluator> = {
  storm,
  "wet-spell": wetSpell,
  "flood-zones": calm,
  drought,
  "heat-wave": heatWave,
  frost,
  "bare-soil": calm,
  "veg-stress": calm,
  "multi-year": calm,
  trends: calm,
  "climate-shift": climateShift,
  compound,
};
