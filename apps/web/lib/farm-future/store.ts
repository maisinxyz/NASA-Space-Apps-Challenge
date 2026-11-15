"use client";
// One store for the farm view's Future / Compare modes. Every layer, card and number subscribes here, so the
// clock and the what-if sliders reach everything at once. "Now" mode leaves the existing farm view untouched.
import { create } from "zustand";

import type { StrategyId } from "./fixtures";
import { clampT, NO_WHAT_IF, tOf, type ClockT, type WhatIf } from "./model";

export type FutureMode = "now" | "future" | "compare";
export type LensId = "heat" | "rain" | "frost" | "water" | "stress" | "erosion" | "bare" | "uncertainty" | "soiltest";
export type Zoom = "10y" | "1y";
/** At most one panel is open; opening one closes the other. */
export type FuturePanel = "lens" | "whatif" | "soil" | "review" | null;

export type FutureState = {
  mode: FutureMode;
  t: ClockT;
  zoom: Zoom;
  playing: boolean;
  lens: LensId | null;
  strategyId: StrategyId;
  reviewFor: StrategyId | null;
  whatIf: WhatIf;
  panel: FuturePanel;
  /** Field to highlight after a review-flag deep link. */
  focusFieldId: string | null;

  setMode(m: FutureMode): void;
  setT(t: ClockT): void;
  setZoom(z: Zoom): void;
  setPlaying(p: boolean): void;
  setLens(l: LensId | null): void;
  setStrategy(id: StrategyId): void;
  setWhatIf(w: Partial<WhatIf>): void;
  resetWhatIf(): void;
  openPanel(p: FuturePanel): void;
  openReview(id: StrategyId | null): void;
  goTo(yearIndex: number, doy: number, fieldId?: string): void;
};

export const INITIAL_T = tOf(8, 194); // 14 July 2034, year 9 of 10

export const useFutureStore = create<FutureState>((set) => ({
  mode: "now",
  t: INITIAL_T,
  zoom: "10y",
  playing: false,
  lens: null,
  strategyId: "a",
  reviewFor: null,
  whatIf: NO_WHAT_IF,
  panel: null,
  focusFieldId: null,

  setMode: (mode) => set({ mode, playing: false, panel: null, reviewFor: null, ...(mode === "now" ? { lens: null } : {}) }),
  setT: (t) => set({ t: clampT(t) }),
  setZoom: (zoom) => set({ zoom }),
  setPlaying: (playing) => set({ playing }),
  // A lens and a panel share the screen: switching lens keeps the panel only if it is the lens's own card.
  setLens: (lens) => set((s) => ({ lens, panel: lens ? "lens" : s.panel === "lens" ? null : s.panel, zoom: lens === "erosion" ? "1y" : s.zoom })),
  setStrategy: (strategyId) => set({ strategyId }),
  setWhatIf: (w) => set((s) => ({ whatIf: { ...s.whatIf, ...w } })),
  resetWhatIf: () => set({ whatIf: NO_WHAT_IF }),
  openPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  openReview: (reviewFor) => set({ reviewFor, panel: reviewFor ? "review" : null }),
  goTo: (yearIndex, doy, fieldId) => set({ mode: "future", t: tOf(yearIndex, doy), focusFieldId: fieldId ?? null, panel: null, reviewFor: null, playing: false }),
}));

export function resetFutureInvestigation() {
  useFutureStore.setState(useFutureStore.getInitialState());
}
