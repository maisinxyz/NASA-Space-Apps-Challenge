"use client";
// Trends chart. `inline` = a block inside the Simulate panel; otherwise a floating panel pinned above the ground anchor
// (the renderer publishes the anchor). No series = no numbers. One clock step = one year (lib/twin/scenarios/clock.ts).
import { useSyncExternalStore } from "react";

import { BasisChip } from "@/components/ui/BasisChip";
import { getAnchor, subscribeAnchor } from "@/components/viewer/cesium/ground/anchor";
import { LAST_IMAGERY_YEAR, trendsFirstYear, trendsSteps } from "@/lib/twin/scenarios/clock";

const FIRST = 1981;
const LAST = LAST_IMAGERY_YEAR; // same fixed "now" year as the trends evaluator
const W = 220;
const H = 70;

export type TrendsChartPanelProps = {
  progress: number;
  startYear: number;
  series?: { year: number; value: number }[] | null;
  label?: string;
  unit?: string;
  /** Render in normal flow (Simulate panel) instead of floating over the map. */
  inline?: boolean;
  /** Shown under the chart instead of the default "arrives from the backend" line (e.g. offline). */
  note?: string;
};

export function TrendsChartPanel({ progress, startYear, series, label = "Trend", unit, inline = false, note }: TrendsChartPanelProps) {
  const anchor = useSyncExternalStore(subscribeAnchor, getAnchor, () => null);
  if (!inline && (!anchor || !anchor.visible)) return null;
  const first = trendsFirstYear(startYear);
  const steps = trendsSteps(startYear);
  const cursorYear = first + Math.min(steps - 1, Math.floor(Math.min(1, Math.max(0, progress)) * steps));
  const x = (y: number) => ((y - FIRST) / (LAST - FIRST)) * W;
  const has = !!series && series.length > 1;
  let path = "";
  if (has) {
    const vs = series.map((s) => s.value);
    const lo = Math.min(...vs);
    const span = Math.max(...vs) - lo || 1;
    path = series.map((s, i) => `${i ? "L" : "M"}${x(s.year).toFixed(1)},${(H - 4 - ((s.value - lo) / span) * (H - 8)).toFixed(1)}`).join("");
  }
  const cls = inline ? "rounded-md border border-white/10 p-2 text-xs" : "glass pointer-events-none absolute z-10 w-60 -translate-x-1/2 -translate-y-full p-2 text-xs";
  return (
    <section aria-label={`${label} chart`} className={cls} style={inline || !anchor ? undefined : { left: anchor.x, top: anchor.y - 8 }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <b>
          {label}
          {has && unit ? ` (${unit})` : ""}
        </b>
        {has && <BasisChip basis="measured" />}
      </div>
      <svg role="img" aria-label={has ? `${label} from ${series[0].year} to ${series[series.length - 1].year}` : "Empty trend axis"} viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="currentColor" strokeOpacity={0.4} />
        {has && <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />}
        <line x1={x(cursorYear)} y1={0} x2={x(cursorYear)} y2={H} stroke="currentColor" strokeDasharray="3 2" />
      </svg>
      <div className="flex justify-between text-ink-muted">
        <span>{FIRST}</span>
        <span>{cursorYear}</span>
        <span>{LAST}</span>
      </div>
      {!has && <p className="mt-1 text-ink-muted">{note ?? "Trend data arrives from the backend"}</p>}
    </section>
  );
}
