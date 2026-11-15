"use client";
// The popup a clicked waypoint opens: a small card anchored to the pin (above it, or below when there is no room),
// clamped inside the viewport, with a pointer toward the pin. It grows out of the pin and shrinks back into it. Only
// one is open at a time (the parent holds a single farm id). The globe does not move for it. Content is only the
// farm photo, name, location and a short line. A separate pill under the card ("Go to farm") goes down to the farm; clicking away or Escape closes.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { FARMS, type FarmInfo } from "@/lib/farms";

import { hoverBus, trackBus } from "./buses";
import { card, color, ease } from "./tokens";

const W = 280;
const GAP = 16; // pin tip to card edge (clears the pin head)
const PIN_H = 50; // pin height above its tip, px (FarmPins FARM_PIN_BOX)
const BTN_H = 40; // external "Go to farm" pill under the card
const EDGE = 12; // minimum distance to the viewport edge

/** Farm photo from the farm data (`Farm.image`, public/farms/<id>.jpg); null when absent. */
const photoOf = (f: FarmInfo) => f.image ?? null;

/** Tier chip on the photo: what the user can do at this farm. */
function TierChip({ farm }: { farm: FarmInfo }) {
  const twin = farm.tier === "twin";
  return (
    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-black/60 px-2 py-[3px] text-[12px] font-semibold tracking-[0.06em] uppercase backdrop-blur-md" style={{ color: twin ? "#ffc857" : "rgba(255,255,255,0.78)" }}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: twin ? "#ffc857" : "rgba(255,255,255,0.55)" }} />
      {twin ? "Digital twin" : "Explore only"}
    </span>
  );
}

const deg = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`;

function Photo({ farm }: { farm: FarmInfo }) {
  const photo = photoOf(farm);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo?.src]);
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.04]">
      {photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- small local photo, no optimiser needed
        <img src={photo.src} alt={photo.alt} width={W} height={Math.round(W * 0.625)} draggable={false} onError={() => setFailed(true)} onLoad={(e) => e.currentTarget.naturalWidth === 0 && setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div aria-hidden className="h-full w-full bg-gradient-to-br from-white/[0.06] to-white/[0.015]" />
      )}
      <TierChip farm={farm} />
      {photo && !failed && photo.credit && (
        <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-5 pb-1.5 text-[12px] leading-tight text-white/[0.72]" title={photo.credit}>
          {photo.credit}
        </p>
      )}
    </div>
  );
}

/** Hovering a pin starts loading that farm's photo, so it is in the cache by the time the pin is clicked. */
const warmed = new Set<string>();
function useWarmPhotoOnHover() {
  useEffect(() => {
    const warm = () => {
      const id = hoverBus.get()?.id;
      const src = FARMS.find((f) => f.id === id)?.image?.src;
      if (!src || warmed.has(src)) return;
      warmed.add(src);
      const img = new Image();
      img.onerror = () => warmed.delete(src); // retry on the next hover
      img.src = src;
    };
    return hoverBus.subscribe(warm);
  }, []);
}

export function FarmPopup({ farm, reduced, onClose, onDescend }: { farm: FarmInfo | null; reduced: boolean; onClose(): void; onDescend(id: string): void }) {
  useWarmPhotoOnHover();
  const opener = useRef<HTMLElement | null>(null);
  const previousFarm = useRef<string | null>(null);
  const pressedPin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const rememberPin = (event: PointerEvent) => {
      pressedPin.current = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-pin]") : null;
    };
    const clearPin = () => { pressedPin.current = null; };
    window.addEventListener("pointerdown", rememberPin, true);
    window.addEventListener("keydown", clearPin, true);
    return () => {
      window.removeEventListener("pointerdown", rememberPin, true);
      window.removeEventListener("keydown", clearPin, true);
    };
  }, []);
  if (farm && farm.id !== previousFarm.current && typeof document !== "undefined") {
    opener.current = pressedPin.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    pressedPin.current = null;
  }
  previousFarm.current = farm?.id ?? null;
  const close = () => { onClose(); opener.current?.focus(); };
  return (
    <AnimatePresence>
      {farm && <Card key={farm.id} farm={farm} reduced={reduced} onClose={close} onDescend={onDescend} />}
    </AnimatePresence>
  );
}

function Card({ farm, reduced, onClose, onDescend }: { farm: FarmInfo; reduced: boolean; onClose(): void; onDescend(id: string): void }) {
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const focused = useRef(false);
  const focusFrame = useRef<number | null>(null);
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
      if (p && t?.id === farm.id && !focused.current) {
        if (focusFrame.current === null) {
          focusFrame.current = requestAnimationFrame(() => {
            focusFrame.current = null;
            const button = closeButton.current;
            if (!button || button.closest("[inert]")) return;
            button.focus({ preventScroll: true });
            focused.current = document.activeElement === button;
          });
        }
      }
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
        // Above the pin the pointer hangs under the (filled) button, so it takes the button's colour.
        pt.style.background = above ? color.accent : "#07090d";
        pt.style.borderWidth = above ? "0" : "1px 0 0 1px";
      }
      el.style.setProperty("--ox", `${px}px`);
      el.style.setProperty("--oy", above ? "100%" : "0%");
    };
    place();
    const unsubscribe = trackBus.subscribe(place);
    return () => {
      unsubscribe();
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, [farm.id]);

  // Escape or a press outside closes the card. Sharing keeps the selected farm intact.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || box.current?.contains(el) || el.closest("[data-pin], [data-share-view]")) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [onClose]);

  const where = farm.locality ? `${farm.locality}, ${farm.country}` : farm.country;
  const line = farm.note?.text ?? farm.owner;
  const gone = { opacity: 0, ...(reduced ? {} : { scale: card.fromScale }) };
  return (
    <div ref={box} className="pointer-events-auto absolute top-0 left-0 z-[300] will-change-transform" style={{ width: W, visibility: "hidden" }}>
      <motion.div
        style={{ transformOrigin: "var(--ox, 50%) var(--oy, 100%)" }}
        initial={gone}
        animate={{ opacity: 1, scale: 1, transition: { duration: card.openMs / 1000, ease: ease.out } }}
        exit={{ ...gone, transition: { duration: card.closeMs / 1000, ease: ease.inOut } }}
      >
        <section aria-label={`${farm.name}, ${where}`} className="relative block w-full overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#07090d]/92 text-left shadow-[0_18px_44px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <Photo farm={farm} />
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Close farm details" className="absolute top-2 right-2 rounded-full bg-black/90 px-3 py-2 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Close</button>
          <span className="block px-4 pt-3.5 pb-4">
            <span className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-[-0.005em] text-white/[0.96]">{farm.name}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-snug" style={{ color: color.accent }}>
              <svg aria-hidden viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14Z" />
                <circle cx="8" cy="6.5" r="1.6" />
              </svg>
              <span className="truncate">{where}</span>
            </span>
            <span className="mt-2 block text-[12px] font-semibold text-white">{farm.tier === "twin" ? "Digital twin · scenarios and comparison" : "Explore landscape · no simulation"}</span>
            <span className="mt-2.5 line-clamp-2 text-[12px] leading-[1.5] text-white/[0.62]">{line}</span>
            {farm.tier === "explore" && (
              <span className="mt-2 block rounded bg-amber-500/10 px-2 py-1 text-[11px] leading-snug font-medium text-amber-200/90 border border-amber-500/20">
                {farm.id === "ubc-farm"
                  ? "Rotation comparison available. Simulation on Cornell & Beltsville only."
                  : farm.id === "kpu-langley"
                    ? "Campus exploration available. Simulation on Cornell & Beltsville only."
                    : "Simulation available on Cornell & Beltsville only (2 of 14 farms)."}
              </span>
            )}
            <span className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5 text-[12px] text-white/[0.5]">
              <span className="tabular-nums">
                {deg(farm.lat, "N", "S")}, {deg(farm.lon, "E", "W")}
              </span>
              {!farm.coordsVerified && <span title="Coordinates not published by the owner">Approximate</span>}
            </span>
          </span>
        </section>
        <motion.button
          type="button"
          onClick={() => onDescend(farm.id)}
          aria-label={farm.tier === "twin" ? `Enter digital twin for ${farm.name}` : `Explore ${farm.name} in 3D (simulation unavailable)`}
          whileTap={reduced ? undefined : { scale: 0.96, transition: { duration: 0.07, ease: "easeOut" } }}
          transition={{ type: "spring", stiffness: 620, damping: 16, mass: 0.9 }}
          className="relative mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-[#05070c] shadow-[0_10px_30px_-6px_rgba(163,191,233,0.6)] outline-none transition-[filter,box-shadow] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{ height: BTN_H, background: `linear-gradient(180deg, #c3d6f4 0%, ${color.accent} 100%)` }}
        >
          {farm.id === "ubc-farm" || farm.id === "kpu-langley" ? "Compare rotations" : farm.tier === "twin" ? "Enter digital twin" : "Explore in 3D (no simulation)"}
          <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </motion.button>
        <span ref={pointer} aria-hidden className="pointer-events-none absolute h-2.5 w-2.5 border-solid border-white/[0.1] bg-[#07090d]" style={{ zIndex: 1 }} />
      </motion.div>
    </div>
  );
}
