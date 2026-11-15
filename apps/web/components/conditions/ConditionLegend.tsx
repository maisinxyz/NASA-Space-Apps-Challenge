"use client";
// Collapsible condition legend: grouped conditions, one hue each; click one to colour the plots (2D and 3D) by it.
// The selected condition shows its light -> dark scale with the real number range, and what to do this year and now.
import { useState } from "react";

import { CONDITIONS, GROUPS, tint, type Cond, type GroupId } from "@/lib/conditions/model";
import { band, RECS } from "@/lib/conditions/recommendations";
import { useConditionStore, useConditionView } from "@/lib/conditions/useConditionView";
import { color } from "@/lib/farm-view/tokens";
import { twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";

import { FvButton } from "@/components/farm-view/FvButton";

const num = (c: Cond, v: number) => (c.fmt ? c.fmt(v) : `${Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)} ${c.unit}`);
const FIRST_YEAR = 2026;

export function ConditionLegend({ embedded = false }: { embedded?: boolean }) {
  const { selected, open } = useConditionStore();
  const view = useConditionView();
  const [shut, setShut] = useState<Partial<Record<GroupId, boolean>>>({});
  const set = useConditionStore.setState;

  return (
    <section className="fv-glass fv-auto ff-card" data-testid="condition-legend" aria-label="Conditions legend" style={{ ...(embedded ? { position: "relative" as const, width: "100%", boxSizing: "border-box" as const } : { right: 40, bottom: 200, width: 320, maxHeight: "calc(100vh - 300px)", overflowY: "auto" as const }), gap: 6, padding: "10px 12px" }}>
      <FvButton className="ff-link" aria-expanded={open} data-testid="condition-legend-toggle" onClick={() => set({ open: !open })} style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <strong style={{ color: color.ink }}>Conditions{view ? ` · ${view.cond.label}` : ""}</strong>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </FvButton>

      {open && GROUPS.map((g) => (
        <div key={g.id} style={{ display: "grid", gap: 2 }}>
          <FvButton className="ff-link" aria-expanded={!shut[g.id]} onClick={() => setShut((s) => ({ ...s, [g.id]: !s[g.id] }))} style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 11.5, color: color.inkSecondary, textTransform: "uppercase", letterSpacing: 0.4 }}>
            <span>{g.label}</span>
            <span aria-hidden>{shut[g.id] ? "▸" : "▾"}</span>
          </FvButton>
          {!shut[g.id] && (
            <ul role="radiogroup" aria-label={g.label} style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 1 }}>
              {CONDITIONS.filter((c) => c.group === g.id).map((c) => {
                const on = c.id === selected;
                return (
                  <li key={c.id}>
                    <FvButton role="radio" aria-checked={on} data-testid={`condition-${c.id}`} className="ff-link" onClick={() => set({ selected: on ? null : c.id })}
                      style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 8, alignItems: "center", width: "100%", textAlign: "left", padding: "3px 4px", borderRadius: 6, background: on ? "rgba(242,235,221,.12)" : "transparent", fontSize: 12.5, color: color.ink }}>
                      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 3, background: `linear-gradient(135deg, ${tint(c, 0.1)}, ${tint(c, 0.95)})`, border: "1.5px solid #fff" }} />
                      <span>{c.label}</span>
                    </FvButton>
                    {on && view && <Detail view={view} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function Detail({ view }: { view: NonNullable<ReturnType<typeof useConditionView>> }) {
  const c = view.cond;
  const twin = twinConfig(useAppStore((s) => s.farmId));
  const name = (id: string) => twin?.fields.find((f) => f.id === id)?.name ?? id;
  const avg = view.series[view.year - 1];
  const sevAvg = view.plots.reduce((a, p) => a + p.sev, 0) / (view.plots.length || 1);
  const sevNow = view.now.plots.reduce((a, p) => a + p.sev, 0) / (view.now.plots.length || 1);
  const r = RECS[c.id];
  const lo = c.invert ? view.max : view.min, hi = c.invert ? view.min : view.max;
  return (
    <div data-testid="condition-detail" style={{ display: "grid", gap: 6, padding: "6px 4px 8px 26px", fontSize: 12 }}>
      <div aria-hidden style={{ height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${tint(c, 0)}, ${tint(c, 0.5)}, ${tint(c, 1)})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", color: color.inkSecondary, fontSize: 11 }}>
        <span>{c.low} · {num(c, lo)}</span>
        <span>{c.high} · {num(c, hi)}</span>
      </div>
      <span>Year {view.year} ({FIRST_YEAR + view.year - 1}), farm average: <b>{num(c, avg)}</b></span>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2 }}>
        {view.plots.map((p) => (
          <li key={p.fieldId} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 6, alignItems: "center", fontSize: 11.5 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: p.colour }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name(p.fieldId)}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: color.inkSecondary }}>{num(c, p.value)}</span>
          </li>
        ))}
      </ul>
      <div data-testid="condition-rec-year"><b style={{ fontWeight: 600 }}>In {FIRST_YEAR + view.year - 1}:</b> {r.year[band(sevAvg)]}</div>
      <div data-testid="condition-rec-now"><b style={{ fontWeight: 600 }}>Right now:</b> {r.now[band(sevNow)]}</div>
    </div>
  );
}
