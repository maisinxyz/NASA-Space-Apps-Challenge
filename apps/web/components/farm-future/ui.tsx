"use client";
// Small shared pieces for Future / Compare mode. Minimal by rule: hairlines, thin bars, numbers first.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { BASIS_DESCRIPTIONS } from "@/components/ui/BasisChip";
import type { BasisOrRelative } from "@/lib/api/types";
import { color, motion as m } from "@/lib/farm-view/tokens";

import { FvButton } from "@/components/farm-view/FvButton";

export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const MUTED_RED = "#C46A52";
export const HAIR = "rgba(242,235,221,0.22)";
export const HAIR_STRONG = "rgba(242,235,221,0.45)";

/**
 * Basis detail in a tooltip (v4 PRD §2 rule 1): a small "i" mark on the main screens; the basis word and its meaning
 * are in the tooltip and for screen readers. Same words and meanings as components/ui/BasisChip.
 */
export function Basis({ b }: { b: BasisOrRelative }) {
  const desc = BASIS_DESCRIPTIONS[b] ?? "";
  return (
    <span className="ff-basis" data-basis={b} title={`${b}${desc ? `: ${desc}` : ""}`} tabIndex={0} style={{ width: 16, height: 16, padding: 0, justifyContent: "center", cursor: "help" }}>
      <span aria-hidden>i</span>
      <span className="sr-only">Basis: {b}{desc ? `. ${desc}` : ""}</span>
    </span>
  );
}

/** Placeholder for any value the app has no real data for. */
export function NoData() {
  return <p className="ff-p" data-testid="no-data">No data</p>;
}

/** Animated number (300 ms count-up); instant under reduced motion. */
export function useCountUp(value: number, decimals = 0) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 300);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (value - a) * e;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, reduced]);
  const p = 10 ** decimals;
  return Math.round(shown * p) / p;
}

export function Num({ value, decimals = 0, unit = "", signed = false }: { value: number; decimals?: number; unit?: string; signed?: boolean }) {
  const v = useCountUp(value, decimals);
  const s = v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = signed ? (v > 0 ? "+" : v < 0 ? "−" : "±") : v < 0 ? "−" : "";
  return <>{sign}{signed || v < 0 ? s.replace("-", "") : s}{unit}</>;
}

/** Big value + unit/sub + basis chip. */
export function Headline({ children, sub, basis, size = 22 }: { children: ReactNode; sub?: ReactNode; basis?: BasisOrRelative; size?: number }) {
  return (
    <div className="ff-headline">
      <span className="ff-big" style={{ fontSize: size }}>{children}</span>
      {sub && <span className="ff-sub">{sub}</span>}
      {basis && <Basis b={basis} />}
    </div>
  );
}

export function ThinBar({ frac, tone = color.water, mark, h = 4 }: { frac: number; tone?: string; mark?: number; h?: number }) {
  return (
    <div className="ff-bar" style={{ height: h, borderRadius: h / 2 }} aria-hidden>
      <div style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, height: h, borderRadius: h / 2, background: tone }} />
      {mark !== undefined && <div className="ff-bar-mark" style={{ left: `${Math.min(1, mark) * 100}%`, top: -4, height: h + 8 }} />}
    </div>
  );
}

export function Sparkline({ values, w = 180, h = 26, label }: { values: number[]; w?: number; h?: number; label: string }) {
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const pts = values.map((v, i) => `${((w * i) / (values.length - 1)).toFixed(1)},${(h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 4)).toFixed(1)}`).join(" ");
  const base = h - 2 - ((values[0] - mn) / (mx - mn || 1)) * (h - 4);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ display: "block" }}>
      <line x1={0} x2={w} y1={base} y2={base} stroke={HAIR} strokeDasharray="2 3" />
      <polyline points={pts} fill="none" stroke={color.ink} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Glass card that opens from the click point and closes 20 % faster (tokens popEnterMs / popExitMs). */
export function PopCard({ open, origin = "top right", children, style, className = "", testId, label }: {
  open: boolean; origin?: string; children: ReactNode; style?: React.CSSProperties; className?: string; testId?: string; label: string;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key={testId ?? label}
          aria-label={label}
          data-testid={testId}
          className={`fv-glass fv-auto ff-card ${className}`}
          style={{ transformOrigin: origin, ...style }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: m.popFromScale, y: m.popFromY }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: m.popEnterMs / 1000, ease: EASE_OUT } }}
          exit={reduced ? { opacity: 0, transition: { duration: m.popExitMs / 1000 } } : { opacity: 0, scale: m.popFromScale, y: m.popFromY, transition: { duration: m.popExitMs / 1000, ease: EASE_OUT } }}
        >
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export function CardHead({ icon, title, onMinimize, extra }: { icon?: ReactNode; title: string; onMinimize?: () => void; extra?: ReactNode }) {
  return (
    <div className="ff-head">
      {icon && <span className="ff-head-icon">{icon}</span>}
      <h2 className="ff-title">{title}</h2>
      {extra}
      {onMinimize && (
        <FvButton className="fv-icon" style={{ width: 28, height: 28 }} aria-label={`Minimize ${title}`} onClick={onMinimize}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M6 12h12" /></svg>
        </FvButton>
      )}
    </div>
  );
}

export const Label = ({ children }: { children: ReactNode }) => <span className="ff-label">{children}</span>;

export function Row({ k, v, strong = false }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className="ff-row">
      <span>{k}</span>
      <span style={{ color: color.ink, fontWeight: strong ? 500 : 400 }}>{v}</span>
    </div>
  );
}

/** Close a popover on outside pointerdown or Escape. */
export function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") cb.current(); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key); };
  }, [open, ref]);
}
