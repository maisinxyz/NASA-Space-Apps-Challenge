"use client";
// The globe view's chrome, laid out like fromearth.love (studied 2026-11-14, our own code): wordmark top left; "Find a
// place" search, share and the existing controls top right; a glass "Choose a farm" pill bottom left; a large year
// with a tick ruler bottom right. Glass = translucent dark fill, hairline white edge, inner highlight, soft drop shadow.
// The year ruler is decorative until the NASA POWER date scrubber lands (plan item 3).
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Farm } from "@/components/globe/types";
import { encodeShare } from "@/lib/share";
import { useAppStore } from "@/lib/store";
import { type Place, type SearchHit, searchPlaces } from "@/lib/globe/search";

const FONT = "'Satoshi', var(--font-hero-ui), ui-sans-serif, system-ui, sans-serif";
const EASE = [0.165, 0.84, 0.44, 1] as const;
const INK = "#f5f7fa";
const MUTED = "#c1cad5";
const BLUE = "#1740a9";
export const GLASS: React.CSSProperties = {
  background: "rgba(20,20,20,0.34)",
  border: "0.67px solid rgba(255,255,255,0.25)",
  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.33), inset 0 -1px 1px rgba(255,255,255,0.125), 0 12px 36px rgba(0,0,0,0.33)",
  backdropFilter: "blur(8px) saturate(1.5)",
  WebkitBackdropFilter: "blur(8px) saturate(1.5)",
};
/** Screen inset, like the reference: 2.5 % of the width, never under 20 px. */
const INSET = "max(20px, 2.5vw)";
const YEAR = 2026;

function useFontshare() {
  useEffect(() => {
    if (document.getElementById("fontshare-css")) return;
    document.head.appendChild(Object.assign(document.createElement("link"), { id: "fontshare-css", rel: "stylesheet", href: "/fonts/fontshare/fonts.css" }));
  }, []);
}

function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    let off = false;
    fetch("/hero/places.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { places?: Place[] } | null) => !off && d?.places && setPlaces(d.places))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  return places;
}

function Search({ farms, onPick }: { farms: Farm[]; onPick(hit: SearchHit): void }) {
  const places = usePlaces();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const hits = useMemo(() => searchPlaces(q, farms, places), [q, farms, places]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (restoreFocus.current) {
      trigger.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);
  const close = (returnFocus = false) => {
    restoreFocus.current = returnFocus;
    setOpen(false);
    setQ("");
    setActive(0);
  };
  const choose = (h: SearchHit | undefined) => {
    if (!h) return;
    close();
    onPick(h);
  };
  if (!open)
    return (
      <button ref={trigger} type="button" onClick={() => setOpen(true)} className="pointer-events-auto flex h-12 items-center border-b border-white/80 text-[14px] transition-opacity duration-200 hover:opacity-70 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/70" style={{ color: "#d7dcd3" }} aria-keyshortcuts="Control+K Meta+K">
        Find a place
      </button>
    );
  return (
    <div className="pointer-events-auto relative" style={{ width: "min(360px, 60vw)" }}>
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onBlur={() => setTimeout(() => close(), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close(true);
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.max(0, Math.min(a + 1, hits.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") choose(hits[active]);
        }}
        placeholder="Farm, city or country"
        aria-label="Find a farm, city or country"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls="globe-search-results"
        aria-activedescendant={hits[active] ? `gs-${active}` : undefined}
        className="h-12 w-full rounded-full px-5 text-[14px] outline-none placeholder:text-white/45"
        style={{ ...GLASS, color: INK, caretColor: INK }}
      />
      {hits.length > 0 && (
        <ul id="globe-search-results" role="listbox" className="absolute top-14 right-0 left-0 overflow-hidden rounded-[18px] py-2" style={GLASS}>
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`gs-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(h)}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-baseline justify-between gap-3 px-5 py-2 transition-[opacity,transform] duration-300"
              style={{ opacity: i === active ? 1 : 0.75, transform: i === active ? "translateX(4px)" : "none" }}
            >
              <span className="truncate text-[13px]" style={{ color: INK }}>
                {h.name}
              </span>
              <span className="shrink-0 text-[12px] uppercase tracking-[0.2em]" style={{ color: h.kind === "farm" ? "#ffc857" : MUTED }}>
                {h.kind === "farm" ? "Farm" : h.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareButton() {
  const [done, setDone] = useState<string | null>(null);
  const share = async () => {
    const state = useAppStore.getState();
    if (state.farmId) {
      const hash = encodeShare({
        farm: state.farmId, mode: state.twinMode, field: state.twinFieldId,
        a: state.compareA, b: state.compareB, divider: state.divider,
        surface: state.twinSurface, look: state.look, camera: null,
        scenario: state.scenarioId,
        inputs: state.scenarioId ? state.scenarioInputs[state.scenarioId] : undefined,
        detail: state.detail, scenarioRotation: state.scenarioRotation,
        scenarioProgress: state.scenarioProgress, twinYear: state.twinYear,
        twinMonth: state.twinMonth, showCropFills: state.showCropFills,
        panelsHidden: state.panelsHidden, leftOpen: state.leftOpen, rightOpen: state.rightOpen,
      });
      // Keep the recovery message truthful even when clipboard access is denied.
      history.replaceState(null, "", hash);
    } else {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "FieldTwin", url });
      else {
        await navigator.clipboard.writeText(url);
        setDone("Link copied");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setDone("Copy failed: the link is in the address bar");
    }
    setTimeout(() => setDone(null), 1900);
  };
  return (
    <div className="pointer-events-auto relative">
      <button type="button" data-share-view aria-label="Share this view" onClick={share} className="grid h-11 w-11 place-items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/70" style={{ ...GLASS, backdropFilter: "blur(2px) saturate(1.35)" }}>
        <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill="none" stroke={INK} strokeWidth="1.5">
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8 11 8-5M8 13l8 5" />
        </svg>
      </button>
      {done && (
        <p role="status" className="absolute top-14 right-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px]" style={{ ...GLASS, color: INK }}>
          {done}
        </p>
      )}
    </div>
  );
}

function FarmPicker({ farms, selectedId, onPick }: { farms: Farm[]; selectedId: string | null; onPick(id: string): void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const current = farms.find((f) => f.id === selectedId);
  return (
    <div ref={wrap} className="pointer-events-auto relative">
      <button ref={trigger} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="farm-picker" className="flex h-11 items-center gap-3 rounded-full px-6 text-[14px] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/70" style={{ ...GLASS, color: INK }}>
        {current ? current.name.split(/[,(]/)[0].trim() : "Choose a farm"}
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }} fill="none" stroke={INK} strokeWidth="1.6">
          <path d="m5 12 5-5 5 5" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id="farm-picker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="absolute bottom-14 left-0 max-h-[50vh] w-[280px] overflow-auto rounded-[24px] py-3"
            style={GLASS}
          >
            {farms.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    trigger.current?.focus();
                    onPick(f.id);
                  }}
                  className="flex w-full items-center gap-3 px-5 py-2 text-left transition-opacity hover:opacity-75"
                  aria-pressed={f.id === selectedId}
                  aria-label={`${f.name} — ${f.tier === "twin" ? "Digital twin" : "Explore only"}`}
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: f.id === selectedId ? "#39e6d4" : "rgba(255,253,226,0.6)" }} />
                  <span className="flex-1 truncate text-[13px] font-medium" style={{ color: INK }}>
                    {f.name.split(/[,(]/)[0].trim()}
                  </span>
                  <span className="text-[12px] uppercase tracking-[0.22em]" style={{ color: MUTED }}>
                    {f.tier === "twin" ? "Digital twin" : "Explore only"}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Large light year with a tick per month under it; the first tick is the current one (taller). */
function YearRuler() {
  return (
    <div aria-hidden className="flex flex-col items-end" style={{ color: INK }}>
      <span className="tabular-nums" style={{ fontSize: "clamp(48px, 6.2vw, 80px)", fontWeight: 300, lineHeight: 1, letterSpacing: "-0.07em" }}>
        {YEAR}
      </span>
      <span className="mt-2 flex h-6 items-end gap-[6px]">
        {Array.from({ length: 25 }, (_, i) => (
          <i key={i} className="block w-px rounded-[1px] bg-[#f5f7fa]" style={{ height: i === 0 ? 21 : 8, opacity: i === 0 ? 1 : 0.55 }} />
        ))}
      </span>
    </div>
  );
}

export function GlobeChrome({
  farms,
  selectedId,
  onPickFarm,
  onFlyTo,
  controls,
}: {
  farms: Farm[];
  selectedId: string | null;
  onPickFarm(id: string): void;
  onFlyTo(lon: number, lat: number): void;
  /** Existing control cluster (maps, layers, scan, settings), shown top right next to share. */
  controls?: React.ReactNode;
}) {
  useFontshare();
  return (
    <div className="pointer-events-none absolute inset-0 z-20" style={{ fontFamily: FONT }}>
      <h1 className="absolute select-none" style={{ left: INSET, top: `calc(${INSET} + 12px)`, color: INK, fontSize: 26, fontWeight: 300, lineHeight: 0.92, letterSpacing: "-0.04em" }}>
        field<span style={{ fontWeight: 400 }}>twin</span>
        <span style={{ color: BLUE, margin: "0 0.12em", letterSpacing: 0 }}>/</span>
        <span style={{ letterSpacing: "-0.035em" }}>{YEAR}</span>
      </h1>
      <div className="absolute flex items-center gap-4" style={{ right: INSET, top: INSET }}>
        <Search farms={farms} onPick={(h) => (h.kind === "farm" ? onPickFarm(h.id) : onFlyTo(h.lon, h.lat))} />
        <ShareButton />
      </div>
      {controls && (
        <div className="pointer-events-auto absolute top-1/2 -translate-y-1/2" style={{ right: INSET }}>
          {controls}
        </div>
      )}
      <div className="absolute" style={{ left: INSET, bottom: INSET }}>
        <FarmPicker farms={farms} selectedId={selectedId} onPick={onPickFarm} />
      </div>
      <div className="absolute" style={{ right: INSET, bottom: INSET }}>
        <YearRuler />
      </div>
    </div>
  );
}
