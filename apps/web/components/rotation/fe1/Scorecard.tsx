// F1-4 / F1-5: seven criterion rows, each with score + unit + basis chip; range bar only when the API sent one.
import { BasisChip } from "@/components/ui/BasisChip";
import type { RotationScorecard } from "@/lib/rotation/draft-types";

import { CRITERION_LABELS } from "./presets";

export const SCORE_NOTE = "Scores compare only these three options with each other. They are not yield, profit or soil loss.";
const CONF: Record<string, string> = { high: "high confidence", medium: "medium confidence", low: "low confidence" };

function RangeBar({ p10, p90 }: { p10: number; p90: number }) {
  const lo = Math.max(0, Math.min(100, p10));
  const hi = Math.max(lo, Math.min(100, p90));
  return (
    <span data-range-bar className="mt-0.5 flex items-center gap-1.5">
      <span aria-hidden className="relative h-1.5 w-24 rounded bg-white/15">
        <span className="absolute inset-y-0 rounded bg-accent" style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 1)}%` }} />
      </span>
      <span className="text-[0.7rem] text-ink-muted">
        likely range {p10} to {p90}
      </span>
    </span>
  );
}

export function Scorecard({ rows }: { rows: RotationScorecard[] }) {
  return (
    <dl className="grid gap-1 text-xs">
      {rows.map((r) => (
        <div key={r.criterion} className="grid gap-0.5 border-t border-white/10 pt-1">
          <dt className="font-medium">{CRITERION_LABELS[r.criterion] ?? r.criterion}</dt>
          <dd className="grid gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <b className="tabular-nums">{r.score}</b>
              <span className="text-ink-muted">{r.unit}</span>
              <BasisChip basis={r.basis} />
            </span>
            {r.range && <RangeBar p10={r.range.p10} p90={r.range.p90} />}
            <span className="text-[0.7rem] text-ink-muted">
              {CONF[r.confidence] ?? r.confidence}
              {r.needs_local_review && <span className="ml-1.5 rounded border border-ink-muted px-1 font-semibold">Needs local review</span>}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
