"use client";
// The screen a waypoint opens: an image of the place, the farm's name, and its details. It grows out of the pin
// (ease out, from 0.95, 220 ms) and goes back into it 20% quicker. The primary button confirms with a pulse, then
// takes you down to the farm. Facts are the same honest ones the small card used (farmFacts + lib/farms notes).
//
// The image is NASA Blue Marble cropped around the farm: real, public domain, but coarse (about 10 km per pixel), so it
// shows the region, not the fields. It says so. No farm photographs are shipped yet.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { Farm } from "@/components/globe/types";
import type { FarmInfo } from "@/lib/farms";

import { trackBus } from "./buses";
import { farmFacts } from "./farmFacts";
import { heroMonoFont } from "./fonts";
import { Pressable } from "./Pressable";
import { detail, ease, pulse } from "./tokens";

const DAY = "/hero/earth/earth-day-3840.jpg";
/** Longitude span of the crop, degrees. The latitude span follows the 16:9 frame. */
const SPAN_LON = 14;

/** The Blue Marble crop centred on the farm, drawn once into a canvas. */
function RegionImage({ lon, lat }: { lon: number; lat: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      const ppd = img.naturalWidth / 360;
      const sw = SPAN_LON * ppd;
      const sh = sw * (c.height / c.width);
      const sx = Math.min(Math.max((lon + 180) * ppd - sw / 2, 0), img.naturalWidth - sw);
      const sy = Math.min(Math.max((90 - lat) * ppd - sh / 2, 0), img.naturalHeight - sh);
      g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      setReady(true);
    };
    img.src = DAY;
    return () => void (img.onload = null);
  }, [lon, lat]);
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[#05060a]">
      <canvas ref={ref} width={640} height={360} aria-hidden className="h-full w-full transition-opacity duration-200 ease-out" style={{ opacity: ready ? 1 : 0 }} />
      {/* The farm, at the centre of the crop (the pin tip sits on it). */}
      <svg viewBox="0 0 24 32" width="22" height="29" aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]">
        <path d="M12 31 C12 31 2 19.2 2 11.5 A10 10 0 0 1 22 11.5 C22 19.2 12 31 12 31 Z" fill="#e5322d" stroke="#a81f1b" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="12" cy="11.5" r="4" fill="#000" />
      </svg>
      <p className="absolute right-2 bottom-1.5 left-2 text-[10px] text-white/[0.7] [text-shadow:0_1px_4px_#000]">Region view: NASA Blue Marble, coarse (about 10 km per pixel). Not a photo of the farm.</p>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[12px] text-white/[0.55]">{k}</dt>
      <dd className="text-right text-[13px] text-white/[0.9]">{children}</dd>
    </div>
  );
}

/** Where the screen starts and ends: the pin, as an offset from the screen centre. */
function useOrigin(open: boolean) {
  const o = useRef({ x: 0, y: 0 });
  if (open) {
    const t = trackBus.get();
    if (t && typeof window !== "undefined") o.current = { x: t.x - window.innerWidth / 2, y: t.y - window.innerHeight / 2 };
  }
  return o.current;
}

export function FarmDetail({ farm, reduced, onClose, onDescend }: { farm: FarmInfo | null; reduced: boolean; onClose(): void; onDescend(id: string): void }) {
  const origin = useOrigin(!!farm);
  const [confirm, setConfirm] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!farm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [farm, onClose]);

  const open = (f: Farm) => {
    // Pulse to confirm the press, then go.
    setConfirm((n) => n + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDescend(f.id), reduced ? 0 : pulse.confirmMs);
  };

  return (
    <AnimatePresence>
      {farm && (
        <motion.div
          key="farm-detail"
          className="absolute inset-0 z-30 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: detail.openMs / 1000, ease: ease.out } }}
          exit={{ opacity: 0, transition: { duration: detail.closeMs / 1000, ease: ease.inOut } }}
        >
          <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
          <motion.section
            key={farm.id}
            role="dialog"
            aria-modal="true"
            aria-labelledby="farm-detail-title"
            className="relative w-[min(92vw,30rem)] overflow-hidden rounded-[14px] border border-white/[0.12] bg-[#05060a]/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: detail.fromScale, x: origin.x, y: origin.y }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { duration: detail.openMs / 1000, ease: ease.out } }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: detail.fromScale, x: origin.x, y: origin.y, transition: { duration: detail.closeMs / 1000, ease: ease.inOut } }}
          >
            <RegionImage lon={farm.lon} lat={farm.lat} />
            <Pressable aria-label="Close" onClick={onClose} className="absolute top-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full border border-white/[0.18] bg-black/55 text-white/[0.9] hover:bg-black/75 focus-visible:ring-1 focus-visible:ring-white/70">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Pressable>
            <div className="p-4">
              <h2 id="farm-detail-title" className="text-[18px] leading-snug font-medium text-white/[0.95]">
                {farm.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-white/[0.6]">{farm.locality ? `${farm.locality}, ${farm.country}` : farm.country}</p>
              <p className="mt-2 inline-block rounded-full border border-white/[0.16] px-2 py-0.5 text-[11px] text-white/[0.75]">{farm.tier === "twin" ? "Digital twin" : "Explore only"}</p>
              <dl className="mt-3 grid gap-1.5 border-t border-white/[0.08] pt-3">
                <Row k="Operated by">{farm.owner}</Row>
                {farm.areaHa !== undefined && (
                  <Row k="Area">
                    <span className={`${heroMonoFont.className} tabular-nums`}>{farm.areaHa.toLocaleString("en-US")} ha</span>
                  </Row>
                )}
                {(() => {
                  const crop = farmFacts(farm).crop;
                  return crop && <Row k="Crops">{crop.text} <span className="text-white/[0.45]">({crop.basis})</span></Row>;
                })()}
              </dl>
              {farm.note && <p className="mt-3 text-[13px] leading-snug text-white/[0.72]">{farm.note.text}</p>}
              {!farm.coordsVerified && <p className="mt-2 text-[12px] text-white/[0.5]">Approximate location: the pin is not from coordinates published by the operator.</p>}
              <p className="mt-2 text-[12px]">
                <a href={farm.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#a3bfe9] underline underline-offset-2">
                  Source (opens in a new tab)
                </a>
              </p>
              <div className="mt-4">
                <Pressable onClick={() => open(farm)} className="relative rounded-[10px] bg-white/[0.92] px-4 py-2 text-[14px] font-medium text-black hover:bg-white focus-visible:ring-2 focus-visible:ring-white/70">
                  {farm.tier === "twin" ? "Open twin" : "Fly in"}
                  {confirm > 0 && !reduced && (
                    <motion.span
                      key={confirm}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[10px] border-2 border-white"
                      initial={{ scale: 1, opacity: 0.9 }}
                      animate={{ scale: 1.12, opacity: 0 }}
                      transition={{ duration: pulse.confirmMs / 1000, ease: ease.out }}
                    />
                  )}
                </Pressable>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
