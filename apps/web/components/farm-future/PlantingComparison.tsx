"use client";

import { useEffect, useState } from "react";

import { apiMode, ApiError, getCropCatalog, getForecast } from "@/lib/api/client";
import type { CropCatalog, Forecast } from "@/lib/api/types";
import { cropName } from "@/lib/farm-future/data";
import { firstYearSlots, plantingPair, plantingRequest } from "@/lib/forecast/planting";
import type { PlantingWeather } from "@/lib/forecast/planting";
import { baseRequest } from "@/lib/forecast/sites";

const WEATHER = {
  baseline: "Historical weather",
  drier_summers: "Drier summers",
} as const;
const METRICS = [
  { key: "soil_organic_index", label: "Soil organic matter index", unit: "index points" },
  { key: "irrigation_need_mm", label: "Irrigation need", unit: "mm/year" },
] as const;
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const signed = new Intl.NumberFormat("en", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
type Run = ReturnType<typeof plantingPair> & { forecast: Forecast };

export function PlantingComparison({ forecast }: { forecast: Forecast }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="planting-comparison" onToggle={(event) => {
      if (event.currentTarget.open) setExpanded(true);
    }}>
      <summary>What if I plant a different crop this year?</summary>
      {expanded && (apiMode === "live" ? (
        <PlantingForm key={forecast.site_id} forecast={forecast} />
      ) : <p>Live forecast access is needed to compare a new planting. Showing a saved forecast.</p>)}
    </details>
  );
}

function PlantingForm({ forecast }: { forecast: Forecast }) {
  const [fieldId, setFieldId] = useState(forecast.fields[0]?.field_id ?? "");
  const [season, setSeason] = useState("");
  const [crop, setCrop] = useState("");
  const [weather, setWeather] = useState<PlantingWeather>("baseline");
  const [catalog, setCatalog] = useState<CropCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [results, setResults] = useState<Record<PlantingWeather, Run> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = forecast.fields.find((item) => item.field_id === fieldId);
  const current = field?.strategies.find((strategy) => strategy.role === "existing");
  const slots = firstYearSlots(current?.plan ?? []);
  const slot = slots.find((item) => item.season === season) ?? slots[0];
  const planted = new Set(current?.plan.filter((item) => item.year_index === 1).map((item) => item.crop_id));
  const options = (catalog?.crops ?? []).filter((item) =>
    item.season_window?.plant_doy != null && item.season_window.terminate_doy != null && !planted.has(item.id),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const base = baseRequest(forecast.site_id);
  const input = base?.fields?.find((item) => item.field_id === fieldId);
  const cropLabel = (id: string) => id === "fallow" ? "Fallow" : catalog?.crops.find((item) => item.id === id)?.name ?? cropName(id);

  useEffect(() => {
    let active = true;
    getCropCatalog({ siteId: forecast.site_id }).then(
      (data) => { if (active) setCatalog(data); },
      () => { if (active) setCatalogError(true); },
    );
    return () => { active = false; };
  }, [forecast.site_id, catalogAttempt]);

  function clearResults() {
    setResults(null);
    setError(null);
  }

  async function compare() {
    if (!base || !input || !slot || !crop || busy) return;
    clearResults();
    setBusy(true);
    try {
      const run = async (scenario: PlantingWeather): Promise<Run> => {
        const response = await getForecast(forecast.site_id, plantingRequest(base, input, slot, crop, scenario));
        return { ...plantingPair(response, fieldId, slot, crop), forecast: response };
      };
      const [baseline, drier_summers] = await Promise.all([run("baseline"), run("drier_summers")]);
      setResults({ baseline, drier_summers });
    } catch (failure) {
      setError(failure instanceof ApiError && failure.hint
        ? `${failure.message} ${failure.hint}`
        : failure instanceof Error ? failure.message : "The comparison could not run. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="planting-body">
      <p>Change one planting in year 1. The rest of the rotation and starting soil stay the same.</p>
      <form onSubmit={(event) => { event.preventDefault(); void compare(); }}>
        <fieldset disabled={busy} className="planting-controls">
          <label>Field<select value={fieldId} onChange={(event) => {
            setFieldId(event.target.value); setSeason(""); setCrop(""); clearResults();
          }}>{forecast.fields.map((item) => <option key={item.field_id} value={item.field_id}>{item.name}</option>)}</select></label>
          <label>Planting to replace<select value={slot?.season ?? ""} disabled={!slots.length} onChange={(event) => {
            setSeason(event.target.value); setCrop(""); clearResults();
          }}>
            {!slots.length && <option value="">No eligible planting</option>}
            {slots.map((item) => <option key={item.season} value={item.season}>
              {item.season[0].toUpperCase() + item.season.slice(1)} · {cropLabel(item.crop_id)}
            </option>)}
          </select></label>
          <label>Replacement crop<select value={crop} disabled={!catalog || !slot} onChange={(event) => {
            setCrop(event.target.value); clearResults();
          }}>
            <option value="">{catalog ? "Choose a crop" : "Crop list unavailable"}</option>
            {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            {slot?.crop_id !== "fallow" && <option value="fallow">Leave fallow</option>}
          </select></label>
          <button type="submit" disabled={!crop || !input || !slot || !catalog}>Compare planting</button>
        </fieldset>
      </form>
      {catalogError && <p role="alert">The crop list could not load. <button type="button" onClick={() => {
        setCatalogError(false); setCatalogAttempt((attempt) => attempt + 1);
      }}>Retry</button></p>}
      {!catalog && !catalogError && <p role="status">Loading crops…</p>}
      {busy && <p role="status">Comparing both weather scenarios…</p>}
      {error && <p role="alert">{error}</p>}
      {results && slot && (
        <>
          <div className="planting-weather" aria-label="Weather scenario" role="group">
            {Object.entries(WEATHER).map(([key, label]) => (
              <button type="button" key={key} aria-pressed={key === weather} onClick={() => setWeather(key as PlantingWeather)}>{label}</button>
            ))}
          </div>
          <PlantingResults run={results[weather]} weather={weather} before={cropLabel(slot.crop_id)} after={cropLabel(crop)} />
        </>
      )}
    </div>
  );
}

function PlantingResults({ run, weather, before, after }: { run: Run; weather: PlantingWeather; before: string; after: string }) {
  const years = [...new Set([1, 3, 5, run.forecast.horizon_years])];
  return (
    <div className="planting-results" aria-live="polite">
      <p><strong>{before} → {after}</strong> in year 1 · {WEATHER[weather]}</p>
      {METRICS.map(({ key, label, unit }) => {
        const baseline = run.baseline.trajectories[key];
        const changed = run.changed.trajectories[key];
        return (
          <table key={key}>
            <caption>{label} <span>({unit})</span></caption>
            <thead><tr><th scope="col">Year</th><th scope="col">Keep plan</th><th scope="col">Change crop</th><th scope="col">Difference</th></tr></thead>
            <tbody>{years.map((year) => {
              const a = baseline?.points.find((item) => item.year === year);
              const b = changed?.points.find((item) => item.year === year);
              if (!a || !b) return null;
              return <tr key={year}>
                <th scope="row">{year}</th>
                {[a, b].map((item, i) => <td key={i}>{number.format(item.p50)}
                  {item.p10 != null && item.p90 != null && <small>{number.format(item.p10)}–{number.format(item.p90)}</small>}
                </td>)}
                <td>{signed.format(b.p50 - a.p50)}</td>
              </tr>;
            })}</tbody>
          </table>
        );
      })}
      <p>Values show the median and the 10th–90th percentile range across sampled weather. The soil index starts at 100. Crop plans are illustrative. Check crop dates, soil tests and water access locally.</p>
      <details>
        <summary>Weather data and assumptions</summary>
        <p>{run.forecast.scenario.note}</p>
        <ul>{run.forecast.sources.map((source) => <li key={source.name}>{source.name}</li>)}</ul>
      </details>
    </div>
  );
}
