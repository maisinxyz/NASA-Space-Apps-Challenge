"use client";
// Compare mode, right inspector: why the first option is first, the ranking with the existing rotation pinned as the
// baseline row, and the priority weights. The on-map A/B split and the cover calendar are in CompareTray.
import { Fe1Panel } from "@/components/rotation/fe1/Fe1Panel";
import { BasisChip, SourceFooter, Value } from "@/components/ui/Provenance";
import { useAppStore } from "@/lib/store";
import { bareMonths, explainRanking, PRIORITIES, PRIORITY_LABELS, rankRotations, vsBaseline } from "@/lib/twin/rotations";

import { hudBtn, useTwin } from "./shared";

const WORD = { higher: "higher than existing", similar: "similar to existing", lower: "lower than existing" } as const;

function Dots({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`size-1.5 rounded-full ${i <= n ? "bg-accent" : "bg-white/20"}`} />
      ))}
    </span>
  );
}

export function ComparePanel() {
  const priorities = useAppStore((s) => s.priorities);
  const compareB = useAppStore((s) => s.compareB);
  const compareA = useAppStore((s) => s.compareA);
  const { rotations } = useTwin();
  const ranked = rankRotations(rotations, priorities);
  const baseline = rotations.find((r) => r.isExisting)!;
  const rankOf = (id: string) => ranked.findIndex((x) => x.rotation.id === id) + 1;
  // Baseline pinned on top; the others in rank order. All three always shown.
  const rows = [baseline, ...ranked.map((x) => x.rotation).filter((r) => !r.isExisting)];
  const top = ranked[0].rotation;

  return (
    <div className="grid gap-3 text-sm">
      <section aria-labelledby="why-h" className="rounded-md border border-accent/40 bg-accent/10 p-2.5">
        <h3 id="why-h" className="text-xs font-semibold">
          Why {top.isExisting ? "the existing rotation" : top.name} is first
        </h3>
        <p className="mt-0.5 text-xs leading-snug">{explainRanking(ranked, priorities)}</p>
      </section>

      <section aria-labelledby="rank-h" className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 id="rank-h" className="text-xs font-semibold">
            Ranking by your priorities
          </h3>
          <BasisChip basis="assumed" />
          <BasisChip basis="relative" />
        </div>
        <ol className="grid gap-1.5">
          {rows.map((r) => {
            const bare = bareMonths(r);
            const isB = compareB === r.id;
            return (
              <li key={r.id} className={`rounded-md border p-2 ${r.isExisting ? "border-white/25 bg-white/5" : "border-white/10"}`}>
                <div className="flex min-w-0 items-start gap-2">
                  <span className="font-mono text-xs text-ink-muted tabular-nums" aria-label={`Ranked ${rankOf(r.id)} of ${rotations.length}`}>
                    #{rankOf(r.id)}
                  </span>
                  <p className="min-w-0 flex-1 leading-snug font-medium">
                    {r.name}
                    {r.isExisting && <span className="ml-1.5 rounded border border-ink-muted px-1 text-[0.65rem] font-semibold text-ink-muted">Existing · baseline</span>}
                  </p>
                  {!r.isExisting && r.id !== compareA && (
                    <button type="button" aria-pressed={isB} onClick={() => useAppStore.setState({ compareB: r.id })} className={`${hudBtn} !min-h-6 !px-1.5 text-xs ${isB ? "!border-accent text-accent" : ""}`}>
                      {isB ? "Shown as B" : "Show as B"}
                    </button>
                  )}
                </div>
                <dl className="mt-1 grid gap-0.5 text-xs">
                  {PRIORITIES.map((p) => (
                    <div key={p} className="grid grid-cols-[minmax(0,1fr)_auto_7rem] items-center gap-2">
                      <dt className="text-ink-muted">{PRIORITY_LABELS[p]}</dt>
                      <Dots n={r.scores[p]} />
                      <dd>
                        <span className="sr-only">
                          {r.scores[p]} of 5,{" "}
                        </span>
                        {r.isExisting ? <span className="text-ink-muted">baseline</span> : WORD[vsBaseline(r.scores[p], baseline.scores[p])]}
                      </dd>
                    </div>
                  ))}
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-ink-muted">Bare soil</dt>
                    <dd>
                      <Value
                        value={`${bare.total} of ${r.years.length * 12}`}
                        meta={{ basis: "derived", unit: "months", sourceId: "rotationCalendar", qualityNote: "Counted from typical season windows, not observed on these fields." }}
                      />
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ol>
      </section>

      <Fe1Panel />
      <SourceFooter ids={["teamScores", "rotationCalendar"]} />
    </div>
  );
}
