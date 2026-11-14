"use client";
// Extra readouts for a scenario, shown inside the Simulate panel. Returns null when the scenario has none.
import { offline } from "@/lib/api/client";
import type { ScenarioRun } from "@/lib/twin/scenario";

import { TooWetReadout } from "./TooWetReadout";
import { TrendsChartPanel } from "./TrendsChartPanel";

export function ScenarioExtras({ run }: { run: ScenarioRun | null }) {
  if (!run) return null;
  if (run.scenarioId === "wet-spell") return <TooWetReadout run={run} />;
  if (run.scenarioId === "trends")
    return <TrendsChartPanel inline progress={run.progress} startYear={run.inputs.start_year ?? 1991} series={null} label="Weather trend" note={offline ? "NASA imagery needs a connection" : undefined} />;
  return null;
}
