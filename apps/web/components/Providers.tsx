"use client";
import { MotionConfig } from "framer-motion";
import { useEffect } from "react";

import { usePresenter } from "@/lib/store";

import { TourController } from "./TourController";

/** Client-wide wiring: reduced motion for framer-motion, presenter flag on <html>, the tour and Reset key. */
export function Providers({ children }: { children: React.ReactNode }) {
  const presenter = usePresenter((s) => s.presenter);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-presenter", presenter);
  }, [presenter]);
  // No copying page text (globals.css also blocks selection); typing fields keep copy/cut/paste.
  useEffect(() => {
    const block = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <TourController />
    </MotionConfig>
  );
}
