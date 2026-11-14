// Shared UI state (PRD §4.2) for the homepage globe and the farm twin.
// Update with useAppStore.setState({...}); reset() restores initialState (demo Reset key).
import { create } from "zustand";

import type { FarmSurface, GlobeView, LookFilter } from "@/components/globe/types";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/twin/rotations";

export type TwinMode = "explore" | "simulate" | "compare" | "evidence";
export const TWIN_MODES: TwinMode[] = ["explore", "simulate", "compare", "evidence"];

export interface AppState {
  /** Homepage globe: the selected farm (lib/farms.ts id), or null. */
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
  /** Farm-view surface: Google photoreal 3D tiles, or terrain only. */
  twinSurface: FarmSurface;
  /** Illustrative look filter (not sensor data). */
  look: LookFilter;
  /** HUD: H hides all panels; each panel can also be collapsed on its own. */
  panelsHidden: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
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
  priorities: DEFAULT_WEIGHTS,
  exaggeration: 1,
  twinSurface: "google",
  look: "none",
  panelsHidden: false,
  leftOpen: true,
  rightOpen: true,
};

export const useAppStore = create<AppState & { reset(): void }>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}));

/** Presenter mode lives outside AppState so the Reset key does not turn it off mid-demo. */
export const usePresenter = create<{ presenter: boolean }>()(() => ({ presenter: false }));

/** Page chrome: set by GlobeHome while the twin workspace is on screen, so the header collapses to a slim bar. */
export const useChrome = create<{ twinFarm: string | null }>()(() => ({ twinFarm: null }));
