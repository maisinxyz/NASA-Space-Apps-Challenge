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

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <TourController />
    </MotionConfig>
  );
}
