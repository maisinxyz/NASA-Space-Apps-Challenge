// F1-3: the three rotations, ranked by the farmer's weights (client-side), existing one labeled. Pure: data in, markup out.
import { Badge } from "@/components/ui/Badge";
import { EvidenceCardView } from "@/components/lab/EvidenceCardView";
import type { AnalyzedRotation, Criterion, RotationAnalysis } from "@/lib/rotation/draft-types";
import { rerank } from "@/lib/rotation/rank";

import { Scorecard, SCORE_NOTE } from "./Scorecard";

export function RotationResults({ analysis, weights, selected, cropNames, showMock }: { analysis: RotationAnalysis; weights: Partial<Record<Criterion, number>>; selected: readonly Criterion[]; cropNames: Record<string, string>; showMock: boolean }) {
  const ranked = rerank(analysis.rotations, weights, selected);
  const list: (AnalyzedRotation & { rank?: number })[] = ranked ? [...ranked].sort((a, b) => a.rank - b.rank) : analysis.rotations;
  const crop = (id: string) => cropNames[id] ?? id;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {showMock && <Badge variant="mock" />}
        {analysis.limited_data && <span className="rounded border border-dashed border-ink-muted px-1.5 py-px font-semibold">Limited data for this location</span>}
      </div>
      {analysis.warnings.map((w) => (
        <p key={w.code} role="status" className="rounded-md border border-white/20 bg-white/5 p-2 text-xs">
          {w.message}
        </p>
      ))}
      <p className="text-xs text-ink-muted">{SCORE_NOTE}</p>
      <ol className="grid gap-2">
        {list.map((r) => (
          <li key={r.rotation_id} className={`grid gap-1.5 rounded-md border p-2 ${r.is_existing ? "border-white/25 bg-white/5" : "border-white/10"}`}>
            <div className="flex min-w-0 items-start gap-2">
              {ranked && <span className="font-mono text-xs text-ink-muted tabular-nums">#{r.rank}</span>}
              <h4 className="min-w-0 flex-1 text-sm leading-snug font-medium">
                {r.name}
                {r.is_existing && <span className="ml-1.5 rounded border border-ink-muted px-1 text-[0.65rem] font-semibold text-ink-muted">Your current rotation</span>}
              </h4>
            </div>
            <ul className="flex flex-wrap gap-1 text-xs">
              {r.sequence.map((s) => (
                <li key={`${s.year_index}-${s.season}-${s.crop_id}`} className="rounded bg-white/10 px-1.5 py-px">
                  Year {s.year_index + 1} {s.season}: {crop(s.crop_id)}
                </li>
              ))}
            </ul>
            {ranked && (
              <p className="text-xs">
                Overall for your priorities: <b className="tabular-nums">{r.overall}</b> <span className="text-ink-muted">out of 100, relative</span>
              </p>
            )}
            {r.rank_stability && <p className="text-xs text-ink-muted">{r.rank_stability}</p>}
            <Scorecard rows={r.scorecard} />
            <details>
              <summary className="cursor-pointer text-xs font-medium">Why this option</summary>
              <div className="mt-1">
                <EvidenceCardView card={r.evidence_card} name={r.name} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
