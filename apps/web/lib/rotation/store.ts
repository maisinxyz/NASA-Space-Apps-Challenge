// Shared state for the rotation decision-support screens: one scenario (FE2 sliders write, FE1 results read)
// and the farmer's request (FE1 form). Separate from useAppStore so the storm/drought scenario system is untouched.
import { create } from "zustand";

import { CRITERIA, type Criterion, type FarmerConstraints, type RotationAnalysisRequest, type ScenarioInput, type ScenarioPreset, type WeightPreset } from "./draft-types";

/**
 * Preset slider values. PRD §12.1: values live in backend config and are "TODO(verify) with the team".
 * TODO(verify): placeholders until the backend returns them in the analysis response's `scenario` echo.
 */
export const SCENARIO_PRESET_VALUES: Record<ScenarioPreset, { rain_scale_pct: number; temp_offset_c: number }> = {
  baseline: { rain_scale_pct: 0, temp_offset_c: 0 },
  wetter_winters: { rain_scale_pct: 15, temp_offset_c: 0 },
  drier_summers: { rain_scale_pct: -15, temp_offset_c: 1 },
  both: { rain_scale_pct: 0, temp_offset_c: 1 },
};

/** PRD §12.1 suggested ranges (assumed, backend config). */
export const RAIN_RANGE = { min: -50, max: 50, step: 5 } as const;
export const TEMP_RANGE = { min: -3, max: 5, step: 0.5 } as const;
export const SCENARIO_LABEL = "modeled scenario, not a forecast";

export const DEFAULT_CRITERION_WEIGHT = 3;

export interface FarmerRequestState {
  criteria_selected: Criterion[];
  weights: Record<Criterion, number>;
  weight_preset: WeightPreset | null;
  constraints: FarmerConstraints;
  /** Empty = all crops allowed. */
  allowed_crops: string[];
}

export interface RotationState {
  rotScenario: ScenarioInput;
  farmerRequest: FarmerRequestState;
}

export const initialRotationState: RotationState = {
  rotScenario: { preset: "baseline", ...SCENARIO_PRESET_VALUES.baseline },
  farmerRequest: {
    criteria_selected: [...CRITERIA],
    weights: Object.fromEntries(CRITERIA.map((c) => [c, DEFAULT_CRITERION_WEIGHT])) as Record<Criterion, number>,
    weight_preset: null,
    constraints: { low_water: false, no_specialty_equipment: false, no_local_market: false },
    allowed_crops: [],
  },
};

export const useRotationStore = create<RotationState & { reset(): void }>()((set) => ({
  ...initialRotationState,
  reset: () => set(initialRotationState),
}));

export function setScenarioPreset(preset: ScenarioPreset) {
  useRotationStore.setState({ rotScenario: { preset, ...SCENARIO_PRESET_VALUES[preset] } });
}

/** Custom slider values override the preset (PRD §12.1); the preset name is kept for the label. */
export function setScenarioValues(v: Partial<Pick<ScenarioInput, "rain_scale_pct" | "temp_offset_c">>) {
  useRotationStore.setState((s) => ({ rotScenario: { ...s.rotScenario, ...v } }));
}

export function updateFarmerRequest(patch: Partial<FarmerRequestState>) {
  useRotationStore.setState((s) => ({ farmerRequest: { ...s.farmerRequest, ...patch } }));
}

/** The API request from the current store state (null preset becomes absent). */
export function buildAnalysisRequest(s: RotationState = useRotationStore.getState()): RotationAnalysisRequest {
  const { weight_preset, ...rest } = s.farmerRequest;
  return { ...rest, ...(weight_preset && { weight_preset }), scenario: s.rotScenario };
}
