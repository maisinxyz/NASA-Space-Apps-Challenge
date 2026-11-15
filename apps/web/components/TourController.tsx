"use client";
// The global Reset key (R): re-centres the camera (matching the "Reset view" button) without wiping stores.
import { useEffect } from "react";

import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";

export function TourController() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTextEntry(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "r" || e.key === "R") {
        window.dispatchEvent(new Event(RESET_EVENT));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
