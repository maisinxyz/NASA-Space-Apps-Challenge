"use client";
// Master clock for Future / Compare mode: 2026–2035 with a 10 yr / 1 yr zoom. Same feel as the farm-view
// timeline: 1:1 drag with pointer capture, a tick on every step (month in 10 yr, week in 1 yr; heavier tick on a
// year / month boundary), snap on release, haptics, keyboard, play. Everything else subscribes to the store.
import { useEffect, useRef, useState } from "react";

import { BASELINE, CROP_STAGES, HEAVY_RAIN, YEARS } from "@/lib/farm-future/fixtures";
import { clampT, dateAt, moistureBand, MONTH_NAMES, monthStartT, rainEventsT, T_MAX, tOf } from "@/lib/farm-future/model";
import { useFutureStore } from "@/lib/farm-future/store";
import { vibrate } from "@/lib/farm-view/timeline";
import { color, shadow } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { MUTED_RED, SyntheticBadge } from "./ui";

const MONTH_T = 1 / 12;
const WEEK_T = 7 / 365;

function stepKey(t: number, zoom: "10y" | "1y") {
  // Identity of the current detent: month index in 10 yr view, week index in 1 yr view.
  return zoom === "10y" ? Math.floor(t * 12 + 1e-6) : Math.floor((t * 365 + 1e-6) / 7);
}
function boundaryKey(t: number, zoom: "10y" | "1y") {
  return zoom === "10y" ? Math.floor(t + 1e-6) : Math.floor(t * 12 + 1e-6);
}

export function FutureTimeline({ reduced, right = 40 }: { reduced: boolean; right?: number }) {
  const t = useFutureStore((s) => s.t);
  const zoom = useFutureStore((s) => s.zoom);
  const playing = useFutureStore((s) => s.playing);
  const lens = useFutureStore((s) => s.lens);
  const whatIf = useFutureStore((s) => s.whatIf);
  const { setT, setZoom, setPlaying } = useFutureStore.getState();

  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1360);
  const [dragging, setDragging] = useState(false);
  const last = useRef({ step: stepKey(t, zoom), bound: boundaryKey(t, zoom) });
  const snapRaf = useRef(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const d = dateAt(t);
  const lo = zoom === "10y" ? 0 : d.yearIndex;
  const hi = zoom === "10y" ? T_MAX : d.yearIndex + 1;
  const toX = (v: number) => ((v - lo) / (hi - lo)) * width;
  const toT = (x: number) => clampT(lo + (Math.max(0, Math.min(width, x)) / width) * (hi - lo));

  // Tick + haptic whenever the value crosses a detent (any source: drag, keys, play, deep link).
  useEffect(() => {
    const s = stepKey(t, zoom);
    const b = boundaryKey(t, zoom);
    if (s !== last.current.step) {
      if (b !== last.current.bound) { sound.tickMonth(); vibrate("month"); } else { sound.tickWeek(); vibrate("week"); }
    }
    last.current = { step: s, bound: b };
  }, [t, zoom]);

  // Play: one step every 250 ms, stops at the end.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const cur = useFutureStore.getState().t;
      const next = cur + (zoom === "10y" ? MONTH_T : WEEK_T);
      if (next >= T_MAX - 1e-3) { setPlaying(false); return; }
      setT(next);
    }, 250);
    return () => clearInterval(id);
  }, [playing, zoom, setPlaying, setT]);

  const snapTo = (target: number) => {
    cancelAnimationFrame(snapRaf.current);
    if (reduced) { setT(target); return; }
    const from = useFutureStore.getState().t;
    const start = performance.now();
    const run = (now: number) => {
      const k = Math.min(1, (now - start) / 180);
      const e = 1 - Math.pow(1 - k, 3);
      setT(from + (target - from) * e);
      if (k < 1) snapRaf.current = requestAnimationFrame(run);
    };
    snapRaf.current = requestAnimationFrame(run);
  };
  const nearestDetent = (v: number) => {
    if (zoom === "10y") {
      // Snap to the nearest month start (and draw the eye to month 1 of a year when within a week of it).
      const yi = Math.floor(v);
      const candidates = [...Array(12)].map((_, m) => monthStartT(yi, m)).concat(yi + 1 < T_MAX ? [yi + 1] : []);
      return candidates.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    }
    return Math.round(v * 365) / 365; // nearest day
  };

  const onDown = (e: React.PointerEvent) => {
    if (playing) setPlaying(false);
    cancelAnimationFrame(snapRaf.current);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setT(toT(e.clientX - (track.current?.getBoundingClientRect().left ?? 0)));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setT(toT(e.clientX - (track.current?.getBoundingClientRect().left ?? 0)));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    snapTo(nearestDetent(useFutureStore.getState().t));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const big = zoom === "10y" ? 1 : 7 / 365;
    const small = zoom === "10y" ? MONTH_T : 1 / 365;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = t + (e.shiftKey ? big : small);
    else if (e.key === "ArrowLeft") next = t - (e.shiftKey ? big : small);
    else if (e.key === "PageUp") next = t + MONTH_T;
    else if (e.key === "PageDown") next = t - MONTH_T;
    else if (e.key === "Home") next = lo;
    else if (e.key === "End") next = hi - 1 / 365;
    if (next === null) return;
    e.preventDefault();
    setT(Math.max(lo, Math.min(hi - 1e-6, next)));
  };

  const hx = toX(t);
  const labels = zoom === "10y" ? YEARS.map((y, i) => ({ text: String(y), at: i + 0.5, sel: i === d.yearIndex })) : MONTH_NAMES.map((n, i) => ({ text: n.slice(0, 3), at: d.yearIndex + (i + 0.5) / 12, sel: i === d.month }));
  const ticks = zoom === "10y" ? [...Array(11)].map((_, i) => i) : [...Array(13)].map((_, i) => d.yearIndex + i / 12);
  const band = moistureBand(t, whatIf);

  return (
    <div data-testid="future-timeline" style={{ position: "absolute", left: 40, right, bottom: 30, height: 150, pointerEvents: "none" }}>
      {/* Crop growth strip (1 yr zoom + Erosion lens): 2 px lines, stress windows as 4 px muted red. */}
      {zoom === "1y" && lens === "erosion" && (
        <div aria-label="Crop stages and stress windows" role="img" style={{ position: "absolute", left: 0, right: 0, bottom: 150, height: 92 }}>
          <div className="ff-legend" style={{ position: "absolute", left: 0, top: -20 }}>
            <span>Crop stages, {d.year}</span>
            <span><span style={{ width: 14, height: 4, borderRadius: 2, background: MUTED_RED }} />Stress window</span>
          </div>
          {CROP_STAGES.map((c, i) => (
            <div key={c.crop} style={{ position: "absolute", left: 0, right: 0, top: i * 22, height: 22 }}>
              <span className="ff-tl-lab" style={{ position: "absolute", left: 0, top: 0, transform: "none", fontSize: 10.5 }}>{c.crop}</span>
              {c.grow.map(([a, b], k) => <div key={k} style={{ position: "absolute", left: (a / 12) * width, width: ((b - a) / 12) * width, top: 15, height: 2, borderRadius: 1, background: "rgba(242,235,221,0.5)" }} />)}
              {c.stress.map(([a, b], k) => <div key={`s${k}`} style={{ position: "absolute", left: (a / 12) * width, width: ((b - a) / 12) * width, top: 14, height: 4, borderRadius: 2, background: MUTED_RED }} />)}
            </div>
          ))}
        </div>
      )}

      {/* Readout row */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 82, display: "flex", alignItems: "center", gap: 12 }}>
        <FvButton className="fv-glass fv-icon fv-auto" style={{ width: 32, height: 32, color: color.ink }} aria-label={playing ? "Pause" : "Play"} data-testid="future-play" onClick={() => setPlaying(!playing)}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M8 5v14M16 5v14" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
          )}
        </FvButton>
        <span className="ff-tl-year fv-onmap" data-testid="future-date">{zoom === "10y" ? d.year : d.monthName}</span>
        <span className="ff-tl-meta fv-onmap">
          {zoom === "10y" ? `${d.monthName} ${d.day} · year ${d.yearIndex + 1} of ${T_MAX}` : `${d.day} · ${d.year} · year ${d.yearIndex + 1} of ${T_MAX}`}
        </span>
        <div role="group" aria-label="Timeline zoom" className="ff-seg fv-auto">
          {(["10y", "1y"] as const).map((z) => (
            <FvButton key={z} className="fv-seg" role="radio" aria-checked={zoom === z} data-testid={`zoom-${z}`} onClick={() => setZoom(z)}>
              {z === "10y" ? "10 yr" : "1 yr"}
            </FvButton>
          ))}
        </div>
        <SyntheticBadge onMap />
        <div style={{ flex: 1 }} />
        {zoom === "10y" && (
          <div className="ff-legend">
            {lens === "uncertainty" ? (
              <>
                <span><span style={{ width: 14, height: 8, background: "rgba(242,235,221,0.25)" }} />p10–p90 {band.p10}–{band.p90}%</span>
                <span><span style={{ width: 14, borderTop: `1px dashed ${color.ink}` }} />p50</span>
              </>
            ) : (
              <>
                <span><span style={{ width: 14, height: 2, background: "linear-gradient(90deg,#6F98C6,#D08A47)" }} />Mean temp</span>
                <span><span style={{ width: 2, height: 9, background: color.water }} />Heavy rain</span>
                <span><span style={{ width: 14, height: 2, background: "rgba(242,235,221,0.5)" }} />Frost-free window</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Track */}
      <div
        ref={track}
        data-testid="future-track"
        className="fv-auto"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 72, touchAction: "none", cursor: dragging ? "grabbing" : "pointer" }}
      >
        {zoom === "10y" && (
          <>
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 44, height: 2, borderRadius: 1, background: `linear-gradient(90deg, #6F98C6, #C9B48A ${(BASELINE.tempAnomalyC.findIndex((v) => v >= 0.9) / 9) * 100}%, #D08A47)` }} />
            {rainEventsT(HEAVY_RAIN).map((e, i) => (
              <div key={i} aria-hidden style={{ position: "absolute", left: toX(e.t) - 1, bottom: 50, width: 2, height: 4 + e.mm / 5, borderRadius: 1, background: color.water }} />
            ))}
            {YEARS.map((_, i) => (
              <div key={i} aria-hidden style={{ position: "absolute", left: toX(tOf(i, BASELINE.lastSpringFrostDoy[i])), width: toX(tOf(i, BASELINE.firstFallFrostDoy[i])) - toX(tOf(i, BASELINE.lastSpringFrostDoy[i])), bottom: 39, height: 2, borderRadius: 1, background: "rgba(242,235,221,0.4)" }} />
            ))}
            {lens === "uncertainty" && <UncertaintyFan width={width} />}
          </>
        )}
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 33, height: 1, background: "rgba(242,235,221,0.45)" }} />
        <div aria-hidden style={{ position: "absolute", left: 0, width: hx, bottom: 33, height: 1, background: color.ink }} />
        {ticks.map((v, i) => <div key={i} aria-hidden className="ff-tl-tick" style={{ left: toX(v), bottom: 26, height: 7 }} />)}
        {labels.map((l) => <span key={l.text + l.at} aria-hidden className="ff-tl-lab" data-sel={l.sel} style={{ left: toX(l.at), bottom: 4 }}>{l.text}</span>)}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Date"
          aria-valuemin={0}
          aria-valuemax={T_MAX}
          aria-valuenow={Math.round(t * 100) / 100}
          aria-valuetext={`${d.monthName} ${d.day}, ${d.year}`}
          data-testid="future-handle"
          onKeyDown={onKey}
          style={{ position: "absolute", left: hx - 16, bottom: 18, width: 32, height: 32, display: "grid", placeItems: "center", cursor: dragging ? "grabbing" : "grab", outlineOffset: -6 }}
        >
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: "50%", background: color.ink, boxShadow: dragging ? shadow.handleHaloHeld : "0 0 0 4px rgba(242,235,221,0.16)", transform: dragging && !reduced ? "scale(1.15)" : "scale(1)", transition: reduced ? "none" : "transform 120ms cubic-bezier(0.23,1,0.32,1)" }} />
        </div>
      </div>
    </div>
  );
}

/** p10–p90 band widening over the 10 years, with a dashed p50 (Uncertainty lens only). */
function UncertaintyFan({ width }: { width: number }) {
  const whatIf = useFutureStore((s) => s.whatIf);
  const pts = YEARS.map((_, i) => ({ x: ((i + 0.5) / T_MAX) * width, b: moistureBand(i + 0.5, whatIf) }));
  const y = (v: number) => 56 - (v - 25) * 1.4; // 25–55 % → 56..14 px
  const top = pts.map((p) => `${p.x.toFixed(1)},${y(p.b.p90).toFixed(1)}`).join(" ");
  const bot = [...pts].reverse().map((p) => `${p.x.toFixed(1)},${y(p.b.p10).toFixed(1)}`).join(" ");
  const mid = pts.map((p) => `${p.x.toFixed(1)},${y(p.b.p50).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={60} viewBox={`0 0 ${width} 60`} role="img" aria-label="July soil moisture, p10 to p90 range, widening each year" style={{ position: "absolute", left: 0, bottom: 36 }}>
      <polygon points={`${top} ${bot}`} fill={color.ink} fillOpacity={0.18} />
      <polyline points={mid} fill="none" stroke={color.ink} strokeWidth={1} strokeDasharray="3 3" />
    </svg>
  );
}
