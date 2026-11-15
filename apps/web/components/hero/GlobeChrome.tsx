"use client";

import type { ReactNode } from "react";

export function GlobeChrome({ controls }: { controls: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <h1 className="absolute left-6 top-5 text-4xl font-bold uppercase tracking-[0.12em] text-white sm:text-6xl" style={{ fontFamily: "'Times New Roman', Times, serif" }}>STARDEW EARTH</h1>
      <div className="pointer-events-auto absolute right-4 top-4 text-white">{controls}</div>
    </div>
  );
}
