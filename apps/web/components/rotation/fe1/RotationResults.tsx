// F1-3: the three rotations, ranked by the farmer's weights (client-side), existing one labeled. Pure: data in, markup out.
import { Badge } from "@/components/ui/Badge";
import { EvidenceCardView } from "@/components/lab/EvidenceCardView";
import type { AnalyzedRotation, Criterion, RotationAnalysis } from "@/lib/rotation/draft-types";
import { GlossaryTerm } from "@/components/rotation/fe2/Glossary";
import { rerank } from "@/lib/rotation/rank";

import { Scorecard, SCORE_NOTE } from "./Scorecard";

export function RotationResults({ analysis, weights, selected, cropNames, showMock }: { analysis: RotationAnalysis; weights: Partial<Record<Criterion, number>>; selected: readonly Criterion[]; cropNames: Record<string, string>; showMock: boolean }) {
  const ranked = rerank(analysis.rotations, weights, selected);
  const list: (AnalyzedRotation & { rank?: number })[] = ranked ? [...ranked].sort((a, b) => a.rank - b.rank) : analysis.rotations;
  // rank_stability was computed by the backend for the weights it was sent; weights re-rank client-side without refetch.
  const echo = analysis.request_echo;
  const sameBasis = !!echo && selected.length === echo.criteria_selected.length && selected.every((c) => echo.criteria_selected.includes(c) && (weights[c] ?? 0) === (echo.weights[c] ?? 0));
  const crop = (id: string) => cropNames[id] ?? id;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {/* All rotation analysis runs on twin (curated) farms, so the pre-built badge is unconditional. */}
        <Badge variant="pre-built" />
        {showMock && <Badge variant="mock" />}
        {analysis.limited_data && <span className="rounded border border-dashed border-ink-muted px-1.5 py-px font-semibold">Limited data for this location</span>}
      </div>
      {analysis.warnings.map((w) => (
        <p key={w.code} role="status" className="rounded-md border border-white/20 bg-white/5 p-2 text-xs">
          {w.message}
        </p>
      ))}
      <p className="text-xs text-ink-muted">
        <GlossaryTerm id="relative_score">Relative</GlossaryTerm> scores: {SCORE_NOTE}
      </p>
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
                Overall for your priorities: <b className="tabular-nums">{r.overall}</b> <span className="text-ink-muted">out of 100, <GlossaryTerm id="relative_score">relative</GlossaryTerm></span>
              </p>
            )}
            {r.rank_stability && <p className="text-xs text-ink-muted">{sameBasis ? r.rank_stability : "Rank stability refers to the weights at the last refresh."}</p>}
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
