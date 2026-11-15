"use client";
// The resting hero, laid out like the ORBIT reference (superdesign.dev "ORBIT | Interactive Solar System Explorer"):
// a 96 px numbered sidebar, a 5/12 info column on the left (eyebrow, three-line headline, body, 2x2 stat cards, one
// action), the planet on the right inside two thin orbit rings, and a 56 px status bar. Sizes are the reference's
// (designed at 1440 x 1022) scaled by --u, so the whole composition shrinks with the viewport and never overflows.
// Copy is FieldTwin's own (the reference's Mars copy and invented figures are not used); every figure is computed
// from lib/farms (pins and twin configs). The reference's avatar ("astronaut") stack is left out.
import { motion } from "framer-motion";
import { useEffect, useSyncExternalStore } from "react";

import type { Farm } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";

import { cameraBus } from "./buses";
import { color, ease, hero } from "./tokens";

/** Hero copy (draft for product-owner sign-off). Edit here only. */
export const HERO_COPY = {
  eyebrow: "FieldTwin",
  headline: ["Farms", "from", "orbit"],
  body: "Explore research farms in 3D, then compare illustrative crop rotations and synthetic weather scenarios on two digital twins.",
  action: "Explore the farms",
  statusRight: "NASA Space Apps 2026",
} as const;

/** Reference type: Cabinet Grotesk (headings) and Satoshi (body), self-hosted from public/fonts/fontshare (see
 * scripts/fetch-fonts.mjs). Fallbacks keep the layout usable when the files have not been fetched. */
const HEADING_FONT = "'Cabinet Grotesk', var(--font-hero-word), ui-sans-serif, system-ui, sans-serif";
const BODY_FONT = "'Satoshi', var(--font-hero-ui), ui-sans-serif, system-ui, sans-serif";

/** Scale unit: 1px at the 1440 x 1022 design size, smaller on smaller viewports (never larger). */
export const HERO_UNIT = `min(1px, calc(100vh / ${hero.designH}), calc(100vw / ${hero.designW}))`;
const uClamp = (n: number, minPx: number) => `clamp(${minPx}px, calc(var(--u) * ${n}), ${n}px)`;
const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * Fade-out order (0 = first). Right side first, then the left column bottom-up, the headline last. Fade-in plays the
 * reverse, after the Earth has glided back.
 */
const ORDER = { rings: 0, statusRight: 1, action: 3, stats: 4, body: 5, sidebar: 6, eyebrow: 7, headline: 8 } as const;
const N = 9;
/** Time for the whole hero text to fade out (last item's delay + its fade), ms. The Earth starts gliding after it. */
export const TEXT_OUT_TOTAL_MS = (N - 1) * hero.textStaggerMs + hero.textOutMs;

function Fade({ order, shown, reduced, className, style, children }: { order: number; shown: boolean; reduced: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const delay = reduced ? 0 : shown ? (hero.glideMs + (N - 1 - order) * hero.textStaggerMs) / 1000 : (order * hero.textStaggerMs) / 1000;
  return (
    <motion.div
      className={className}
      style={style}
      initial={false}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{ duration: (shown ? hero.textInMs : hero.textOutMs) / 1000, delay, ease: shown ? ease.inOut : ease.out }}
    >
      {children}
    </motion.div>
  );
}

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
function LiveCoords() {
  const t = useSyncExternalStore(cameraBus.subscribe, cameraBus.get, () => null);
  return <span className="tabular-nums">{t ? `${fmt(t.lat, "N", "S")}, ${fmt(t.lon, "E", "W")}` : "—"}</span>;
}

export function RestingHero({
  shown,
  reduced,
  farms,
  selectedId,
  onExplore,
  onPickFarm,
}: {
  shown: boolean;
  reduced: boolean;
  farms: Farm[];
  selectedId: string | null;
  onExplore(): void;
  onPickFarm(id: string): void;
}) {
  // Fontshare fonts: a stylesheet written by scripts/fetch-fonts.mjs (git-ignored, licence). Added once at runtime so a
  // missing file only means fallback fonts, never a build error.
  useEffect(() => {
    if (document.getElementById("fontshare-css")) return;
    const link = Object.assign(document.createElement("link"), { id: "fontshare-css", rel: "stylesheet", href: "/fonts/fontshare/fonts.css" });
    document.head.appendChild(link);
  }, []);
  const twin = farms.find((f) => f.tier === "twin");
  const simLabel = twin ? (twinConfig(twin.id)?.simAreaLabel ?? "") : "";
  const simKm = simLabel.match(/([\d.]+) km/)?.[1];
  const approx = simLabel.includes("~") ? "~" : "";
  const stats: [string, string][] = [
    ["Research farms", String(farms.length).padStart(2, "0")],
    ["Digital twins", String(farms.filter((f) => f.tier === "twin").length).padStart(2, "0")],
    ["Digital twin", twin ? (twin.locality?.split(",")[0] ?? twin.name) : "—"],
    ["Simulation area", simKm ? `${approx}${simKm} × ${simKm} km` : "—"],
  ];
  const props = { shown, reduced };
  // Hidden content is inert: not focusable, not announced, not clickable.
  const inert = !shown ? { inert: true as const } : {};
  return (
    <div className="pointer-events-none absolute inset-0" style={{ ["--u" as string]: HERO_UNIT, fontFamily: BODY_FONT }} {...inert}>
      {/* Sidebar: mark, one number per farm (active = selected), Data and methods. */}
      <Fade order={ORDER.sidebar} {...props} className="pointer-events-auto absolute inset-y-0 left-0 flex flex-col items-center justify-between border-r border-white/5 bg-black/40" style={{ width: u(96), paddingBlock: u(40) }}>
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={color.accent} strokeWidth="1.6" strokeLinecap="round" style={{ width: u(30), height: u(30) }}>
          <circle cx="12" cy="12" r="3.2" />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)" />
        </svg>
        <nav aria-label="Research farms" className="flex flex-col" style={{ gap: u(30) }}>
          {farms.map((f, i) => {
            const on = f.id === selectedId;
            return (
              <button key={f.id} type="button" onClick={() => onPickFarm(f.id)} aria-label={`${f.name}, ${f.country}`} aria-pressed={on} className="group flex flex-col items-center rounded-sm focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/70" style={{ gap: u(8), minWidth: 40, minHeight: 32, justifyContent: "center" }}>
                <span className="font-bold tabular-nums transition-colors" style={{ fontSize: `max(12px, ${u(10)})`, color: on ? color.accent : "rgba(255,255,255,0.45)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="block transition-all duration-300 group-hover:bg-white/60" style={{ height: 2, width: on ? u(60) : u(8), background: on ? color.accent : "rgba(255,255,255,0.3)" }} />
              </button>
            );
          })}
        </nav>
        <a href="/methods" aria-label="Data and methods" className="grid place-items-center rounded-sm text-white/40 transition-colors hover:text-white/80 focus-visible:outline-1 focus-visible:outline-white/70" style={{ width: 40, height: 40 }}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ width: u(22), height: u(22) }}>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </a>
      </Fade>

      {/* Info column: 5 of 12 columns after the sidebar, 64 px padding, vertically centred. */}
      <div className="pointer-events-auto absolute top-0 flex flex-col justify-start overflow-y-auto overscroll-contain" style={{ left: u(96), bottom: u(56), width: `calc((100vw - ${u(96)}) * 5 / 12)`, padding: u(64), paddingBottom: u(64) }}>
        <Fade order={ORDER.eyebrow} {...props}>
          <p className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] font-bold uppercase backdrop-blur-sm" style={{ fontSize: `max(12px, ${u(11)})`, letterSpacing: "0.32em", color: color.accent, gap: u(10), paddingInline: u(14), paddingBlock: u(7) }}>
            <span aria-hidden className="relative flex" style={{ width: u(7), height: u(7) }}>
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ffc857] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-full w-full rounded-full bg-[#ffc857]" />
            </span>
            {HERO_COPY.eyebrow}
            <span aria-hidden className="text-white/30">·</span>
            <span className="text-white/60">{HERO_COPY.statusRight}</span>
          </p>
        </Fade>
        <Fade order={ORDER.headline} {...props}>
          <h1 className="font-black uppercase" style={{ fontFamily: HEADING_FONT, fontSize: `min(72px, ${u(96)}, calc((((100vw - ${u(96)}) * 5 / 12) - ${u(128)}) / 3.4))`, lineHeight: 1, letterSpacing: "-0.02em", marginTop: u(20), overflowWrap: "normal", wordBreak: "keep-all" }}>
            <span className="block text-white">{HERO_COPY.headline[0]}</span>
            <span className="block" style={{ color: color.accent }}>
              {HERO_COPY.headline[1]}
            </span>
            <span className="block bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${color.accent} 0%, #d9cfb4 55%, #ffc857 100%)` }}>
              {HERO_COPY.headline[2]}
            </span>
          </h1>
        </Fade>
        <Fade order={ORDER.body} {...props}>
          <p className="font-light text-gray-400" style={{ fontSize: `max(16px, ${u(18)})`, lineHeight: 1.625, marginTop: u(36), maxWidth: u(440), textWrap: "pretty", overflowWrap: "break-word" }}>
            {HERO_COPY.body}
          </p>
        </Fade>
        <Fade order={ORDER.stats} {...props}>
          <dl className="grid grid-cols-2" style={{ gap: u(16), marginTop: u(48), maxWidth: u(432) }}>
            {stats.map(([k, v]) => (
              <div key={k} className="relative overflow-hidden border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] backdrop-blur-sm" style={{ padding: u(22), borderRadius: u(16) }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#a3bfe9]/50 to-transparent" />
                <dt className="uppercase text-gray-400" style={{ fontSize: `max(12px, ${u(10)})`, letterSpacing: "0.1em" }}>
                  {k}
                </dt>
                <dd className="font-bold text-white tabular-nums" style={{ fontSize: uClamp(24, 18), marginTop: u(8), lineHeight: 1.15 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </Fade>
        <Fade order={ORDER.action} {...props} className="flex flex-wrap items-center" style={{ marginTop: u(44), gap: u(20) }}>
          <label className="pointer-events-auto block w-full text-xs text-white/75">
            Choose a research farm
            <select value={selectedId ?? ""} onChange={(e) => e.target.value && onPickFarm(e.target.value)} className="mt-1 block w-full rounded border border-white/30 bg-[#07090d] px-2 py-2 text-sm text-white">
              <option value="">Select a farm</option>
              {farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name} — {farm.tier === "twin" ? "Digital twin" : "Explore only"}</option>)}
            </select>
          </label>
          <div className="pointer-events-auto w-full">
            <p className="mb-1.5 text-xs uppercase tracking-[0.12em]" style={{ color: color.accent, opacity: 0.8 }}>Vancouver-area demos</p>
            <div className="flex flex-wrap" style={{ gap: u(10) }}>
              <button
                type="button"
                onClick={() => onPickFarm("ubc-farm")}
                className="pointer-events-auto inline-flex cursor-pointer items-center rounded-full font-semibold text-white/90 border border-white/[0.14] bg-white/[0.06] backdrop-blur-sm transition-[background,box-shadow] hover:bg-white/[0.12] hover:border-white/[0.25] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 active:scale-95"
                style={{ paddingInline: u(18), paddingBlock: u(10), fontSize: `max(12px, ${u(13)})`, minHeight: 44, letterSpacing: "0.02em" }}
              >
                Compare rotations → UBC Farm
              </button>
              <button
                type="button"
                onClick={() => onPickFarm("kpu-langley")}
                className="pointer-events-auto inline-flex cursor-pointer items-center rounded-full font-semibold text-white/90 border border-white/[0.14] bg-white/[0.06] backdrop-blur-sm transition-[background,box-shadow] hover:bg-white/[0.12] hover:border-white/[0.25] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 active:scale-95"
                style={{ paddingInline: u(18), paddingBlock: u(10), fontSize: `max(12px, ${u(13)})`, minHeight: 44, letterSpacing: "0.02em" }}
              >
                Explore campus → KPU Langley
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onExplore}
            className="pointer-events-auto inline-flex cursor-pointer items-center rounded-full font-bold uppercase text-[#05070c] shadow-[0_0_0_1px_rgba(163,191,233,0.4),0_10px_40px_-6px_rgba(163,191,233,0.55)] transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-px hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(163,191,233,0.6),0_14px_48px_-6px_rgba(163,191,233,0.75)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80 active:translate-y-0 motion-reduce:transition-none"
            style={{ paddingInline: u(30), paddingBlock: u(17), gap: u(14), fontSize: `max(12px, ${u(14)})`, letterSpacing: "0.06em", background: `linear-gradient(180deg, #c3d6f4 0%, ${color.accent} 100%)`, minHeight: 44 }}
          >
            {HERO_COPY.action}
            <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: u(16), height: u(16) }}>
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
          <a href="/methods" className="pointer-events-auto inline-flex items-center rounded-sm font-medium text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/70" style={{ fontSize: `max(12px, ${u(14)})`, minHeight: 44 }}>
            Data &amp; methods
          </a>
        </Fade>
      </div>

      {/* Orbit rings around the Earth (resting position: right of centre by hero.restOffsetX of half the width). */}
      <Fade order={ORDER.rings} {...props} className="absolute inset-0 overflow-hidden">
        {[104, 86].map((d) => (
          <span
            key={d}
            aria-hidden
            className="absolute rounded-full border border-white/5"
            style={{ width: `${d}vh`, height: `${d}vh`, left: `${50 + hero.restOffsetX * 50}%`, top: "50%", transform: "translate(-50%, -50%)" }}
          />
        ))}
        {/* How to start, under the Earth. */}
        <p className="absolute flex -translate-x-1/2 items-center uppercase text-white/55" style={{ left: `${50 + hero.restOffsetX * 50}%`, bottom: u(84), gap: u(10), fontSize: `max(12px, ${u(11)})`, letterSpacing: "0.24em" }}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse motion-reduce:animate-none" style={{ width: u(16), height: u(16) }}>
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2.1L9 15" />
          </svg>
          Drag the Earth to explore
        </p>
      </Fade>

      {/* Status bar: 56 px, after the sidebar. Imagery state and live camera position are real; nothing simulated. */}
      <div className="absolute right-0 bottom-0 flex items-center justify-between border-t border-white/5 bg-black/20 uppercase" style={{ left: u(96), height: u(56), paddingInline: u(64), fontSize: `max(12px, ${u(10)})`, letterSpacing: "0.2em" }}>
        <Fade order={ORDER.statusRight} {...props} className="flex items-center text-white/60" style={{ gap: u(12) }}>
          <span className="text-white/35">Over</span>
          <LiveCoords />
        </Fade>
      </div>
    </div>
  );
}
