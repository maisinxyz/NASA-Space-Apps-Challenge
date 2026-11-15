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

// Container-relative tiers (container "fw" = the resizable window body). Compact < 480px, spacious >= 900px.
const TAB_CSS = `
.ff-mo-tabs{max-width:calc(100% - 80px)}
.ff-mo-tabs .fv-seg{white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
@container fw (max-width: 479px) {
  .ff-mo-tabs.ff-seg .fv-seg{min-height:40px;height:auto;padding:0 8px;font-size:11.5px}
}
`;

/** Tab switch between the 10-year clock and the 12-month outlook. */
export function HorizonTabs({ bottom }: { bottom: number }) {
  const horizon = useFutureStore((s) => s.horizon);
  const setHorizon = useFutureStore((s) => s.setHorizon);
  const farmId = useAppStore((s) => s.farmId);
  if (!siteForFarm(farmId)) return null;
  return (
    <>
      <style>{TAB_CSS}</style>
      <div role="tablist" aria-label="Timeline" className="ff-seg fv-auto ff-mo-tabs" style={{ position: "absolute", left: 40, bottom, pointerEvents: "auto" }} data-testid="horizon-tabs">
        <FvButton role="tab" className="fv-seg" title="10 years" aria-selected={horizon === "years"} data-testid="tab-years" onClick={() => setHorizon("years")}>10 years</FvButton>
        <FvButton role="tab" className="fv-seg" title="Next 12 months" aria-selected={horizon === "months"} data-testid="tab-months" onClick={() => setHorizon("months")}>Next 12 months</FvButton>
      </div>
    </>
  );
}

const CAPTION = "Rain bars show the likely range (p10–p90); it widens further out.";
// Card CSS. Base rules = regular tier (480–899px); overrides below by container width.
const MO_CSS = `
.ff-mo-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;min-width:0}
.ff-mo-title{font-size:13px;white-space:nowrap}
.ff-mo-chip{white-space:nowrap}
.ff-mo-caption{flex:1 1 180px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ff-mo-grid{gap:4px}
.ff-mo-lbl{font-size:10px;color:${color.inkSecondary};white-space:nowrap;overflow:hidden;text-align:center}
.ff-mo-one{display:none}
.ff-mo-stats{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;margin-top:20px;min-width:0}
.ff-mo-sel{font-weight:500;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ff-mo-stat{min-width:0;overflow-wrap:anywhere}
.ff-mo-k{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
.ff-mo-num{font-variant-numeric:tabular-nums}
.ff-mo-range{color:${color.inkSecondary}}
@container fw (max-width: 479px) {
  section.ff-mo-card{height:auto !important;padding:10px 12px 12px}
  .ff-mo-caption{flex-basis:100%}
  .ff-mo-grid{gap:2px}
  .ff-mo-full{display:none}
  .ff-mo-one{display:inline}
  .ff-mo-stats{gap:6px 12px;margin-top:18px}
  .ff-mo-sel{flex-basis:100%}
  .ff-mo-stat{flex:0 0 calc(50% - 6px)}
}
@container fw (min-width: 900px) {
  section.ff-mo-card{padding:16px 18px 18px;gap:12px}
  .ff-mo-title{font-size:clamp(13px,1.1cqi,16px)}
  .ff-mo-head{gap:14px}
  .ff-mo-caption{font-size:clamp(12px,1cqi,14px)}
  .ff-mo-grid{gap:6px}
  .ff-mo-lbl{font-size:clamp(10px,0.85cqi,12px)}
  .ff-mo-stats{gap:8px 24px;font-size:clamp(12px,1cqi,14px);margin-top:22px}
}
`;

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
  const selText = sel ? `${monthLabel(sel.month)} · ${kindLabel(sel.kind)}` : "";
  return (
    <section data-testid="monthly-outlook" aria-label="Next 12 months" className="fv-glass fv-auto ff-card ff-mo-card" style={{ left: 40, right, bottom: 30, height: 190, pointerEvents: "auto" }}>
      <style>{MO_CSS}</style>
      {!o && !err && <p className="ff-p" role="status">Loading the monthly outlook…</p>}
      {err && <p className="ff-p" role="alert">{err}</p>}
      {o && sel && (
        <>
          <div className="ff-mo-head">
            <strong className="ff-mo-title">Next 12 months</strong>
            <span className="ff-synth ff-mo-chip" data-testid="outlook-kind">{kindLabel(o.kind)}</span>
            {o.data_mode === "mock" && <span className="ff-synth ff-mo-chip">mock</span>}
            <span className="ff-p ff-mo-caption" title={CAPTION}>{CAPTION}</span>
          </div>
          <div role="listbox" aria-label="Months" style={{ display: "grid", gridTemplateColumns: `repeat(${o.months.length}, 1fr)`, alignItems: "end", height: 74 }} className="ff-mo-grid">
            {o.months.map((m, i) => {
              const h = (v: number) => `${Math.max(2, (v / max) * 64)}px`;
              return (
                <button key={m.month} type="button" role="option" aria-selected={i === monthIndex} data-testid="outlook-month" onClick={() => setMonthIndex(i)}
                  title={`${monthLabel(m.month)}: rain ${fmt(m.rain_mm.value, m.rain_mm.unit)}`}
                  style={{ position: "relative", height: 74, background: "transparent", border: 0, padding: 0, cursor: "pointer", borderBottom: i === monthIndex ? `2px solid ${color.accent}` : "2px solid transparent" }}>
                  <span aria-hidden style={{ position: "absolute", left: "30%", right: "30%", bottom: m.rain_mm.p10 !== undefined ? `${(m.rain_mm.p10 / max) * 64}px` : 0, height: m.rain_mm.p10 !== undefined && m.rain_mm.p90 !== undefined ? h(m.rain_mm.p90 - m.rain_mm.p10) : 0, background: "rgba(141,182,217,.35)", borderRadius: 2 }} />
                  <span aria-hidden style={{ position: "absolute", left: "40%", right: "40%", bottom: 0, height: h(m.rain_mm.value), background: m.kind === "seasonal_forecast" ? "#8DB6D9" : "rgba(141,182,217,.8)", borderRadius: 1 }} />
                  <span aria-hidden className="ff-mo-lbl" style={{ position: "absolute", bottom: -16, left: 0, right: 0 }}>
                    <span className="ff-mo-full">{monthLabel(m.month).split(" ")[0]}</span>
                    <span className="ff-mo-one">{monthLabel(m.month).charAt(0)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ff-mo-stats" data-testid="outlook-selected">
            <b className="ff-mo-sel" title={selText}>{selText}</b>
            {([["Mean temperature", sel.temperature_mean_c], ["Rain", sel.rain_mm], ["Water balance", sel.water_balance_mm], ["Frost days", sel.frost_risk], ["Heat days", sel.heat_risk]] as const).map(([k, n]) => (
              <span className="ff-mo-stat" key={k}><span className="ff-mo-k" title={k}>{k}</span> <span className="ff-mo-num">{fmt(n.value, n.unit === "degC" ? "°C" : n.unit)}</span>{rng(n) ? <span className="ff-mo-range"> ({rng(n)})</span> : null}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
