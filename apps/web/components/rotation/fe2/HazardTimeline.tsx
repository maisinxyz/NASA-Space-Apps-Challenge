import type { CSSProperties, ReactNode } from "react";

import type { HazardCalendar, HazardCatalog } from "@/lib/rotation/draft-types";

import { ChartFrame, HazardChart, weekRows, weekRuns, monthOfWeek } from "./charts";

export const BARE_COVER_BELOW = 0.3;

/** Weeks (1-52) whose month has cover below 0.30 (PRD bare-field rule). Empty without cover data. */
export function bareWeeks(monthlyCover?: number[]): number[] {
  if (!monthlyCover || monthlyCover.length !== 12) return [];
  return Array.from({ length: 52 }, (_, i) => i + 1).filter((w) => monthlyCover[monthOfWeek(w)] < BARE_COVER_BELOW);
}

function Key({ swatch, children }: { swatch: CSSProperties; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-3 w-4 rounded-sm" style={swatch} />
      {children}
    </li>
  );
}

/** F2-2. peak_weeks are read as 1-based week numbers, same axis as the series (TODO(verify) with Backend B). */
export function HazardTimeline({ calendar, hazards, monthlyCover }: { calendar: HazardCalendar; hazards?: HazardCatalog | null; monthlyCover?: number[] }) {
  const vulnerable = weekRuns((hazards?.items ?? []).flatMap((h) => h.peak_weeks));
  const bare = weekRuns(bareWeeks(monthlyCover));
  return (
    <div className="grid gap-2">
      <ChartFrame title="Weekly hazard timeline" unit="share of years (0–1)" basis={calendar.basis}>
        <HazardChart data={weekRows(calendar.j_wet, calendar.j_dry)} vulnerable={vulnerable} bare={bare} />
      </ChartFrame>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <Key swatch={{ background: "var(--basis-derived)" }}>Heavy rain on wet ground: share of past years</Key>
        <Key swatch={{ background: "var(--basis-assumed)" }}>Dry spell: share of past years</Key>
        <Key swatch={{ border: "1px dashed var(--danger)", background: "color-mix(in srgb, var(--danger) 15%, transparent)" }}>Vulnerable season (dashed band)</Key>
        {bare.length > 0 && <Key swatch={{ background: "color-mix(in srgb, var(--ink-muted) 30%, transparent)" }}>Bare-field weeks, cover below 0.30 (grey band)</Key>}
      </ul>
    </div>
  );
}
