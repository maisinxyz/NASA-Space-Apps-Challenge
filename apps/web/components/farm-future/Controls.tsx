"use client";
// The four new doors. Only these show by default in Future mode: Mode switch, Lenses, What-if, and the richer
// timeline. Everything else opens from one of them.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";

import { STRATEGIES, WHAT_IF_LIMITS } from "@/lib/farm-future/fixtures";
import { conditionsAt, scoreWithWhatIf, whatIfActive } from "@/lib/farm-future/model";
import { engineSeries, pointAt } from "@/lib/farm-future/data";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { fmt } from "@/lib/forecast/select";
import { baseRequest, siteForFarm } from "@/lib/forecast/sites";
import { useForecastStore } from "@/lib/forecast/store";
import { useAppStore } from "@/lib/store";
import { useFutureStore, type FutureMode, type LensId } from "@/lib/farm-future/store";
import { color, layout, motion as m } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { Droplet, Leaf, Thermometer } from "@/components/farm-view/icons";
import { CardHead, EASE_OUT, HAIR, Label, Num, PopCard, SyntheticBadge, useDismiss } from "./ui";

/* ---------------- Mode switch (under the farm name) ---------------- */
const MODES: { id: FutureMode; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "future", label: "Future · 10 yr" },
  { id: "compare", label: "Compare strategies" },
];
export function ModeSwitch() {
  const engineFarm = !!siteForFarm(useAppStore((s) => s.farmId));
  const mode = useFutureStore((s) => s.mode);
  const setMode = useFutureStore((s) => s.setMode);
  return (
    <div role="radiogroup" aria-label="View mode" className="ff-seg fv-auto" style={{ marginTop: 10, alignSelf: "flex-start", width: "fit-content" }} data-testid="mode-switch">
      {MODES.filter((x) => !engineFarm || x.id !== "compare").map((x) => (
        <FvButton key={x.id} className="fv-seg" role="radio" aria-checked={mode === x.id} data-testid={`mode-${x.id}`} onClick={() => { if (mode !== x.id) { setMode(x.id); sound.tickWeek(); } }}>
          {x.label}
        </FvButton>
      ))}
    </div>
  );
}

/* ---------------- Lenses (button in the layer bar → grouped menu; active lens = gold chip with ✕) ---------------- */
export const LENSES: { group: string; items: { id: LensId; label: string }[] }[] = [
  { group: "Climate", items: [{ id: "heat", label: "Heat shimmer" }, { id: "rain", label: "Rain & downpours" }, { id: "frost", label: "Frost & cold pockets" }] },
  { group: "Water", items: [{ id: "water", label: "Moisture anomaly + ET" }, { id: "stress", label: "Water-stress hotspots" }] },
  { group: "Field", items: [{ id: "erosion", label: "Erosion & flow" }, { id: "bare", label: "Bare-field windows" }] },
  { group: "Confidence", items: [{ id: "uncertainty", label: "Uncertainty grid" }, { id: "soiltest", label: "Where to soil-test" }] },
];
export const lensLabel = (id: LensId) => LENSES.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id;
const LENS_SHORT: Record<LensId, string> = { heat: "Heat", rain: "Rain", frost: "Frost", water: "Water", stress: "Water stress", erosion: "Erosion", bare: "Bare soil", uncertainty: "Uncertainty", soiltest: "Soil tests" };

/** Lenses that need the 30 m grid or the hotspot layers (NASADEM + satellite data, B2): Roadmap on engine farms. */
export const ROADMAP_LENSES: LensId[] = ["stress", "erosion", "uncertainty", "soiltest"];

export function LensControl() {
  const roadmap = !!siteForFarm(useAppStore((s) => s.farmId));
  const lens = useFutureStore((s) => s.lens);
  const setLens = useFutureStore((s) => s.setLens);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), wrap);

  const pick = (id: LensId) => {
    setOpen(false);
    setLens(id);
    sound.success();
  };

  return (
    <div ref={wrap} style={{ position: "relative", display: "inline-flex" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {lens ? (
          <motion.span key="chip" className="ff-lens-chip" data-testid="lens-chip"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: m.iconSwapFromScale, filter: `blur(${m.iconSwapBlur}px)` }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: m.iconSwapFromScale, filter: `blur(${m.iconSwapBlur}px)` }}
            transition={{ duration: m.iconSwapMs / 1000, ease: EASE_OUT }}>
            <FvButton className="fv-auto" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
              <LensIcon />{LENS_SHORT[lens]}
            </FvButton>
            <FvButton className="fv-icon" style={{ width: 24, height: 24 }} aria-label={`Turn off ${LENS_SHORT[lens]} lens`} data-testid="lens-off" onClick={() => { setLens(null); sound.close(); }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
            </FvButton>
          </motion.span>
        ) : (
          <motion.span key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: m.iconSwapMs / 1000 }}>
            <FvButton className="fv-seg" aria-haspopup="menu" aria-expanded={open} data-testid="lens-button" onClick={() => setOpen(!open)}>
              <LensIcon />Lenses
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </FvButton>
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" aria-label="Lenses" data-testid="lens-menu" className="fv-glass ff-menu fv-auto" style={{ transformOrigin: "top right" }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: m.popFromScale, y: -m.popFromY }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: m.dropdownMs / 1000, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: reduced ? 1 : m.popFromScale, transition: { duration: (m.dropdownMs * 0.8) / 1000, ease: EASE_OUT } }}>
            {LENSES.map((g) => (
              <div key={g.group} role="group" aria-label={g.group}>
                <div className="ff-menu-group">{g.group}</div>
                {g.items.map((it, k) => (
                  <motion.div key={it.id} initial={reduced ? false : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: { delay: (k * m.staggerMs) / 1000 } }}>
                    {roadmap && ROADMAP_LENSES.includes(it.id) ? (
                      <span className="ff-menu-item" aria-disabled="true" data-testid={`lens-${it.id}`} style={{ opacity: 0.55, cursor: "default" }}>
                        {it.label}<span className="ff-synth" style={{ marginLeft: "auto" }}>Roadmap</span>
                      </span>
                    ) : (
                      <FvButton role="menuitemradio" aria-checked={lens === it.id} className="ff-menu-item" data-testid={`lens-${it.id}`} onClick={() => pick(it.id)}>
                        {it.label}
                      </FvButton>
                    )}
                  </motion.div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
const LensIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>
);

/* ---------------- Future condition pills (projected, with deltas vs 2026) ---------------- */
export function FuturePills() {
  const t = useFutureStore((s) => s.t);
  const w = useFutureStore((s) => s.whatIf);
  const setLens = useFutureStore((s) => s.setLens);
  const c = conditionsAt(t, w);
  const pills = [
    { id: "rain", icon: Droplet, label: "Rain", value: <Num value={c.rainMm} unit=" mm" />, delta: <Num value={c.rainDeltaPct} unit="%" signed />, lens: "rain" as LensId },
    { id: "moisture", icon: Droplet, label: "Soil moisture", value: <Num value={c.moisturePct} unit="%" />, delta: <Num value={c.moistureDelta} unit=" pts" signed />, lens: "water" as LensId },
    { id: "heat", icon: Thermometer, label: "Heat days", value: <Num value={c.heatDays} />, delta: <Num value={c.heatDelta} signed />, lens: "heat" as LensId },
    { id: "frost", icon: Leaf, label: "Frost-free", value: <Num value={c.frostFreeDays} unit=" d" />, delta: <Num value={c.frostFreeDelta} signed />, lens: "frost" as LensId },
  ];
  return (
    <div className="fv-auto ff-pills-col" data-testid="future-pills">
      {pills.map((p) => (
        <FvButton key={p.id} className="fv-glass fv-pill fv-auto ff-future-bar" data-testid={`future-pill-${p.id}`} onClick={() => setLens(p.lens)} aria-label={`${p.label}: open the ${LENS_SHORT[p.lens]} lens`}>
          <div className="ff-future-bar-left">
            <p.icon size={layout.pillRow.icon} />
            <span className="l">{p.label}</span>
          </div>
          <div className="ff-future-bar-right">
            <span className="v">{p.value}</span>
            <span className="l" style={{ fontSize: 11 }}>{p.delta}</span>
          </div>
        </FvButton>
      ))}
    </div>
  );
}

/* ---------------- What-if pill + card ---------------- */
export function WhatIf({ raised = false }: { raised?: boolean }) {
  const w = useFutureStore((s) => s.whatIf);
  const panel = useFutureStore((s) => s.panel);
  const { openPanel, setWhatIf, resetWhatIf } = useFutureStore.getState();
  const active = whatIfActive(w);
  const open = panel === "whatif";
  const { forecast } = useFutureData();
  // Lift above the crop growth strip when it is showing (1 yr zoom + Erosion lens).
  const lifted = useFutureStore((st) => st.zoom === "1y" && st.lens === "erosion");
  const pillBottom = lifted || raised ? 300 : 196;
  const fmtRain = `${w.rainPct > 0 ? "+" : w.rainPct < 0 ? "−" : ""}${Math.abs(w.rainPct)}%`;
  const fmtTemp = `+${w.tempC.toFixed(1)} °C`;
  return (
    <>
      <FvButton className="fv-glass ff-whatif fv-auto" data-active={active} aria-expanded={open} data-testid="whatif-pill" style={{ position: "absolute", right: 40, bottom: pillBottom }} onClick={() => openPanel("whatif")}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={active ? color.accent : "currentColor"} strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
        What-if
        <span style={{ color: color.inkSecondary, fontVariantNumeric: "tabular-nums" }}>Rain {fmtRain} · {fmtTemp}</span>
      </FvButton>
      <PopCard open={open} origin="bottom right" label="What-if" testId="whatif-card" style={{ right: 40, bottom: pillBottom + 48, width: 340 }}>
        <CardHead title="What-if" onMinimize={() => openPanel(null)} extra={active ? <FvButton className="ff-link" onClick={resetWhatIf}>Reset</FvButton> : undefined} />
        <Slider label="Rainfall" value={w.rainPct} {...WHAT_IF_LIMITS.rainPct} fmt={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`} onChange={(v) => setWhatIf({ rainPct: v })} centered />
        <Slider label="Temperature" value={w.tempC} {...WHAT_IF_LIMITS.tempC} fmt={(v) => `+${v.toFixed(1)} °C`} onChange={(v) => setWhatIf({ tempC: Math.round(v * 10) / 10 })} />
        <hr className="ff-hr" />
        {forecast ? <EngineWhatIf /> : <>
        <Label>Score in 2035 · ring = no change</Label>
        {STRATEGIES.map((s) => {
          const now = scoreWithWhatIf(s, w);
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "104px 1fr 54px", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ color: color.inkSecondary }}>{s.name}</span>
              <div style={{ position: "relative", height: 10 }} aria-hidden>
                <div style={{ position: "absolute", left: 0, right: 0, top: 5, height: 1, background: HAIR }} />
                <div style={{ position: "absolute", left: `${Math.min(now, s.score2035)}%`, width: `${Math.abs(s.score2035 - now)}%`, top: 5, height: 1, background: color.inkMuted }} />
                <div style={{ position: "absolute", left: `${s.score2035}%`, top: 2, width: 6, height: 6, marginLeft: -3, borderRadius: 3, border: `1px solid ${color.inkMuted}`, boxSizing: "border-box" }} />
                <motion.div animate={{ left: `${now}%` }} transition={{ duration: 0.3, ease: EASE_OUT }} style={{ position: "absolute", top: 1, width: 8, height: 8, marginLeft: -4, borderRadius: 4, background: s.swatch }} />
              </div>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <Num value={now} /> <span style={{ color: color.inkSecondary }}><Num value={now - s.score2035} signed /></span>
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="ff-label">Relative score: compare strategies, not an amount</span>
          <SyntheticBadge />
        </div>
        </>}
      </PopCard>
    </>
  );
}

const CLIMATE_SOURCE: Record<string, string> = {
  history_resample: "Resampled NASA POWER daily weather, 1991–2024",
  cmip6_delta: "NASA NEX-GDDP-CMIP6 climate trend on NASA POWER weather",
};

/** Engine what-if: the sliders refetch the forecast (debounced in useFarmForecast); scenario and climate source shown. */
function EngineWhatIf() {
  const { data, forecast } = useFutureData();
  const status = useForecastStore((s) => s.status);
  const fsource = useForecastStore((s) => s.source);
  const farmId = useAppStore((s) => s.farmId);
  if (!forecast) return null;
  const siteId = siteForFarm(farmId);
  const source = (siteId && baseRequest(siteId)?.climate_source) || "history_resample";
  const sc = forecast.scenario;
  return (
    <div data-testid="whatif-engine" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label>Soil organic matter, year 10 · index, year 0 = 100</Label>
      {data.strategies.map((s) => {
        const series = engineSeries(forecast, s.engineId, "soil_organic_index");
        const p = series ? pointAt(series, 10) : null;
        return (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: color.inkSecondary }}>{s.name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{p ? fmt(p.p50) : "–"}{p && p.p10 !== null && p.p90 !== null && p.p10 !== p.p90 ? <span style={{ color: color.inkSecondary }}> ({fmt(p.p10)}–{fmt(p.p90)})</span> : null}</span>
          </div>
        );
      })}
      {status === "loading" && <span className="ff-p" role="status">Updating the forecast…</span>}
      {fsource === "prebuilt" && <span className="ff-p">Showing the pre-built run; slider changes are scored when the app runs against the live API.</span>}
      <span className="ff-p" data-testid="whatif-scenario">
        Scenario: {sc.preset}, rain {sc.rain_scale_pct > 0 ? "+" : ""}{sc.rain_scale_pct} %, temperature +{sc.temp_offset_c} °C, phased in over {sc.ramp?.years ?? 10} years. Scenario forecast.
      </span>
      <span className="ff-p" data-testid="whatif-climate-source">Climate source: {CLIMATE_SOURCE[source] ?? source}</span>
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange, centered = false }: {
  label: string; value: number; min: number; max: number; step: number; fmt(v: number): string; onChange(v: number): void; centered?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const frac = (value - min) / (max - min);
  const zero = centered ? (0 - min) / (max - min) : 0;
  const set = (v: number) => {
    const snapped = Math.round(Math.max(min, Math.min(max, v)) / step) * step;
    const clean = Math.round(snapped * 1000) / 1000;
    if (clean !== value) { onChange(clean); sound.tickWeek(); }
  };
  const fromX = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return value;
    return min + ((clientX - r.left) / r.width) * (max - min);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: color.inkSecondary }}>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</span>
      </div>
      <div
        ref={ref}
        className="ff-slider fv-auto"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={fmt(value)}
        data-testid={`whatif-${label.toLowerCase()}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); set(fromX(e.clientX)); }}
        onPointerMove={(e) => drag && set(fromX(e.clientX))}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
        onKeyDown={(e) => {
          const k = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
          if (k) { e.preventDefault(); set(value + k * step * (e.shiftKey ? 5 : 1)); }
          else if (e.key === "Home") { e.preventDefault(); set(min); }
          else if (e.key === "End") { e.preventDefault(); set(max); }
        }}
      >
        <div className="track" />
        {centered && <div className="zero" style={{ left: `${zero * 100}%` }} />}
        <div className="fill" style={{ left: `${Math.min(frac, zero) * 100}%`, width: `${Math.abs(frac - zero) * 100}%` }} />
        <div className="knob" style={{ left: `${frac * 100}%`, transform: drag ? "scale(1.15)" : undefined }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: color.inkSecondary, fontVariantNumeric: "tabular-nums" }}>
        <span>{fmt(min)}</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}
