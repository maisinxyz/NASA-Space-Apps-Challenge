"use client";
// The popup a clicked waypoint opens: a small card anchored to the pin (above it, or below when there is no room),
// clamped inside the viewport, with a pointer toward the pin. It grows out of the pin and shrinks back into it. Only
// one is open at a time (the parent holds a single farm id). The globe does not move for it. Content is only the
// farm photo, name, location and a short line. A separate pill under the card ("Go to farm") goes down to the farm; clicking away or Escape closes.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { FarmInfo } from "@/lib/farms";

import { trackBus } from "./buses";
import { card, color, ease } from "./tokens";

const W = 248;
const GAP = 16; // pin tip to card edge (clears the pin head)
const PIN_H = 36; // pin head height above its tip, px
const BTN_H = 36; // external "Go to farm" pill under the card
const EDGE = 12; // minimum distance to the viewport edge

/** Farm photo from the farm data (`Farm.image`, public/farms/<id>.jpg); null when absent. */
const photoOf = (f: FarmInfo) => f.image ?? null;

function Photo({ farm }: { farm: FarmInfo }) {
  const photo = photoOf(farm);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo?.src]);
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.04]">
      {photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- small local photo, no optimiser needed
        <img src={photo.src} alt={photo.alt} width={W} height={Math.round(W * 0.625)} draggable={false} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div aria-hidden className="h-full w-full bg-gradient-to-br from-white/[0.06] to-white/[0.015]" />
      )}
      {photo && !failed && photo.credit && (
        <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-5 pb-1.5 text-[10px] leading-tight text-white/[0.72]" title={photo.credit}>
          {photo.credit}
        </p>
      )}
    </div>
  );
}

export function FarmPopup({ farm, reduced, onClose, onDescend }: { farm: FarmInfo | null; reduced: boolean; onClose(): void; onDescend(id: string): void }) {
  return (
    <AnimatePresence>
      {farm && <Card key={farm.id} farm={farm} reduced={reduced} onClose={onClose} onDescend={onDescend} />}
    </AnimatePresence>
  );
}

function Card({ farm, reduced, onClose, onDescend }: { farm: FarmInfo; reduced: boolean; onClose(): void; onDescend(id: string): void }) {
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Follow this farm's pin (not another's: a replaced card keeps its last spot while it leaves).
  useEffect(() => {
    const place = () => {
      const el = box.current;
      if (!el) return;
      const t = trackBus.get();
      if (t && t.id === farm.id) last.current = { x: t.x, y: t.y };
      const p = last.current;
      // Hidden while the pin is round the back of the Earth.
      el.style.visibility = p && t?.id === farm.id ? "visible" : "hidden";
      if (!p) return;
      // The card and its button move as one unit; `h` is the whole unit.
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const above = p.y - PIN_H - GAP - h >= EDGE;
      const top = above ? p.y - PIN_H - GAP - h : Math.min(p.y + GAP, vh - h - EDGE);
      const left = Math.min(Math.max(p.x - W / 2, EDGE), vw - W - EDGE);
      el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
      // Pointer sits on the pin's x (kept inside the rounded corners); the grow origin is the pin.
      const px = Math.min(Math.max(p.x - left, 22), W - 22);
      const pt = pointer.current;
      if (pt) {
        pt.style.left = `${px}px`;
        // Below the pin: pointer on the card's top edge. Above the pin: on the bottom edge of the unit (under the button).
        pt.style.top = above ? "auto" : "-5px";
        pt.style.bottom = above ? "-5px" : "auto";
        pt.style.transform = `translateX(-50%) rotate(45deg)`;
        pt.style.borderWidth = above ? "0 1px 1px 0" : "1px 0 0 1px";
      }
      el.style.setProperty("--ox", `${px}px`);
      el.style.setProperty("--oy", above ? "100%" : "0%");
    };
    place();
    return trackBus.subscribe(place);
  }, [farm.id]);

  // Escape or a press anywhere outside the card (and outside a pin, which swaps the card) closes it.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || box.current?.contains(el) || el.closest("[data-pin]")) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const where = farm.locality ? `${farm.locality}, ${farm.country}` : farm.country;
  const line = farm.note?.text ?? farm.owner;
  const gone = { opacity: 0, ...(reduced ? {} : { scale: card.fromScale }) };
  return (
    <div ref={box} className="pointer-events-auto absolute top-0 left-0 z-30 will-change-transform" style={{ width: W, visibility: "hidden" }}>
      <motion.div
        style={{ transformOrigin: "var(--ox, 50%) var(--oy, 100%)" }}
        initial={gone}
        animate={{ opacity: 1, scale: 1, transition: { duration: card.openMs / 1000, ease: ease.out } }}
        exit={{ ...gone, transition: { duration: card.closeMs / 1000, ease: ease.inOut } }}
      >
        <section aria-label={`${farm.name}, ${where}`} className="relative block w-full overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#07090d]/92 text-left shadow-[0_18px_44px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <Photo farm={farm} />
          <span className="block px-3.5 pt-3 pb-3.5">
            <span className="line-clamp-2 text-[14px] leading-snug font-medium text-white/[0.95]">{farm.name}</span>
            <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: color.accent, opacity: 0.85 }}>
              {where}
            </span>
            <span className="mt-2 line-clamp-1 text-[12px] leading-[1.45] text-white/[0.58]">{line}</span>
          </span>
        </section>
        <motion.button
          type="button"
          onClick={() => onDescend(farm.id)}
          aria-label={`Go to ${farm.name}`}
          whileTap={reduced ? undefined : { scale: 0.95, boxShadow: "inset 0 2px 8px rgba(0,0,0,0.65)", backgroundColor: "rgba(3,4,6,0.96)", transition: { duration: 0.07, ease: "easeOut" } }}
          transition={{ type: "spring", stiffness: 620, damping: 16, mass: 0.9 }}
          className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.14] bg-[#07090d]/92 text-[13px] font-medium shadow-[0_10px_26px_rgba(0,0,0,0.5)] backdrop-blur-md outline-none transition-colors hover:border-white/[0.26] focus-visible:ring-2 focus-visible:ring-[#a3bfe9]/80"
          style={{ height: BTN_H, color: color.accent }}
        >
          Go to farm
          <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </motion.button>
        <span ref={pointer} aria-hidden className="pointer-events-none absolute h-2.5 w-2.5 border-solid border-white/[0.1] bg-[#07090d]" style={{ zIndex: 1 }} />
      </motion.div>
    </div>
  );
}
