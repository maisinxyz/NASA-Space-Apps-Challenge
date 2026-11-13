"use client";
// Compare mode: priority sliders re-rank the three rotations; each column shows assumed relative scores and a
// bare-soil calendar derived from the rotation sequence. "Show on fields" paints that rotation's season in 3D.
import { BasisChip } from "@/components/ui/BasisChip";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { useAppStore } from "@/lib/store";
import { bareMonths, CROP_LABELS, MONTHS, PRIORITIES, PRIORITY_LABELS, rankRotations, ROTATIONS } from "@/lib/twin/rotations";

import { CROP_COLOR, SeasonPicker } from "./shared";

export function ComparePanel() {
  const priorities = useAppStore((s) => s.priorities);
  const shown = useAppStore((s) => s.twinRotationId);
  const ranked = rankRotations(ROTATIONS, priorities);

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-semibold">
          What matters most to you? <span className="font-normal text-ink-muted">(0 = not important, 5 = very)</span>
        </legend>
        {PRIORITIES.map((p) => (
          <label key={p} className="grid grid-cols-[9.5rem_1fr_1.5rem] items-center gap-2 text-sm">
            {PRIORITY_LABELS[p]}
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={priorities[p]}
              onChange={(e) => useAppStore.setState({ priorities: { ...priorities, [p]: Number(e.target.value) } })}
              className="accent-accent"
            />
            <output className="text-right tabular-nums">{priorities[p]}</output>
          </label>
        ))}
      </fieldset>

      <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        Ranked by your priorities. Scores 1–5 are our assumption, comparing these three only <BasisChip basis="assumed" />
        <BasisChip basis="relative" />
      </p>

      <ol className="grid grid-cols-3 gap-3">
        {ranked.map(({ rotation: r, total }, rank) => {
          const bare = bareMonths(r);
          const on = shown === r.id;
          return (
            <li key={r.id} className={`flex flex-col gap-2 rounded-lg border p-3 ${on ? "border-accent" : "border-line"} bg-surface-2/60`}>
              <p className="text-xs text-ink-muted">
                #{rank + 1} · score {total}
              </p>
              <h3 className="font-display leading-snug">{r.name}</h3>
              {r.isExisting && <span className="w-fit rounded border border-ink-muted px-1.5 text-xs font-semibold">Existing</span>}

              <dl className="grid gap-1 text-xs">
                {PRIORITIES.map((p) => (
                  <div key={p} className="flex items-center justify-between gap-2">
                    <dt className="text-ink-muted">{PRIORITY_LABELS[p]}</dt>
                    <dd aria-label={`${r.scores[p]} of 5`} className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} aria-hidden className={`size-2 rounded-full ${i <= r.scores[p] ? "bg-accent" : "bg-line"}`} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="text-xs text-ink-muted">Ground cover by month (outlined = bare soil)</p>
                <div className="mt-1 grid gap-0.5">
                  {r.years.map((y, yi) => (
                    <div key={yi} className="grid grid-cols-[1.5rem_repeat(12,1fr)] items-center gap-px" aria-label={`Year ${yi + 1}: ${bare.perYear[yi]} bare months`}>
                      <span className="text-[0.65rem] text-ink-muted">Y{yi + 1}</span>
                      {y.map((c, m) => (
                        <span
                          key={m}
                          title={`Year ${yi + 1}, ${MONTHS[m]}: ${CROP_LABELS[c]}`}
                          className={`h-3 rounded-[2px] ${c === "bare" ? "outline outline-1 -outline-offset-1 outline-amber-300" : ""}`}
                          style={{ background: CROP_COLOR[c] }}
                        />
                      ))}
                    </div>
                  ))}
                  <div className="grid grid-cols-[1.5rem_repeat(12,1fr)] gap-px text-center text-[0.55rem] text-ink-muted" aria-hidden>
                    <span />
                    {MONTHS.map((m) => (
                      <span key={m}>{m[0]}</span>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs">
                  Bare: {bare.total} of {r.years.length * 12} months ({Math.round(bare.share * 100)} %) <BasisChip basis="derived" />
                </p>
              </div>

              <button
                type="button"
                aria-pressed={on}
                onClick={() => useAppStore.setState({ twinRotationId: on ? null : r.id })}
                className={`mt-auto rounded-md px-2 py-1 text-sm ${on ? "bg-accent text-accent-ink" : "border border-line hover:bg-line"}`}
              >
                {on ? "Shown on fields" : "Show on fields"}
              </button>
            </li>
          );
        })}
      </ol>

      <SeasonPicker />
      <p className="text-xs text-ink-muted">Bare months come from the rotation sequence and typical season windows, not from field observation. Scores are relative and are not yield or profit estimates.</p>
      <p role="note" className="rounded border border-line bg-surface-2 px-2 py-1 text-xs">
        {SUPPORT_SENTENCE}
      </p>
    </div>
  );
}
