"use client";
// Everything Future / Compare mode adds on top of the farm view, mounted from FarmView. "Now" renders nothing
// here, so today's farm view is unchanged.
import { useEffect } from "react";

import { useFutureStore } from "@/lib/farm-future/store";

import { CompareView, ReviewDrawer } from "./Compare";
import { WhatIf } from "./Controls";
import { LensCard } from "./LensCards";
import { SoilHealthPanel } from "./SoilHealth";
import { EFFECTS_CSS } from "./MapEffects";
import { FF_CSS } from "./styles";

export const FUTURE_CSS = FF_CSS + EFFECTS_CSS;

/** Cards and drawers for Future mode (the map effects and timeline are placed by FarmView). */
export function FutureLayer({ legendShown = false }: { legendShown?: boolean }) {
  const mode = useFutureStore((s) => s.mode);
  useFutureKeys();
  if (mode === "now") return null;
  if (mode === "compare") return <CompareView />;
  return (
    <>
      <LensCard />
      <SoilHealthPanel />
      <WhatIf raised={legendShown} />
      <ReviewDrawer />
    </>
  );
}

/** Esc closes the open panel or the review drawer. */
function useFutureKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useFutureStore.getState();
      if (s.mode === "now") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") {
        if (s.panel) s.openPanel(null);
        else if (s.reviewFor) s.openReview(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
