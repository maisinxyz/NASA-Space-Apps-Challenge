// Shared UI state (PRD §4.2). UI writes it; the viewer page passes it to <TwinViewer /> as props.
// Update with useAppStore.setState({...}); reset() restores initialState (demo Reset key).
import { create } from "zustand";

import type { GlobeView } from "@/components/globe/types";
import type { TwinViewerProps, ViewerLayerName, ViewerQuality } from "@/components/viewer";

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
};

export const useAppStore = create<AppState & { reset(): void }>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}));

/** Presenter mode lives outside AppState so the Reset key does not turn it off mid-demo. */
export const usePresenter = create<{ presenter: boolean }>()(() => ({ presenter: false }));
