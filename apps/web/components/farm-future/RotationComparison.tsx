"use client";
// One comparison of strategies A (current rotation), B and C from the engine (v4 PRD F4). Used in Compare mode and in
// the "Compare rotations" drawer. Crop sequence, crop-role badges from the API, review flags by severity, why
// suggested, evidence, information gaps, local review risks. Hero numbers: soil health, irrigation need against the
// quota, frost-free and heat-stress days. Per-field or whole-farm. No income or fertilizer figures (D3).
import { useState } from "react";

import type { Forecast, ForecastStrategy } from "@/lib/api/types";
import { CURRENT_ROTATION, cropName, rotationText, SWATCHES, STRATEGY_IDS } from "@/lib/farm-future/data";
import { forecastYear } from "@/lib/farm-future/data";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { color } from "@/lib/farm-view/tokens";
import { fmt } from "@/lib/forecast/select";
import { roleLabel } from "@/lib/rotation-planner/planner";

import { AskCopilot } from "@/components/copilot/AskCopilot";

/** Evidence lines never show money or fertilizer amounts (D3). */
export const HIDDEN_EVIDENCE = /income|fertili[sz]er|price|revenue|profit|\$|CAD/i;
const LETTERS = ["A", "B", "C", "D"];
const SEVERITIES = ["verify", "caution", "info"];

type Hero = { label: string; value: string; range?: string };

export function heroNumbers(f: Forecast, s: ForecastStrategy, fieldId: string | null, year: number): Hero[] {
  const core = fieldId ? s : (f.farm_rollup.strategies.find((x) => x.id === s.id) ?? s);
  const pt = (metric: string) => {
    const series = (core.trajectories as Record<string, { unit: string; points: { year: number; p50: number; p10?: number; p90?: number }[] } | undefined>)[metric];
    const p = series?.points.find((x) => x.year === year);
    return series && p ? { ...p, unit: series.unit } : null;
  };
  const out: Hero[] = [];
  const soil = pt("soil_organic_index");
  if (soil) out.push({ label: "Soil health (organic matter index, year 0 = 100)", value: fmt(soil.p50), range: soil.p10 !== undefined && soil.p90 !== undefined ? `${fmt(soil.p10)}–${fmt(soil.p90)}` : undefined });
  const w = core.farm_fit.water_vs_quota;
  const need = w.irrigation_need_p50;
  out.push({
    label: "Irrigation need against the quota",
    value: `${fmt(need.value, need.unit)}${w.quota_mm_per_season != null ? ` of ${fmt(w.quota_mm_per_season, "mm/season")}` : " · no quota set"}`,
    range: need.p10 !== undefined && need.p90 !== undefined ? `${fmt(need.p10)}–${fmt(need.p90)}` : undefined,
  });
  const ff = f.climate_outlook.frost_windows.frost_free_season_days.scenario;
  out.push({ label: "Frost-free days (whole farm)", value: fmt(ff.value, ff.unit), range: ff.p10 !== undefined && ff.p90 !== undefined ? `${fmt(ff.p10)}–${fmt(ff.p90)}` : undefined });
  const heat = f.climate_outlook.heat_stress_days[0];
  const hp = heat?.days.points.find((p) => p.year === year);
  if (heat && hp) out.push({ label: `Heat-stress days for ${cropName(heat.crop_id)} (whole farm)`, value: fmt(hp.p50, heat.days.unit), range: hp.p10 !== undefined && hp.p90 !== undefined ? `${fmt(hp.p10)}–${fmt(hp.p90)}` : undefined });
  return out;
}

export function RotationComparison({ layout = "columns" }: { layout?: "columns" | "stack" }) {
  const { forecast } = useFutureData();
  const t = useFutureStore((s) => s.t);
  const [fieldId, setFieldId] = useState<string | null>(null);
  if (!forecast) return <p className="ff-p" data-testid="comparison-empty">No engine forecast for this farm yet.</p>;
  const field = (fieldId && forecast.fields.find((x) => x.field_id === fieldId)) || forecast.fields[0];
  const strategies = field.strategies.slice(0, 4);
  const year = forecastYear(t, forecast.horizon_years);
  const rank = forecast.comparison.rank_by_priority;
  return (
    <div data-testid="rotation-comparison" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Area
          <select value={fieldId ?? ""} onChange={(e) => setFieldId(e.target.value || null)} data-testid="comparison-field" style={{ background: "transparent", color: color.ink, border: "1px solid rgba(242,235,221,.22)", borderRadius: 6, padding: "2px 6px", fontSize: 12 }}>
            <option value="">Whole farm (area-weighted)</option>
            {forecast.fields.map((f) => <option key={f.field_id} value={f.field_id}>{f.name}</option>)}
          </select>
        </label>
        <span style={{ color: color.inkSecondary }}>Year {year} of {forecast.horizon_years} · scenario forecast</span>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: layout === "columns" ? `repeat(${strategies.length}, minmax(0, 1fr))` : "1fr" }}>
        {strategies.map((s, i) => {
          const label = s.role === "existing" ? CURRENT_ROTATION : s.label;
          const ev = s.evidence_card;
          const flagsBy = SEVERITIES.map((sev) => [sev, s.review_flags.filter((x) => x.severity === sev).length] as const).filter(([, n]) => n > 0);
          const other = s.review_flags.filter((x) => !SEVERITIES.includes(x.severity)).length;
          const rankPos = rank.indexOf(s.id);
          return (
            <article key={s.id} data-testid={`comparison-${s.id}`} style={{ border: "1px solid rgba(242,235,221,.14)", borderRadius: 12, padding: 12, display: "grid", gap: 8, alignContent: "start", background: "rgba(16,13,10,.55)" }}>
              <header style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: SWATCHES[STRATEGY_IDS[Math.min(i, 2)]] }} />
                <strong style={{ fontSize: 14 }}>{LETTERS[i]} · {label}</strong>
                {rankPos >= 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: color.inkSecondary }}>rank {rankPos + 1}</span>}
              </header>
              <span style={{ fontSize: 12 }}>{rotationText(s.plan, s.cycle_years)} · {s.cycle_years}-year cycle</span>
              {s.rotation_explanation && s.rotation_explanation.crop_roles.length > 0 && (
                <div>{s.rotation_explanation.crop_roles.map((r) => <span key={`${r.crop_id}-${r.role}`} title={r.text} style={{ display: "inline-flex", fontSize: 10.5, border: "1px solid rgba(242,235,221,.25)", borderRadius: 9, padding: "1px 8px", margin: "0 4px 4px 0" }}>{roleLabel(r.role)} · {cropName(r.crop_id)}</span>)}</div>
              )}
              <dl style={{ margin: 0, display: "grid", gap: 4 }}>
                {heroNumbers(forecast, s, fieldId, year).map((h) => (
                  <div key={h.label}>
                    <dt style={{ fontSize: 11, color: color.inkSecondary }}>{h.label}</dt>
                    <dd style={{ margin: 0, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{h.value}{h.range ? <span style={{ color: color.inkSecondary }}> ({h.range})</span> : null}</dd>
                  </div>
                ))}
              </dl>
              <div style={{ fontSize: 12 }} data-testid="comparison-flags">
                Review flags: {s.review_flags.length === 0 ? "none" : [...flagsBy.map(([sev, n]) => `${n} ${sev}`), ...(other ? [`${other} other`] : [])].join(" · ")}
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: 12 }}>Why suggested, evidence and local checks</summary>
                <div style={{ display: "grid", gap: 6, marginTop: 6, fontSize: 12 }}>
                  <p style={{ margin: 0 }}>{ev.why_suggested}</p>
                  {(ev.evidence_items ?? []).filter((x) => !HIDDEN_EVIDENCE.test(`${x.label} ${x.unit}`)).length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {(ev.evidence_items ?? []).filter((x) => !HIDDEN_EVIDENCE.test(`${x.label} ${x.unit}`)).map((x) => <li key={x.label}>{x.label}: {typeof x.value === "number" ? fmt(x.value, x.unit) : `${x.value} ${x.unit}`}</li>)}
                    </ul>
                  )}
                  {ev.information_gaps.length > 0 && <p style={{ margin: 0, color: color.inkSecondary }}><b style={{ fontWeight: 500 }}>Information gaps:</b> {ev.information_gaps.filter((x) => !HIDDEN_EVIDENCE.test(x)).join(" ")}</p>}
                  {ev.risks_for_local_review.length > 0 && <p style={{ margin: 0, color: color.inkSecondary }}><b style={{ fontWeight: 500 }}>Check locally:</b> {ev.risks_for_local_review.filter((x) => !HIDDEN_EVIDENCE.test(x)).join(" ")}</p>}
                  {s.review_flags.slice(0, 4).map((fl) => <span key={fl.id}><b style={{ fontWeight: 500 }}>{fl.severity}</b> · {fl.text}</span>)}
                </div>
              </details>
              <AskCopilot kind="strategy" id={s.id} strategyId={s.id} fieldId={fieldId} question={`Why is "${label}" suggested, and what should I check locally?`} />
            </article>
          );
        })}
      </div>
      <p className="ff-p" style={{ margin: 0 }}>{forecast.support_sentence}</p>
    </div>
  );
}
