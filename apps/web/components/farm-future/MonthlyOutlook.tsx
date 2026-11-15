"use client";
// "Next 12 months" tab (v4 PRD F5, D2): monthly outlook from GET /sites/{id}/outlook. Labelled "Typical year" while the
// source is climatology, "Seasonal forecast" per month once a real forecast is layered in (B7 step 2). Ranges widen
// with the month. The 10-year timeline is unchanged (D5); this replaces it only while the tab is chosen.
import { useEffect, useState } from "react";

import { ApiError, getOutlook } from "@/lib/api/client";
import type { ContractNumber, Outlook } from "@/lib/api/types";
import { useFutureStore } from "@/lib/farm-future/store";
import { color } from "@/lib/farm-view/tokens";
import { fmt } from "@/lib/forecast/select";
import { siteForFarm } from "@/lib/forecast/sites";
import { useAppStore } from "@/lib/store";

import { FvButton } from "@/components/farm-view/FvButton";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const KIND_LABEL: Record<string, string> = { climatology: "Typical year", seasonal_forecast: "Seasonal forecast" };
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k.replace(/_/g, " ");
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH[(m - 1) % 12] ?? ym} ${y}`;
};

/** Tab switch between the 10-year clock and the 12-month outlook. */
export function HorizonTabs({ bottom }: { bottom: number }) {
  const horizon = useFutureStore((s) => s.horizon);
  const setHorizon = useFutureStore((s) => s.setHorizon);
  const farmId = useAppStore((s) => s.farmId);
  if (!siteForFarm(farmId)) return null;
  return (
    <div role="tablist" aria-label="Timeline" className="ff-seg fv-auto" style={{ position: "absolute", left: 40, bottom, pointerEvents: "auto" }} data-testid="horizon-tabs">
      <FvButton role="tab" className="fv-seg" aria-selected={horizon === "years"} data-testid="tab-years" onClick={() => setHorizon("years")}>10 years</FvButton>
      <FvButton role="tab" className="fv-seg" aria-selected={horizon === "months"} data-testid="tab-months" onClick={() => setHorizon("months")}>Next 12 months</FvButton>
    </div>
  );
}

const rng = (n: ContractNumber) => (n.p10 !== undefined && n.p90 !== undefined && n.p10 !== n.p90 ? `${fmt(n.p10)}–${fmt(n.p90)}` : null);

export function MonthlyOutlook({ right = 40 }: { right?: number }) {
  const farmId = useAppStore((s) => s.farmId);
  const siteId = siteForFarm(farmId);
  const monthIndex = useFutureStore((s) => s.monthIndex);
  const setMonthIndex = useFutureStore((s) => s.setMonthIndex);
  const [state, setState] = useState<{ siteId: string; outlook: Outlook | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!siteId) return;
    let live = true;
    getOutlook(siteId, { months: 12 }).then(
      (outlook) => live && setState({ siteId, outlook, error: null }),
      (e) => live && setState({ siteId, outlook: null, error: e instanceof ApiError && e.status === 404 ? "No monthly outlook for this farm yet." : "The monthly outlook could not be loaded." }),
    );
    return () => {
      live = false;
    };
  }, [siteId]);
  if (!siteId) return null;
  const o = state?.siteId === siteId ? state.outlook : null;
  const err = state?.siteId === siteId ? state.error : null;
  const max = o ? Math.max(...o.months.map((m) => m.rain_mm.p90 ?? m.rain_mm.value), 1) : 1;
  const sel = o?.months[Math.min(monthIndex, o.months.length - 1)];
  return (
    <section data-testid="monthly-outlook" aria-label="Next 12 months" className="fv-glass fv-auto ff-card" style={{ left: 40, right, bottom: 30, height: 190, pointerEvents: "auto" }}>
      {!o && !err && <p className="ff-p" role="status">Loading the monthly outlook…</p>}
      {err && <p className="ff-p" role="alert">{err}</p>}
      {o && sel && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13 }}>Next 12 months</strong>
            <span className="ff-synth" data-testid="outlook-kind">{kindLabel(o.kind)}</span>
            {o.data_mode === "mock" && <span className="ff-synth">mock</span>}
            <span className="ff-p">Rain bars show the likely range (p10–p90); it widens further out.</span>
          </div>
          <div role="listbox" aria-label="Months" style={{ display: "grid", gridTemplateColumns: `repeat(${o.months.length}, 1fr)`, gap: 4, alignItems: "end", height: 74 }}>
            {o.months.map((m, i) => {
              const h = (v: number) => `${Math.max(2, (v / max) * 64)}px`;
              return (
                <button key={m.month} type="button" role="option" aria-selected={i === monthIndex} data-testid="outlook-month" onClick={() => setMonthIndex(i)}
                  title={`${monthLabel(m.month)}: rain ${fmt(m.rain_mm.value, m.rain_mm.unit)}`}
                  style={{ position: "relative", height: 74, background: "transparent", border: 0, padding: 0, cursor: "pointer", borderBottom: i === monthIndex ? `2px solid ${color.accent}` : "2px solid transparent" }}>
                  <span aria-hidden style={{ position: "absolute", left: "30%", right: "30%", bottom: m.rain_mm.p10 !== undefined ? `${(m.rain_mm.p10 / max) * 64}px` : 0, height: m.rain_mm.p10 !== undefined && m.rain_mm.p90 !== undefined ? h(m.rain_mm.p90 - m.rain_mm.p10) : 0, background: "rgba(141,182,217,.35)", borderRadius: 2 }} />
                  <span aria-hidden style={{ position: "absolute", left: "40%", right: "40%", bottom: 0, height: h(m.rain_mm.value), background: m.kind === "seasonal_forecast" ? "#8DB6D9" : "rgba(141,182,217,.8)", borderRadius: 1 }} />
                  <span style={{ position: "absolute", bottom: -16, left: 0, right: 0, fontSize: 10, color: color.inkSecondary }}>{monthLabel(m.month).split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, marginTop: 14 }} data-testid="outlook-selected">
            <b style={{ fontWeight: 500 }}>{monthLabel(sel.month)} · {kindLabel(sel.kind)}</b>
            {([["Mean temperature", sel.temperature_mean_c], ["Rain", sel.rain_mm], ["Water balance", sel.water_balance_mm], ["Frost days", sel.frost_risk], ["Heat days", sel.heat_risk]] as const).map(([k, n]) => (
              <span key={k}>{k} {fmt(n.value, n.unit === "degC" ? "°C" : n.unit)}{rng(n) ? <span style={{ color: color.inkSecondary }}> ({rng(n)})</span> : null}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
