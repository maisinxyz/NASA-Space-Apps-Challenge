// OWNER: Person 2 (ground & data layers). Folder: lib/twin/scenarios/ground/** (renderer: components/viewer/cesium/ground/**).
// RULES
//  - One evaluator per scenario id: (run: ScenarioRun) => GroundLayerSpec[]. Pure and deterministic.
//  - Add your own files in this folder (one per scenario is fine) and register them below. Do not edit the registry,
//    the contract types (components/globe/types.ts, lib/twin/scenario.ts) or atmosphere/**.
//  - Read run.inputs by the input ids in lib/twin/scenarios/registry.ts; run.progress is 0..1; run.rotationId is the chosen rotation.
//  - No invented results in the real twin: real layers need backend data. Sample values are for /dev/scenarios only
//    (turn on "Fixture run source"); the real twin never calls these until the backend exists.
import type { GroundEvaluator, ScenarioId } from "../../scenario";
import { storm } from "./storm";
import { wetSpell } from "./wetSpell";
import { floodZones } from "./floodZones";
import { drought } from "./drought";
import { heatWave } from "./heatWave";
import { frost } from "./frost";
import { bareSoil } from "./bareSoil";
import { vegStress } from "./vegStress";
import { multiYear } from "./multiYear";
import { trends } from "./trends";

export { tooWetDays } from "./wetSpell";

export const GROUND: Record<ScenarioId, GroundEvaluator> = {
  storm: storm,
  "wet-spell": wetSpell,
  "flood-zones": floodZones,
  drought: drought,
  "heat-wave": heatWave,
  frost: frost,
  "bare-soil": bareSoil,
  "veg-stress": vegStress,
  "multi-year": multiYear,
  trends: trends,
};
