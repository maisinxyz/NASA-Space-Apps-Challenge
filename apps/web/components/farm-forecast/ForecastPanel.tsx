"use client";
// Future mode, left panel: the engine's Year 1-10 forecast for this farm (GET/POST /sites/{id}/forecast).
// Reads only through lib/forecast. Every number shows its unit and basis label; the support sentence and the
// source (live / pre-built / mock) are always visible. The chart's year marker follows the farm view clock and
// clicking the chart moves the clock.
import { useEffect, useMemo, useState } from "react";

import { FvButton } from "@/components/farm-view/FvButton";
import { tOf } from "@/lib/farm-future/model";
import { useFutureStore } from "@/lib/farm-future/store";
import { color } from "@/lib/farm-view/tokens";
import { fmt, METRICS, seriesOf, strategiesOf, valueAt, yearOfClock, type MetricKey } from "@/lib/forecast/select";
import type { Forecast } from "@/lib/api/types";
import { siteForFarm } from "@/lib/forecast/sites";
import { useForecastStore, type ForecastSource } from "@/lib/forecast/store";
import { useAppStore } from "@/lib/store";

import { Basis, CardHead, HAIR, Label, MUTED_RED, PopCard, Row } from "../farm-future/ui";

const SWATCH = ["#C9BFAE", "#E2B866", "#9CC28A", "#8DB6D9"];
const SOURCE_LABEL: Record<ForecastSource, string> = {
  live: "Live engine run",
  prebuilt: "Pre-built engine run",
  mock: "Mock fixture (placeholder numbers)",
};

/** Loads the forecast when Future mode opens on a farm that has an engine site; refetches (live only) when the what-if sliders move. */
export function useFarmForecast() {
  const farmId = useAppStore((s) => s.farmId);
  const mode = useFutureStore((s) => s.mode);
  const whatIf = useFutureStore((s) => s.whatIf);
  const siteId = siteForFarm(farmId);
  const { rainPct, tempC } = whatIf;
  useEffect(() => {
    if (!siteId || mode === "now") return;
    const timer = setTimeout(() => void useForecastStore.getState().load(siteId, { rainPct, tempC }), 350); // debounce slider drags
    return () => clearTimeout(timer);
  }, [siteId, mode, rainPct, tempC]);
  return siteId;
}

/** Connected panel: reads the stores, renders ForecastCard. Nothing for farms with no engine site. */
export function ForecastPanel() {
  const siteId = useFarmForecast();
  const panel = useFutureStore((s) => s.panel);
  const t = useFutureStore((s) => s.t);
  const { status, forecast, source, error } = useForecastStore();
  if (!siteId) return null;
  return (
    <ForecastCard
      open={panel === "forecast"}
      status={status}
      forecast={forecast}
      source={source}
      error={error}
      year={forecast ? yearOfClock(t, forecast.horizon_years) : 1}
      onClose={() => useFutureStore.getState().openPanel(null)}
      onPickYear={(y) => useFutureStore.getState().setT(tOf(y - 1, 194))}
    />
  );
}

export type ForecastCardProps = {
  open: boolean;
  status: "idle" | "loading" | "ready" | "error";
  forecast: Forecast | null;
  source: ForecastSource | null;
  error: string | null;
  /** Forecast year (1..horizon) the farm view clock is on. */
  year: number;
  onClose(): void;
  onPickYear(y: number): void;
};

export function ForecastCard({ open, status, forecast, source, error, year, onClose, onPickYear }: ForecastCardProps) {
  const [metric, setMetric] = useState<MetricKey>("soil_organic_index");
  const [strategy, setStrategy] = useState(0);
  const [fieldId, setFieldId] = useState<string | null>(null);

  const strategies = useMemo(() => (forecast ? strategiesOf(forecast) : []), [forecast]);
  const shown = strategies[Math.min(strategy, strategies.length - 1)];
  const meta = METRICS.find((m) => m.key === metric)!;
  const lines = forecast ? strategies.map((s) => ({ s, series: seriesOf(forecast, s.id, metric, fieldId) })) : [];
  const flagField = forecast?.fields.find((f) => f.field_id === (fieldId ?? forecast.fields[0]?.field_id));
  const flags = forecast && shown ? (flagField?.strategies.find((s) => s.id === shown.id)?.review_flags ?? []) : [];
  const scorecard = forecast && shown ? (forecast.farm_rollup.strategies.find((s) => s.id === shown.id)?.scorecard ?? []) : [];

  return (
    <PopCard open={open} origin="top left" label="Engine forecast" testId="forecast-panel" style={{ left: 40, top: 236, width: 440, maxHeight: "calc(100vh - 236px - 210px)", overflowY: "auto" }}>
      <CardHead title="Engine forecast · years 1–10" onMinimize={onClose} />
      {source && (
        <span className="ff-synth" data-testid="forecast-source" style={{ alignSelf: "flex-start" }}>
          {SOURCE_LABEL[source]}
          {forecast?.data_mode === "limited_data" ? " · limited data" : ""}
        </span>
      )}
      {status === "loading" && !forecast && <p className="ff-p" role="status">Running the forecast…</p>}
      {status === "error" && <p className="ff-p" role="alert" style={{ color: MUTED_RED }}>{error ?? "The forecast could not be loaded."}</p>}
      {forecast && shown && (
        <>
          <div role="tablist" aria-label="Strategy" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {strategies.map((s, i) => (
              <FvButton key={s.id} role="tab" aria-selected={i === strategy} className="fv-pill fv-auto" data-testid={`fc-strategy-${s.id}`} onClick={() => setStrategy(i)} style={{ opacity: i === strategy ? 1 : 0.7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: SWATCH[i % SWATCH.length], display: "inline-block", marginRight: 6 }} aria-hidden />
                <span className="l" style={{ color: color.ink }}>{s.role === "existing" ? "Existing" : s.label}</span>
              </FvButton>
            ))}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: color.inkSecondary }}>
            Area
            <select value={fieldId ?? ""} onChange={(e) => setFieldId(e.target.value || null)} data-testid="fc-field" style={{ background: "transparent", color: color.ink, border: `1px solid ${HAIR}`, borderRadius: 6, padding: "2px 6px", fontSize: 12 }}>
              <option value="">Whole farm (area-weighted)</option>
              {forecast.fields.map((f) => <option key={f.field_id} value={f.field_id}>{f.name} · {f.area_ha.toFixed(2)} ha</option>)}
            </select>
          </label>
          <div role="radiogroup" aria-label="Metric" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {METRICS.map((m) => (
              <FvButton key={m.key} role="radio" aria-checked={m.key === metric} data-testid={`fc-metric-${m.key}`} className="fv-pill fv-auto" onClick={() => setMetric(m.key)} style={{ height: 24, padding: "0 8px", opacity: m.key === metric ? 1 : 0.65 }}>
                <span className="l" style={{ fontSize: 11.5, color: color.ink }}>{m.label}</span>
              </FvButton>
            ))}
          </div>
          <Chart lines={lines} year={year} horizon={forecast.horizon_years} activeId={shown.id} label={`${meta.label} by year`} onPick={onPickYear} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <Label>Year {year} · {meta.label}</Label>
            {lines[0]?.series && <Basis b={lines[0].series.basis} />}
          </div>
          {lines.map(({ s, series }, i) => {
            if (!series) return null;
            const v = valueAt(series, year);
            const ranged = v.p10 !== null && v.p90 !== null && v.p10 !== v.p90;
            return (
              <Row
                key={s.id}
                strong={s.id === shown.id}
                k={<><span style={{ width: 8, height: 8, borderRadius: 4, background: SWATCH[i % SWATCH.length], display: "inline-block", marginRight: 6 }} aria-hidden />{s.role === "existing" ? "Existing" : s.label}</>}
                v={<>{fmt(v.p50, series.unit.split(",")[0])}{ranged ? <span style={{ color: color.inkSecondary }}> ({fmt(v.p10!)}–{fmt(v.p90!)})</span> : null}</>}
              />
            );
          })}
          {meta.higherIsBetter !== null && <span className="ff-p">{meta.higherIsBetter ? "Higher is better." : "Lower is better."} Index series start at 100 in year 0. p10–p90 in brackets.</span>}
          <hr className="ff-hr" />
          <Label>Scorecard · {shown.label} · relative across these strategies</Label>
          {scorecard.map((c) => <Row key={c.criterion} k={c.criterion.replace(/_/g, " ")} v={<>{Math.round(c.score)} <Basis b={c.basis} /></>} />)}
          {flags.length > 0 && (
            <>
              <hr className="ff-hr" />
              <Label>Review flags ({flags.length})</Label>
              {flags.slice(0, 5).map((f) => <span key={f.id} className="ff-p" data-testid="fc-flag"><b style={{ color: color.ink, fontWeight: 500 }}>{f.severity}</b> · {f.text}</span>)}
              {flags.length > 5 && <span className="ff-p">+{flags.length - 5} more in the response.</span>}
            </>
          )}
          <hr className="ff-hr" />
          <span className="ff-p">{forecast.disclaimer}</span>
          <span className="ff-p" data-testid="fc-support">{forecast.support_sentence}</span>
          <details>
            <summary className="ff-p" style={{ cursor: "pointer" }}>Assumptions and sources</summary>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
              {forecast.assumptions.map((a, i) => <li key={i} className="ff-p">{a}</li>)}
              {forecast.sources.map((s) => <li key={s.name} className="ff-p">{s.name}. {s.license}. {s.attribution}</li>)}
            </ul>
          </details>
        </>
      )}
    </PopCard>
  );
}

type Line = { s: { id: string }; series: { points: { year: number; p50: number; p10?: number | null; p90?: number | null }[] } | null };

function Chart({ lines, year, horizon, activeId, label, onPick }: { lines: Line[]; year: number; horizon: number; activeId: string; label: string; onPick(y: number): void }) {
  const w = 410, h = 140, padL = 6, padR = 6, padT = 8, padB = 18;
  const all = lines.flatMap((l) => l.series?.points.flatMap((p) => [p.p50, p.p10 ?? p.p50, p.p90 ?? p.p50]) ?? []);
  if (all.length === 0) return null;
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const x = (y: number) => padL + (y / horizon) * (w - padL - padR);
  const yy = (v: number) => padT + (1 - (v - lo) / span) * (h - padT - padB);
  const active = lines.find((l) => l.s.id === activeId)?.series;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      style={{ display: "block", cursor: "pointer" }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * w;
        onPick(Math.min(horizon, Math.max(1, Math.round(((px - padL) / (w - padL - padR)) * horizon))));
      }}
    >
      {active && (
        <polygon
          fill="rgba(242,235,221,0.12)"
          points={[...active.points.map((p) => `${x(p.year)},${yy(p.p90 ?? p.p50)}`), ...[...active.points].reverse().map((p) => `${x(p.year)},${yy(p.p10 ?? p.p50)}`)].join(" ")}
        />
      )}
      <line x1={padL} x2={w - padR} y1={h - padB} y2={h - padB} stroke={HAIR} />
      {lines.map((l, i) => l.series && (
        <polyline
          key={l.s.id}
          fill="none"
          stroke={SWATCH[i % SWATCH.length]}
          strokeWidth={l.s.id === activeId ? 2.2 : 1.3}
          strokeLinejoin="round"
          opacity={l.s.id === activeId ? 1 : 0.75}
          points={l.series.points.map((p) => `${x(p.year)},${yy(p.p50)}`).join(" ")}
        />
      ))}
      <line x1={x(year)} x2={x(year)} y1={padT} y2={h - padB} stroke={color.ink} strokeDasharray="2 3" />
      {[0, 5, 10].filter((v) => v <= horizon).map((v) => (
        <text key={v} x={x(v)} y={h - 4} fontSize={10} textAnchor="middle" fill={color.inkSecondary}>{v === 0 ? "now" : `yr ${v}`}</text>
      ))}
    </svg>
  );
}
