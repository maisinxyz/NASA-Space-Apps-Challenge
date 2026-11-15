"use client";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { forecastYear, strategyOf } from "@/lib/farm-future/data";
import { seriesOf, fmt, type MetricKey } from "@/lib/forecast/select";
import { useForecastStore } from "@/lib/forecast/store";
import { SOURCE_LABEL } from "@/components/farm-forecast/ForecastPanel";
import { useAppStore } from "@/lib/store";
import { siteForFarm } from "@/lib/forecast/sites";
import { FvButton } from "./FvButton";

const SUMMARY: { key: MetricKey; label: string }[] = [
  { key: "soil_organic_index", label: "Soil organic matter index" },
  { key: "irrigation_need_mm", label: "Irrigation need" },
  { key: "bare_weeks", label: "Bare soil" },
];

export function FarmOverview() {
  const farmId = useAppStore((s) => s.farmId);
  const { forecast, data } = useFutureData();
  const { status, source } = useForecastStore();
  const { t, strategyId } = useFutureStore();
  if (!siteForFarm(farmId)) return null;
  const strategy = strategyOf(data, strategyId);
  const year = forecast ? forecastYear(t, forecast.horizon_years) : 1;
  return <section className="fv-overview" data-testid="farm-overview" aria-label="Farm forecast summary">
    <h2>Farm outlook</h2>
    <p>{forecast ? `${strategy.name} · year ${year}` : status === "error" ? "Forecast unavailable" : "Loading forecast…"}</p>
    {forecast && <dl>{SUMMARY.map(({ key, label }) => {
      const series = seriesOf(forecast, strategy.engineId, key);
      const value = series?.points.find((p) => p.year === year);
      return <div key={key}><dt>{label}</dt><dd>{value && series ? fmt(value.p50, key === "soil_organic_index" ? undefined : series.unit) : "Unavailable"}</dd></div>;
    })}</dl>}
    {forecast && <p>Soil organic matter index baseline: 100 in the starting year.<br />{source ? SOURCE_LABEL[source] : "Scenario forecast"}{status === "loading" ? " · Updating…" : status === "error" ? " · Previous result; update failed" : ""}</p>}
    <FvButton className="ff-link" data-testid="overview-details" onClick={() => {
      useFutureStore.getState().setMode("future");
      useFutureStore.getState().openPanel("forecast");
    }}>View forecast details</FvButton>
  </section>;
}
