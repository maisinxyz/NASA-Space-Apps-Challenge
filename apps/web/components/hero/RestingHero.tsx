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
  headline: ["Farms —", "from", "orbit"],
  body: "FieldTwin turns NASA Earth observations into a 3D model of a farm, so you can see when and where its soil is most exposed and compare crop rotations on the land itself.",
  action: "Explore the farms",
  statusLeft: "Challenge: Field Shift",
  statusRight: "NASA Space Apps 2026",
} as const;

/** Reference type: Cabinet Grotesk (headings) and Satoshi (body), self-hosted from public/fonts/fontshare (see
 * scripts/fetch-fonts.mjs). Fallbacks keep the layout usable when the files have not been fetched. */
const HEADING_FONT = "'Cabinet Grotesk', var(--font-hero-word), ui-sans-serif, system-ui, sans-serif";
const BODY_FONT = "'Satoshi', var(--font-hero-ui), ui-sans-serif, system-ui, sans-serif";

/** Scale unit: 1px at the 1440 x 1022 design size, smaller on smaller viewports (never larger). */
export const HERO_UNIT = `min(1px, calc(100vh / ${hero.designH}), calc(100vw / ${hero.designW}))`;
const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * Fade-out order (0 = first). Right side first, then the left column bottom-up, the headline last. Fade-in plays the
 * reverse, after the Earth has glided back.
 */
const ORDER = { rings: 0, statusRight: 1, statusLeft: 2, action: 3, stats: 4, body: 5, sidebar: 6, eyebrow: 7, headline: 8 } as const;
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
  imageryReady,
  onExplore,
  onPickFarm,
}: {
  shown: boolean;
  reduced: boolean;
  farms: Farm[];
  selectedId: string | null;
  imageryReady: boolean;
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
                <span className="font-bold tabular-nums transition-colors" style={{ fontSize: u(10), color: on ? color.accent : "rgba(255,255,255,0.45)" }}>
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
      <div className="absolute inset-y-0 flex flex-col justify-center" style={{ left: u(96), width: `calc((100vw - ${u(96)}) * 5 / 12)`, padding: u(64), paddingBottom: u(64 + 56) }}>
        <Fade order={ORDER.eyebrow} {...props}>
          <p className="font-bold uppercase" style={{ fontSize: u(12), letterSpacing: "0.4em", color: color.accent }}>
            {HERO_COPY.eyebrow}
          </p>
        </Fade>
        <Fade order={ORDER.headline} {...props}>
          <h1 className="font-black uppercase" style={{ fontFamily: HEADING_FONT, fontSize: u(96), lineHeight: 1, letterSpacing: "-0.02em", marginTop: u(20) }}>
            <span className="block text-white">{HERO_COPY.headline[0]}</span>
            <span className="block" style={{ color: color.accent }}>
              {HERO_COPY.headline[1]}
            </span>
            <span className="block" style={{ color: color.accent }}>
              {HERO_COPY.headline[2]}
            </span>
          </h1>
        </Fade>
        <Fade order={ORDER.body} {...props}>
          <p className="font-light text-gray-400" style={{ fontSize: u(18), lineHeight: 1.625, marginTop: u(36), maxWidth: u(440) }}>
            {HERO_COPY.body}
          </p>
        </Fade>
        <Fade order={ORDER.stats} {...props}>
          <dl className="grid grid-cols-2" style={{ gap: u(16), marginTop: u(48), maxWidth: u(432) }}>
            {stats.map(([k, v]) => (
              <div key={k} className="border border-white/[0.08] bg-white/[0.03]" style={{ padding: u(24), borderRadius: u(16) }}>
                <dt className="uppercase text-gray-400" style={{ fontSize: u(10), letterSpacing: "0.1em" }}>
                  {k}
                </dt>
                <dd className="font-bold text-white tabular-nums" style={{ fontSize: u(24), marginTop: u(8), lineHeight: 1.15 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </Fade>
        <Fade order={ORDER.action} {...props}>
          <button
            type="button"
            onClick={onExplore}
            className="pointer-events-auto inline-flex items-center rounded-full border font-bold uppercase transition-colors hover:bg-white/[0.06] focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/70"
            style={{ marginTop: u(48), paddingInline: u(32), paddingBlock: u(18), gap: u(14), fontSize: u(14), letterSpacing: "0.04em", borderColor: `${color.accent}66`, color: color.accent, minHeight: 40 }}
          >
            {HERO_COPY.action}
            <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: u(16), height: u(16) }}>
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
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
      </Fade>

      {/* Status bar: 56 px, after the sidebar. Imagery state and live camera position are real; nothing simulated. */}
      <div className="absolute right-0 bottom-0 flex items-center justify-between border-t border-white/5 bg-black/20 uppercase" style={{ left: u(96), height: u(56), paddingInline: u(64), fontSize: u(10), letterSpacing: "0.2em" }}>
        <Fade order={ORDER.statusLeft} {...props} className="flex items-center text-white/60" style={{ gap: u(40) }}>
          <span className="flex items-center" style={{ gap: u(12) }}>
            <span className={`rounded-full ${imageryReady && !reduced ? "animate-pulse" : ""}`} style={{ width: u(7), height: u(7), background: imageryReady ? color.accent : "rgba(255,255,255,0.3)" }} />
            {imageryReady ? "Imagery ready" : "Loading imagery"}
          </span>
          <span>{HERO_COPY.statusLeft}</span>
        </Fade>
        <Fade order={ORDER.statusRight} {...props} className="flex items-center text-white/60" style={{ gap: u(24) }}>
          <LiveCoords />
          <span aria-hidden className="h-3 w-px bg-white/20" />
          <span>{HERO_COPY.statusRight}</span>
        </Fade>
      </div>
    </div>
  );
}
