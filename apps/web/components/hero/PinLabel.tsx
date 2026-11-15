"use client";
// Tooltip above the hovered waypoint: farm name, then its location (locality, else country). Positioned from hoverBus
// without React renders; fades and rises in on mount.
import { useEffect, useRef } from "react";

import type { Farm } from "@/components/globe/types";

import { hoverBus } from "./buses";

export function PinLabel({ farm }: { farm: Farm }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const h = hoverBus.get();
      if (el.current && h) el.current.style.transform = `translate3d(${h.x}px, ${h.y}px, 0) translate(-50%, calc(-100% - 56px))`;
    };
    place();
    return hoverBus.subscribe(place);
  }, []);
  const where = farm.locality ?? farm.country;
  return (
    <div ref={el} className="pointer-events-none absolute top-0 left-0 z-10 will-change-transform">
      <style>{"@keyframes pinlabel-in{from{opacity:0;translate:0 4px}to{opacity:1;translate:0 0}}"}</style>
      <div className="animate-[pinlabel-in_160ms_ease-out_both] rounded-[8px] border border-white/[0.1] bg-[#05060a]/80 px-2.5 py-1.5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.45)] backdrop-blur-md motion-reduce:animate-none">
        <p className="text-[12.5px] leading-tight font-medium whitespace-nowrap text-white/[0.94]">{farm.name}</p>
        <p className="mt-0.5 text-[11.5px] leading-tight whitespace-nowrap text-white/[0.58]">{where}</p>
      </div>
    </div>
  );
}
