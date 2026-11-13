// Shared UI state (PRD §4.2) for the homepage globe and the farm twin.
// Update with useAppStore.setState({...}); reset() restores initialState (demo Reset key).
import { create } from "zustand";

import type { FarmSurface, GlobeView } from "@/components/globe/types";
import type { Weights } from "@/lib/twin/rotations";

export type TwinMode = "explore" | "simulate" | "compare" | "evidence";

export interface AppState {
  /** Homepage globe: the selected farm (lib/farms.ts id), or null. */
  farmId: string | null;
  /** Homepage globe: whole Earth, or flown in to farmId. */
  globeView: GlobeView;
  /** Farm twin (homepage farm view): active mode, selected field, rotation + season shown on the fields, layers. */
  twinMode: TwinMode;
  twinFieldId: string | null;
  /** null = each field shows its illustrative current crop. */
  twinRotationId: string | null;
  /** Rotation year (0-based) and month (0 = Jan) shown on the fields. */
  twinYear: number;
  twinMonth: number;
  priorities: Weights;
  /** Terrain vertical exaggeration, 1–3; 1 = true scale. */
  exaggeration: number;
  /** Farm-view surface: Google photoreal 3D tiles, or terrain only. */
  twinSurface: FarmSurface;
}

export const initialState: AppState = {
  farmId: null,
  globeView: "globe",
  twinMode: "explore",
  twinFieldId: null,
  twinRotationId: null,
  twinYear: 0,
  twinMonth: 6,
  priorities: { water: 1, erosion: 1, soilCover: 1, income: 1 },
  exaggeration: 1,
  twinSurface: "google",
};

export const useAppStore = create<AppState & { reset(): void }>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}));

/** Presenter mode lives outside AppState so the Reset key does not turn it off mid-demo. */
export const usePresenter = create<{ presenter: boolean }>()(() => ({ presenter: false }));
