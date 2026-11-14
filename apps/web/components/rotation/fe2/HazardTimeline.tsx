import type { HazardCalendar, HazardCatalog } from "@/lib/rotation/draft-types";

import { ChartFrame, HazardChart, weekRows, weekRuns, monthOfWeek } from "./charts";

export const BARE_COVER_BELOW = 0.3;

/** Weeks (1-52) whose month has cover below 0.30 (PRD bare-field rule). Empty without cover data. */
export function bareWeeks(monthlyCover?: number[]): number[] {
  if (!monthlyCover || monthlyCover.length !== 12) return [];
  return Array.from({ length: 52 }, (_, i) => i + 1).filter((w) => monthlyCover[monthOfWeek(w)] < BARE_COVER_BELOW);
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
      <p className="text-xs text-ink-muted">
        Blue: share of past years with heavy rain on wet ground. Amber: share with a dry spell. Amber bands: weeks in the vulnerable season{bare.length ? "; grey bands: bare-field weeks (cover below 0.30)" : ""}.
      </p>
    </div>
  );
}
