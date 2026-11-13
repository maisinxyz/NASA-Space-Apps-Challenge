// Shared UI state (PRD §4.2). UI writes it; the viewer page passes it to <TwinViewer /> as props.
// Update with useAppStore.setState({...}); reset() restores initialState (demo Reset key).
import { create } from "zustand";

import type { GlobeView } from "@/components/globe/types";
import type { TwinViewerProps, ViewerLayerName, ViewerQuality } from "@/components/viewer";
import type { Weights } from "@/lib/twin/rotations";

export type TwinMode = "explore" | "simulate" | "compare" | "evidence";

export interface AppState {
  siteId: string | null;
  terrainId: string | null;
  selectedFieldId: string | null;
  stormId: string | null;
  /** Empty until rotations are chosen; otherwise exactly the viewer's tuple (left/only first). */
  rotationIds: [] | TwinViewerProps["rotationIds"];
  /** Rotations chosen for the simulation (max 3); A/B in rotationIds come from these. */
  simRotationIds: string[];
  /** Minutes from storm start. */
  timeMin: number;
  playing: boolean;
  mode: TwinViewerProps["mode"];
  layers: ViewerLayerName[];
  quality: ViewerQuality;
  /** Guided-tour beat index; null when no tour is running. */
  tourStep: number | null;
  showDiff: boolean;
  simId: string | null;
  /** Split divider, 0..1 of the canvas width. */
  divider: number;
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
  photoreal: boolean;
  /** Terrain vertical exaggeration, 1–3. */
  exaggeration: number;
}

export const initialState: AppState = {
  siteId: null,
  terrainId: null,
  selectedFieldId: null,
  stormId: null,
  rotationIds: [],
  simRotationIds: [],
  timeMin: 0,
  playing: false,
  mode: "single",
  layers: [],
  quality: "auto",
  tourStep: null,
  showDiff: false,
  simId: null,
  divider: 0.5,
  farmId: null,
  globeView: "globe",
  twinMode: "explore",
  twinFieldId: null,
  twinRotationId: null,
  twinYear: 0,
  twinMonth: 6,
  priorities: { water: 1, erosion: 1, soilCover: 1, income: 1 },
  photoreal: false,
  exaggeration: 1,
};

export const useAppStore = create<AppState & { reset(): void }>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}));

/** Presenter mode lives outside AppState so the Reset key does not turn it off mid-demo. */
export const usePresenter = create<{ presenter: boolean }>()(() => ({ presenter: false }));
