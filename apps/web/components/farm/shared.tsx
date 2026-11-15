"use client";
import { type ReactNode, useId } from "react";

import type { CropLook } from "@/components/globe/types";
import { farmById, type TwinConfig, twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";
import { CROP_LABELS } from "@/lib/twin/rotations";

/** The current farm's twin. Returns the twin config if configured, or a safe stub for explore-only farms. */
export function useTwin(): TwinConfig {
  const farmId = useAppStore((s) => s.farmId);
  const twin = twinConfig(farmId);
  if (!twin) {
    const explore = farmId ? farmById(farmId) : null;
    if (explore) {
      return {
        fields: [],
        phases: {},
        rotations: [],
        simBbox: [0, 0, 0, 0],
        simAreaLabel: explore.name,
        labels: [explore.owner],
        attribution: [explore.country],
        cropLabels: CROP_LABELS,
        outlineSource: "osm",
        outlineDate: "",
        overlayMask: [],
        rotationSet: "ny-dairy",
      };
    }
    throw new Error(`No twin config for farm "${farmId}"`);
  }
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
// The fv-hud-* marker classes let the farm view restyle these (components/farm-view/styles.ts).
export const hudBtn = "fv-hud-btn inline-flex min-h-7 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm hover:bg-white/15 disabled:opacity-50";
export const hudBtnOn = "fv-hud-btn fv-hud-on inline-flex min-h-7 items-center gap-1.5 rounded-md border border-accent bg-accent px-2.5 text-sm font-semibold text-accent-ink";
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

/** The crop sequences are made up, so no calendar is drawn: "No data" until real crop records exist. */
export function CoverCalendar(_props: { rows?: unknown; month?: number; onPickMonth?(m: number): void; activeRow?: number }) {
  return <p className="text-xs text-ink-muted">No data</p>;
}
