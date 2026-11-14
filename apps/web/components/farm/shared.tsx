"use client";
import { type ReactNode, useId } from "react";

import type { CropLook } from "@/components/globe/types";
import { type TwinConfig, twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";
import { CROP_LABELS, MONTHS } from "@/lib/twin/rotations";

/** The current farm's twin. Only call inside the twin workspace (GlobeHome renders it only for twin farms). */
export function useTwin(): TwinConfig {
  const farmId = useAppStore((s) => s.farmId);
  const twin = twinConfig(farmId);
  if (!twin) throw new Error(`No twin config for farm "${farmId}"`);
  return twin;
}

/** Regional crop names of the current farm, or the generic ones outside a twin. */
export const useCropLabels = () => twinConfig(useAppStore((s) => s.farmId))?.cropLabels ?? CROP_LABELS;

/** UI swatch colours for the crop legend and cover calendars (the 3D look is drawn by Globe.tsx). */
export const CROP_COLOR: Record<CropLook, string> = {
  grass: "#4f9a3c",
  corn: "#c9b23a",
  cereal: "#b8a05a",
  legume: "#3f7f5e",
  cover: "#7fae4a",
  berry: "#7a3b5c",
  bare: "#3b2616",
};

export function CropSwatch({ crop }: { crop: CropLook }) {
  const labels = useCropLabels();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-3 rounded-sm ring-1 ring-white/20" style={{ background: CROP_COLOR[crop] }} />
      {labels[crop]}
    </span>
  );
}

/** HUD button: ≥24 px target, visible focus ring from globals.css. */
export const hudBtn = "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm hover:bg-white/15 disabled:opacity-50";
export const hudBtnOn = "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-accent bg-accent px-2.5 text-sm font-semibold text-accent-ink";
export const hudSelect = "min-h-7 rounded-md border border-white/15 bg-[#1b1e24] px-2 text-sm";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-current/40 px-1 font-mono text-[0.65rem] leading-4 opacity-80">{children}</kbd>;
}

/** Dark glass floating panel with a title bar and a collapse toggle. */
export function Panel({ title, open, onToggle, className = "", children, footer }: { title: ReactNode; open: boolean; onToggle(): void; className?: string; children: ReactNode; footer?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`} className={`glass flex flex-col overflow-hidden ${className}`}>
      <header className="flex items-center gap-2 border-b border-white/10 py-1 pr-1 pl-3">
        <h2 id={`${id}-h`} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </h2>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-white/10 hover:text-ink">
          <span aria-hidden>{open ? "−" : "+"}</span>
          <span className="sr-only">{open ? "Collapse" : "Expand"} panel</span>
        </button>
      </header>
      {open && (
        <>
          <div id={id} className="min-h-0 overflow-x-hidden overflow-y-auto p-3">
            {children}
          </div>
          {footer && <footer className="border-t border-white/10 px-3 py-1.5">{footer}</footer>}
        </>
      )}
    </section>
  );
}

/**
 * Month-by-year ground-cover calendar; bare months are outlined. `rows` = one 12-month row per label. Month labels
 * on top; with `onPickMonth` they are buttons that pick the month shown on the fields.
 */
export function CoverCalendar({ rows, month, onPickMonth, activeRow }: { rows: { label: string; months: CropLook[] }[]; month?: number; onPickMonth?(m: number): void; activeRow?: number }) {
  const labels = useCropLabels();
  const grid = "grid grid-cols-[4.5rem_repeat(12,minmax(0,1fr))] items-center gap-px";
  return (
    <div className="grid gap-0.5 text-[0.65rem]">
      <div className={`${grid} text-center text-ink-muted`}>
        <span />
        {MONTHS.map((m, i) =>
          onPickMonth ? (
            <button key={m} type="button" aria-pressed={i === month} aria-label={`Show ${m} on the fields`} onClick={() => onPickMonth(i)} className={`min-h-6 rounded ${i === month ? "bg-accent font-semibold text-accent-ink" : "hover:bg-white/10"}`}>
              {m}
            </button>
          ) : (
            <span key={m} className={i === month ? "font-semibold text-ink" : ""}>
              {m}
            </span>
          ),
        )}
      </div>
      {rows.map((r, ri) => (
        <div key={r.label} role="group" className={grid} aria-label={`${r.label}: ${r.months.filter((c) => c === "bare").length} bare months`}>
          <span className={`truncate ${ri === activeRow ? "font-semibold text-ink" : "text-ink-muted"}`}>{r.label}</span>
          {r.months.map((c, m) => (
            <span
              key={m}
              title={`${r.label}, ${MONTHS[m]}: ${labels[c]}`}
              className={`h-3 rounded-[2px] ${c === "bare" ? "outline outline-1 -outline-offset-1 outline-amber-300" : ""} ${m === month && ri === activeRow ? "ring-2 ring-white" : ""}`}
              style={{ background: CROP_COLOR[c] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
