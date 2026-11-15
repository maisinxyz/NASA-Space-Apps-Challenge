"use client";
// Future mode, per strategy: Strategy picker + review flags under the mode switch, and the "Soil health" panel on
// the left (collapsible to the side). Minimal charts: depth profile line chart, thin bars, plain rows.
import { useRef, useState } from "react";

import { engineSeries, forecastYear, pointAt, strategyOf } from "@/lib/farm-future/data";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { useCopilot } from "@/lib/copilot/copilot";
import { fmt } from "@/lib/forecast/select";
import type { Forecast, YearSeries } from "@/lib/api/types";
import { useFutureStore } from "@/lib/farm-future/store";
import { color } from "@/lib/farm-view/tokens";
import { siteForFarm } from "@/lib/forecast/sites";
import { useAppStore } from "@/lib/store";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { ChevronLeft, ChevronRight } from "@/components/farm-view/icons";
import { Basis, CardHead, Label, MUTED_RED, NoData, PopCard, Row, useDismiss } from "./ui";

export function StrategyBar() {
  const strategyId = useFutureStore((s) => s.strategyId);
  const farmId = useAppStore((s) => s.farmId);
  const panel = useFutureStore((s) => s.panel);
  const { setStrategy, openPanel, openReview } = useFutureStore.getState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const { data } = useFutureData();
  const s = strategyOf(data, strategyId);
  const flags = data.flags[strategyId].length;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
      <div ref={ref} style={{ position: "relative" }}>
        <FvButton className="fv-glass fv-pill fv-auto" aria-haspopup="listbox" aria-expanded={open} data-testid="strategy-picker" onClick={() => setOpen(!open)}>
          <span className="l">Strategy</span>
          <span className="v" style={{ marginLeft: 0, fontWeight: 500 }}>{s.rotation}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
        </FvButton>
        {open && (
          <div role="listbox" aria-label="Strategy" className="fv-glass ff-menu fv-auto" style={{ left: 0, right: "auto", width: 260 }}>
            {data.strategies.map((x) => (
              <FvButton key={x.id} role="option" aria-selected={x.id === strategyId} aria-checked={x.id === strategyId} className="ff-menu-item" onClick={() => { setStrategy(x.id); setOpen(false); sound.tickWeek(); }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: x.swatch }} aria-hidden />
                <span style={{ flex: 1 }}>{x.rotation}</span>
                <span style={{ color: color.inkSecondary, fontSize: 11.5 }}>{x.role === "existing" ? "now" : x.name.replace("Strategy ", "")}</span>
              </FvButton>
            ))}
          </div>
        )}
      </div>
      {data.source === "engine" && (
        <FvButton className="fv-glass fv-pill fv-auto" data-testid="ask-copilot-strategy-bar" onClick={() => useCopilot.getState().ask({ question: `Why is "${s.name}" (${s.rotation}) suggested for this farm, and what should I check locally?`, kind: "strategy", id: s.engineId, strategyId: s.engineId })}>
          <span className="l" style={{ color: color.ink }}>Ask Gus</span>
        </FvButton>
      )}
      <FvButton className="fv-glass fv-pill fv-auto" data-testid="flags-button" aria-label={`${flags} review flags for ${s.name}`} onClick={() => openReview(strategyId)}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color.stress} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
        <span className="l" style={{ color: color.ink }}>{flags} {flags === 1 ? "flag" : "flags"}</span>
      </FvButton>
      {siteForFarm(farmId) && (
        <FvButton className="fv-glass fv-pill fv-auto" aria-expanded={panel === "forecast"} data-testid="forecast-toggle" onClick={() => openPanel("forecast")}>
          <span className="l" style={{ color: color.ink }}>Forecast</span>
          {panel === "forecast" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </FvButton>
      )}
      <FvButton className="fv-glass fv-pill fv-auto" aria-expanded={panel === "soil"} data-testid="soil-toggle" onClick={() => openPanel("soil")}>
        <span className="l" style={{ color: color.ink }}>Soil health</span>
        {panel === "soil" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </FvButton>
    </div>
  );
}

export function SoilHealthPanel() {
  const { forecast } = useFutureData();
  return forecast ? <EngineSoilPanel forecast={forecast} /> : <SyntheticSoilPanel />;
}

/** Engine-fed soil, nitrogen, water and pest panel for the strategy and the clock year. Farm rollup, or the focused field. */
export function EngineSoilPanel({ forecast }: { forecast: Forecast }) {
  const panel = useFutureStore((s) => s.panel);
  const t = useFutureStore((s) => s.t);
  const strategyId = useFutureStore((s) => s.strategyId);
  const fieldId = useFutureStore((s) => s.focusFieldId);
  const openPanel = useFutureStore((s) => s.openPanel);
  const { data } = useFutureData();
  const s = strategyOf(data, strategyId);
  const year = forecastYear(t, forecast.horizon_years);
  const field = fieldId ? forecast.fields.find((f) => f.field_id === fieldId) : undefined;
  const area = field ? field.name : "Whole farm";
  const get = (metric: string) => engineSeries(forecast, s.engineId, metric, field?.field_id);
  const rollup = forecast.farm_rollup.strategies.find((x) => x.id === s.engineId);
  const quota = (field ? field.strategies.find((x) => x.id === s.engineId) : rollup)?.farm_fit.water_vs_quota;
  const pest = get("pest_pressure_index");
  return (
    <PopCard open={panel === "soil"} origin="top left" label="Soil health" testId="soil-panel" style={{ left: 40, top: 236, width: 412, maxHeight: "calc(100vh - 236px - 210px)", overflowY: "auto" }}>
      <CardHead title={`Soil and water · ${s.name}, year ${year}`} onMinimize={() => openPanel(null)} />
      <span className="ff-p" data-testid="soil-engine">{area} · engine forecast · p10–p90 in brackets</span>
      <SeriesRow label="Soil organic matter" series={get("soil_organic_index")} year={year} note="index, year 0 = 100" />
      <SeriesRow label="Water infiltration" series={get("infiltration_index")} year={year} note="index, year 0 = 100" />
      <SeriesRow label="Runoff" series={get("runoff_index")} year={year} note="index, year 0 = 100" />
      <hr className="ff-hr" />
      <Label>Nitrogen</Label>
      <SeriesRow label="Nitrogen balance" series={get("n_balance_kg_ha")} year={year} />
      <SeriesRow label="Share fixed by legumes" series={get("n_fixed_share")} year={year} />
      <hr className="ff-hr" />
      <Label>Water</Label>
      <SeriesRow label="Crop water demand" series={get("water_demand_mm")} year={year} />
      <SeriesRow label="Irrigation need" series={get("irrigation_need_mm")} year={year} />
      {quota && (
        <Row
          k="Irrigation need vs quota"
          v={<>{fmt(quota.irrigation_need_p50.value, quota.irrigation_need_p50.unit)}{quota.quota_mm_per_season != null ? ` of ${fmt(quota.quota_mm_per_season, "mm/season")}` : " · no quota set"} <Basis b={quota.irrigation_need_p50.basis} /></>}
        />
      )}
      <SeriesRow label="Bare-soil weeks" series={get("bare_weeks")} year={year} />
      {pest && (
        <>
          <hr className="ff-hr" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>Pest pressure by year · rotation breaks reset it</Label>
            <Basis b={pest.basis} />
          </div>
          <div role="img" aria-label={`Pest pressure per year, ${pest.unit}`} style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 36 }}>
            {pest.points.filter((p) => p.year >= 1).map((p) => (
              <div key={p.year} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: 36 }}>
                <div title={`Year ${p.year}: ${fmt(p.p50, pest.unit)}`} style={{ width: 4, height: Math.max(2, Math.min(100, p.p50) * 0.36), borderRadius: 1, background: p.p50 > 50 ? MUTED_RED : p.year === year ? color.ink : "rgba(242,235,221,0.45)" }} />
              </div>
            ))}
          </div>
          <span className="ff-p">{pest.unit} · year 1 to {forecast.horizon_years}</span>
        </>
      )}
      <span className="ff-p">{forecast.support_sentence}</span>
    </PopCard>
  );
}

function SeriesRow({ label, series, year, note }: { label: string; series: YearSeries | null; year: number; note?: string }) {
  if (!series) return null;
  const v = pointAt(series, year);
  const ranged = v.p10 !== null && v.p90 !== null && v.p10 !== v.p90;
  return (
    <Row
      k={<>{label}{note ? <span style={{ color: color.inkSecondary }}> · {note}</span> : null}</>}
      v={<>{fmt(v.p50, note ? undefined : v.unit)}{ranged ? <span style={{ color: color.inkSecondary }}> ({fmt(v.p10!)}–{fmt(v.p90!)})</span> : null} <Basis b={v.basis as never} /></>}
    />
  );
}

function SyntheticSoilPanel() {
  const panel = useFutureStore((s) => s.panel);
  const strategyId = useFutureStore((s) => s.strategyId);
  const openPanel = useFutureStore((s) => s.openPanel);
  const { data } = useFutureData();
  return (
    <PopCard open={panel === "soil"} origin="top left" label="Soil health" testId="soil-panel" style={{ left: 40, top: 236, width: 412, maxHeight: "calc(100vh - 236px - 210px)", overflowY: "auto" }}>
      <CardHead title={`Soil health · ${strategyOf(data, strategyId).name}`} onMinimize={() => openPanel(null)} />
      <NoData />
    </PopCard>
  );
}
