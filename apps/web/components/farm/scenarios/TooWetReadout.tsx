"use client";
// "Too wet to work" readout for the wet-spell scenario. The wetness threshold is an assumption, so the basis chip says "assumed".
import { BasisChip } from "@/components/ui/BasisChip";
import { tooWetDays } from "@/lib/twin/scenarios/ground";
import type { ScenarioRun } from "@/lib/twin/scenario";

export function TooWetReadout({ run }: { run: ScenarioRun }) {
  return (
    <div role="status" aria-label="Too wet to work" className="glass inline-flex items-center gap-2 px-2.5 py-1 text-sm">
      <span>Too wet to work: {tooWetDays(run)} days so far</span>
      <BasisChip basis="assumed" />
    </div>
  );
}
