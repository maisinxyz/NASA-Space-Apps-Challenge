// Climate scenarios for the farm twin (Simulate mode). The 12 definitions (copy, inputs, basis, data needs) live in
// lib/twin/scenarios/registry.ts. How each scenario LOOKS is split between two owners:
//   - sky/air:      lib/twin/scenarios/atmosphere/**  -> AtmosphereState  (weather engine renders it)
//   - ground layers: lib/twin/scenarios/ground/**      -> GroundLayerSpec[] (ground renderer draws it)
// Rules (CLAUDE.md): never ship made-up results in the real twin. Real scenario data comes from the backend; until
// then a scenario shows "waiting for the backend". Sample inputs exist only on the dev page /dev/scenarios.
import type { AtmosphereState, GroundLayerSpec } from "@/components/globe/types";
import type { BasisOrRelative } from "@/lib/api/types";

export type ScenarioFamily = "rain-water" | "dry-hot" | "cold" | "seasons-years";

export type ScenarioId =
  | "storm"
  | "wet-spell"
  | "flood-zones"
  | "drought"
  | "heat-wave"
  | "frost"
  | "bare-soil"
  | "veg-stress"
  | "multi-year"
  | "trends";

/** What the scenario shows: animated frames, a static zone layer, a series/strip, or a multi-year timeline. */
export type OutputKind = "frames" | "zones" | "series" | "timeline";

/** The scenario's own clock: an event in hours, a season in months, several years, decades, or none (static). */
export type TimeKind = "event-hours" | "season-months" | "multi-year" | "decades" | "static";

/** One adjustable input (what-if slider). Inputs change the scenario's INPUT only; results come from the backend. */
export interface ScenarioInput {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Plain-language one-liner shown under the slider. */
  hint?: string;
  /** Basis label of this input's readout; default "assumed" (a user choice, not data). */
  basis?: BasisOrRelative | "assumed" | "synthetic";
}

/** The state both visual owners evaluate. Pure and deterministic: same run state -> same output. */
export interface ScenarioRun {
  scenarioId: ScenarioId;
  farmId: string;
  /** Normalised scenario progress 0..1 (event hours / months / years / decades, by TimeKind). */
  progress: number;
  /** Current values of the scenario's inputs, by input id. */
  inputs: Record<string, number>;
  rotationId: string | null;
  /** Wall-clock animation seconds, for continuous motion (ripples, drift) independent of progress. */
  timeS: number;
}

export interface ScenarioReadout {
  label: string;
  value: string;
  unit?: string;
  basis: BasisOrRelative | "assumed" | "synthetic";
}

export interface ScenarioDef {
  id: ScenarioId;
  family: ScenarioFamily;
  label: string;
  /** Short card sentence. */
  summary: string;
  /** One plain-language "what this means" line for farmers. */
  plainMeaning: string;
  timeKind: TimeKind;
  outputKind: OutputKind;
  /** Human text for the scenario length, e.g. "3 days, hourly" or "1 growing season". */
  durationLabel: string;
  /** Progress units per scenario hour/month/year at 1x speed; the clock maps wall seconds to progress. */
  secondsAtOneX: number;
  inputs: ScenarioInput[];
  /** Data the backend must supply for a REAL run, named plainly (no invented dataset ids). */
  dataNeeds: string[];
  basis: BasisOrRelative | "assumed" | "synthetic";
  /** Colour key shown in the legend, low to high. */
  legend: { color: string; label: string }[];
  /** Caption shown under the map for the effect. Always includes "Illustrative weather effect" when sky effects are used. */
  effectCaption: string;
  /** True when the scenario depends on the chosen rotation (cover, crops). */
  rotationDependent: boolean;
}

/** What the screen needs each frame; composed by the registry from the two owners' evaluators. */
export interface ScenarioFrame {
  atmosphere: AtmosphereState;
  ground: GroundLayerSpec[];
  readouts: ScenarioReadout[];
}

/** The sky/air evaluator signature (owner: weather engine person). */
export type AtmosphereEvaluator = (run: ScenarioRun) => AtmosphereState;
/** The ground evaluator signature (owner: ground layers person). */
export type GroundEvaluator = (run: ScenarioRun) => GroundLayerSpec[];

export { SCENARIO_DEFS as SCENARIOS } from "./scenarios/registry";
