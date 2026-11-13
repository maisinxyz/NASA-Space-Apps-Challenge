"use client";
import type { ViewerPin } from "@/components/viewer";
import type { Insight } from "@/lib/api/types";

const KIND: Record<Insight["kind"], string> = { terrain: "Terrain", cover: "Ground cover", storm: "Storm", rotation: "Rotation", data_quality: "Data quality" };

/** Insights with `at_time_min` only appear once the replay reaches that time. */
export const visibleInsights = (all: Insight[], timeMin: number | null) => all.filter((i) => i.anchor.at_time_min === null || (timeMin !== null && timeMin >= i.anchor.at_time_min));

export const insightPins = (list: Insight[], activeId: string | null): ViewerPin[] =>
  list.map((i) => ({ id: i.id, lon: i.anchor.lon, lat: i.anchor.lat, label: `${i.title}, severity ${i.severity} of 5`, text: String(i.severity), active: i.id === activeId }));

/** Severity as text plus a bar shape, never colour alone. */
function Severity({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink">
      <span aria-hidden className="inline-flex items-end gap-px">
        {[1, 2, 3, 4, 5].map((k) => (
          <span key={k} className={`w-1 border border-ink ${k <= n ? "bg-ink" : "bg-transparent"}`} style={{ height: 3 + k * 2 }} />
        ))}
      </span>
      Severity {n}/5
    </span>
  );
}

/** Non-blocking list beside the viewer; the matching pin on the terrain opens the same item. */
export function InsightPanel({ insights, hiddenCount, activeId, onSelect, error }: { insights: Insight[]; hiddenCount: number; activeId: string | null; onSelect(id: string | null): void; error?: unknown }) {
  return (
    <section aria-labelledby="insights-h">
      <h2 id="insights-h" className="text-sm font-semibold text-ink">
        Insights
      </h2>
      {error != null && <p className="mt-1 text-sm text-ink-muted">Insights could not load. The map and numbers still work.</p>}
      {error == null && insights.length === 0 && <p className="mt-1 text-sm text-ink-muted">No insights for this view yet.</p>}
      <ul className="mt-2 grid gap-2" aria-live="polite">
        {insights.map((i) => {
          const open = i.id === activeId;
          return (
            <li key={i.id} className={`rounded-md border bg-surface-2 ${open ? "border-accent" : "border-line"}`}>
              <button type="button" aria-expanded={open} onClick={() => onSelect(open ? null : i.id)} className="flex w-full flex-col items-start gap-1 p-2 text-left">
                <span className="flex w-full items-start gap-2">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-bold text-ink">
                    {i.severity}
                  </span>
                  <span className="text-sm font-medium text-ink">{i.title}</span>
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 pl-8 text-xs text-ink-muted">
                  <Severity n={i.severity} />
                  <span>{KIND[i.kind]}</span>
                  <span>Confidence: {i.confidence}</span>
                  {i.anchor.at_time_min !== null && <span>From minute {i.anchor.at_time_min.toLocaleString("en-US")} of the storm</span>}
                </span>
              </button>
              {open && (
                <div className="grid gap-1 border-t border-line p-2 pl-10 text-sm">
                  <p className="text-ink">{i.body}</p>
                  <p className="text-ink">
                    <b>Why it matters:</b> {i.why_it_matters}
                  </p>
                  <p className="text-ink">
                    <b>Tip:</b> {i.tip}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && <p className="mt-2 text-xs text-ink-muted">{hiddenCount === 1 ? "1 more insight appears" : `${hiddenCount} more insights appear`} later in the storm replay.</p>}
    </section>
  );
}
