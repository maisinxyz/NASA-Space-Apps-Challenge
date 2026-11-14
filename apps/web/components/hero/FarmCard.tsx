"use client";
// The confirm pulse and the tiny farm card that grows from the selected marker. Both follow the marker on screen via
// trackBus, written straight to the DOM. The card is the way down to the farm: pressing it descends.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

import type { Farm } from "@/components/globe/types";

import { trackBus } from "./buses";
import { type FarmFacts, farmFacts } from "./farmFacts";
import { heroMonoFont } from "./fonts";
import { Pressable } from "./Pressable";
import { card, color, ease, pulse } from "./tokens";

/** Keeps an element pinned to the tracked marker (CSS px), offset by `extra`. */
function useFollowMarker(extra: string) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const t = trackBus.get();
      if (!el.current) return;
      el.current.style.visibility = t ? "visible" : "hidden";
      if (t) el.current.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) ${extra}`;
    };
    place();
    return trackBus.subscribe(place);
  }, [extra]);
  return el;
}

/** One expanding ring around the marker: the selection is confirmed. Plays once per `nonce`. */
export function MarkerPulse({ nonce }: { nonce: number }) {
  const el = useFollowMarker("translate(-50%, -50%)");
  return (
    <div ref={el} aria-hidden className="pointer-events-none absolute top-0 left-0 will-change-transform">
      <motion.span
        key={nonce}
        className="block h-6 w-6 rounded-full border"
        style={{ borderColor: color.accent }}
        initial={{ scale: 1, opacity: 0.9 }}
        animate={{ scale: pulse.toScale, opacity: 0 }}
        transition={{ duration: pulse.ms / 1000, ease: ease.out }}
      />
    </div>
  );
}

function Row({ k, v, note, mono, delay }: { k: string; v: string; note?: string; mono?: boolean; delay: number }) {
  return (
    <motion.div className="flex items-baseline justify-between gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.18 }}>
      <dt className="text-[12px] text-white/[0.55]">{k}</dt>
      <dd className="text-right text-[12px] text-white/[0.88]">
        <span className={mono && v !== "—" ? `${heroMonoFont.className} tabular-nums` : ""}>{v}</span>
        {note && <span className="ml-1.5 text-white/[0.45]">{note}</span>}
      </dd>
    </motion.div>
  );
}

function rows(f: FarmFacts) {
  return [
    { k: "Crop", v: f.crop?.text ?? "—", note: f.crop ? f.crop.basis : "no data" },
    { k: "Area", mono: true, v: f.areaHa != null ? `${f.areaHa.toLocaleString("en-US")} ha` : "—", note: f.areaHa == null ? "no data" : undefined },
    { k: "NDVI", mono: true, v: f.ndvi != null ? f.ndvi.toFixed(2) : "—", note: f.ndvi == null ? "awaiting satellite data" : undefined },
    { k: "Health trend", v: f.trend ?? "—", note: f.trend == null ? "awaiting satellite data" : undefined },
  ];
}

/** Grows out of the marker (scale from 0.95 at the marker), shrinks back into it on close. */
export function FarmCard({ farm, onDescend }: { farm: Farm | null; onDescend(id: string): void }) {
  const el = useFollowMarker("translate(-50%, calc(-100% - 22px))");
  return (
    <div ref={el} className="absolute top-0 left-0 will-change-transform">
      <AnimatePresence>
        {farm && (
          <motion.div
            key={farm.id}
            style={{ originX: 0.5, originY: 1 }}
            initial={{ opacity: 0, scale: card.fromScale, clipPath: "inset(100% 0 0 0 round 12px)" }}
            animate={{ opacity: 1, scale: 1, clipPath: "inset(0% 0 0 0 round 12px)", transition: { duration: card.openMs / 1000, ease: ease.inOut } }}
            exit={{ opacity: 0, scale: card.fromScale, clipPath: "inset(100% 0 0 0 round 12px)", transition: { duration: card.closeMs / 1000, ease: ease.out } }}
          >
            <Pressable
              aria-label={`Descend to ${farm.name}`}
              onClick={() => onDescend(farm.id)}
              className="w-64 rounded-[12px] border border-white/[0.12] bg-[#05060a]/88 p-3 text-left transition-colors data-[held]:border-white/25 data-[held]:bg-white/[0.06] data-[held]:shadow-[inset_0_1px_6px_rgba(0,0,0,0.6)] hover:border-white/20 focus-visible:ring-1 focus-visible:ring-white/70"
            >
              <p className="text-[14px] leading-snug font-medium text-white/[0.94]">{farm.name}</p>
              <p className="mt-0.5 text-[12px] text-white/[0.6]">{farm.locality ? `${farm.locality}, ${farm.country}` : farm.country}</p>
              <dl className="mt-2.5 grid gap-1 border-t border-white/[0.08] pt-2.5">
                {rows(farmFacts(farm)).map((r, i) => (
                  <Row key={r.k} {...r} delay={0.06 + i * 0.03} />
                ))}
              </dl>
            </Pressable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
