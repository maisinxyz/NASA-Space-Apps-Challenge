// Shared UI state (PRD §4.2) for the homepage globe and the farm twin.
// Update with useAppStore.setState({...}); reset() restores initialState (demo Reset key).
import { create } from "zustand";

import type { DetailLevel, FarmSurface, GlobeView, LookFilter } from "@/components/globe/types";
import type { ScenarioSpeed } from "@/lib/twin/scenarios/clock";
import type { ScenarioId } from "@/lib/twin/scenario";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/twin/rotations";

export type TwinMode = "explore" | "simulate" | "compare" | "evidence";
export const TWIN_MODES: TwinMode[] = ["explore", "simulate", "compare", "evidence"];

export interface AppState {
  /** Homepage globe: the selected farm (lib/farms id), or null. */
  farmId: string | null;
  /** Homepage globe: whole Earth, or flown in to farmId. */
  globeView: GlobeView;
  /** Farm twin (homepage farm view): active mode and selected field. */
  twinMode: TwinMode;
  twinFieldId: string | null;
  /** Compare mode: rotation shown on the left (A) and right (B) of the split, and the split position (0..1, left = A). */
  compareA: string;
  compareB: string;
  divider: number;
  /** Rotation year (0-based) and month (0 = Jan) shown on the fields in Compare. */
  twinYear: number;
  twinMonth: number;
  priorities: Weights;
  /** Terrain vertical exaggeration, 1–3; 1 = true scale. */
  exaggeration: number;
  /** Compare: colour the fields with the crop shown (illustrative). Off by default so the real imagery stays visible. */
  showCropFills: boolean;
  /** Farm-view surface: Google photoreal 3D tiles, or terrain only. */
  twinSurface: FarmSurface;
  /** Illustrative look filter (not sensor data). */
  look: LookFilter;
  /** HUD: H hides all panels; each panel can also be collapsed on its own. */
  panelsHidden: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  /** Simulate: the chosen scenario (null = the card list), its inputs per scenario id, and the scenario clock. */
  scenarioId: ScenarioId | null;
  scenarioInputs: Record<string, Record<string, number>>;
  /** 0..1 along the scenario's own clock. */
  scenarioProgress: number;
  scenarioPlaying: boolean;
  scenarioSpeed: ScenarioSpeed;
  /** Rotation used by rotation-dependent scenarios (one of the farm's rotation ids). */
  scenarioRotation: string;
  /** Effects/render detail for the 3D farm. */
  detail: DetailLevel;
}

export const initialState: AppState = {
  farmId: null,
  globeView: "globe",
  twinMode: "explore",
  twinFieldId: null,
  compareA: "rot_existing",
  compareB: "rot_cover",
  divider: 0.5,
  twinYear: 0,
  twinMonth: 6,
  showCropFills: false,
  priorities: DEFAULT_WEIGHTS,
  exaggeration: 1,
  twinSurface: "google",
  look: "none",
  panelsHidden: false,
  leftOpen: true,
  rightOpen: true,
  scenarioId: null,
  scenarioInputs: {},
  scenarioProgress: 0,
  scenarioPlaying: false,
  scenarioSpeed: 1,
  scenarioRotation: "rot_existing",
  detail: "medium",
};

export const useAppStore = create<AppState & { reset(): void }>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}));

/** Twin state that belongs to one farm (field ids, rotation ids): reset whenever another farm is chosen. */
const perFarm = (({ twinMode, twinFieldId, compareA, compareB, divider, twinYear, twinMonth, showCropFills, leftOpen, rightOpen, scenarioId, scenarioProgress, scenarioPlaying, scenarioRotation }: AppState) => ({ twinMode, twinFieldId, compareA, compareB, divider, twinYear, twinMonth, showCropFills, leftOpen, rightOpen, scenarioId, scenarioProgress, scenarioPlaying, scenarioRotation }))(initialState);

/** Pick a farm (null = none, back to the whole globe). A different farm starts from the default twin state. */
export function selectFarm(id: string | null) {
  const prev = useAppStore.getState().farmId;
  useAppStore.setState({ farmId: id, ...(id === null && { globeView: "globe" as const }), ...(id !== prev && perFarm) });
}

/** Presenter mode lives outside AppState so the Reset key does not turn it off mid-demo. */
export const usePresenter = create<{ presenter: boolean }>()(() => ({ presenter: false }));

/** Page chrome: set by GlobeHome while the twin workspace is on screen, so the header collapses to a slim bar. */
export const useChrome = create<{ twinFarm: string | null }>()(() => ({ twinFarm: null }));
