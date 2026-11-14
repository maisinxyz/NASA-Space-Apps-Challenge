"use client";
// Extra floating panels for a scenario (not mounted yet). Returns null when the scenario has none.
import type { ScenarioRun } from "@/lib/twin/scenario";

import { TooWetReadout } from "./TooWetReadout";
import { TrendsChartPanel } from "./TrendsChartPanel";

export function ScenarioExtras({ run }: { run: ScenarioRun | null }) {
  if (!run) return null;
  if (run.scenarioId === "wet-spell") return <TooWetReadout run={run} />;
  if (run.scenarioId === "trends") return <TrendsChartPanel progress={run.progress} startYear={run.inputs.start_year ?? 1991} series={null} label="Weather trend" />;
  return null;
}
