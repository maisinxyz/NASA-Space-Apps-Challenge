"use client";
// The global Reset key (R): resets the store and tells listeners (GlobeHome re-centres the camera). Mounted once
// in the root layout. The guided demo runner was removed with the legacy pages (S1-P0).
import { useEffect } from "react";

import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";
import { useAppStore } from "@/lib/store";

export function TourController() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTextEntry(e.target)) return;
      if (e.key === "r" || e.key === "R") {
        useAppStore.getState().reset();
        window.dispatchEvent(new Event(RESET_EVENT));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
