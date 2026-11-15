"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AboutPanel } from "@/components/globe/AboutPanel";

/** Compact public-site navigation, kept above the map and farm workspace. */
export function DesktopNavigation() {
  return (
    <nav aria-label="Primary navigation" className="pointer-events-auto absolute top-3 right-4 z-40 flex items-center gap-1 rounded-full border border-white/20 bg-[#111a20]/95 p-1 text-sm text-white shadow-lg">
      <Link href="/methods" className="min-h-9 rounded-full px-3 py-2 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
        Methods
      </Link>
      <Link href="/learn" className="min-h-9 rounded-full px-3 py-2 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
        Learn
      </Link>
      <AboutPanel className="min-h-9 rounded-full border border-white/20 px-3 py-1.5 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" />
    </nav>
  );
}

export function GlobeChrome({ controls }: { controls: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <h1 className="absolute left-6 top-5 text-4xl font-bold uppercase tracking-[0.12em] text-white sm:text-6xl" style={{ fontFamily: "'Times New Roman', Times, serif" }}>STARDEW EARTH</h1>
      <div className="pointer-events-auto absolute right-4 top-16 text-white">{controls}</div>
      <p role="note" aria-label="Globe controls" className="pointer-events-none absolute left-4 bottom-6 max-w-[18rem] rounded-full border border-white/20 bg-[#111a20]/90 px-4 py-2 text-xs text-white/85 shadow-lg">
        Drag to rotate · Click the globe and use arrow keys · Scroll or press + / − to zoom
      </p>
    </div>
  );
}
