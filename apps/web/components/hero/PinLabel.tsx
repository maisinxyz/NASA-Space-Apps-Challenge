"use client";
// Label above the hovered waypoint: farm name, then country. Positioned from hoverBus without React renders.
import { useEffect, useRef } from "react";

import type { Farm } from "@/components/globe/types";

import { hoverBus } from "./buses";

export function PinLabel({ farm }: { farm: Farm }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const h = hoverBus.get();
      if (el.current && h) el.current.style.transform = `translate3d(${h.x}px, ${h.y}px, 0) translate(-50%, calc(-100% - 14px))`;
    };
    place();
    return hoverBus.subscribe(place);
  }, []);
  return (
    <div ref={el} className="pointer-events-none absolute top-0 left-0 z-10 text-center will-change-transform">
      <p className="text-[13px] leading-tight font-medium whitespace-nowrap text-white/[0.94] [text-shadow:0_1px_8px_#000]">{farm.name}</p>
      <p className="mt-0.5 text-[12px] leading-tight whitespace-nowrap text-white/[0.62] [text-shadow:0_1px_8px_#000]">{farm.country}</p>
    </div>
  );
}
