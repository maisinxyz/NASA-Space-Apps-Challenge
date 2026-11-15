"use client";
// Future mode: each twin field coloured from its engine trajectory at the clock year (F2), and the legend.
// The overlay is a north-up canvas over the twin's simulation square, drawn by the globe like any GroundOverlay.
import { useEffect, useMemo, useRef, useState } from "react";

import type { GroundOverlay } from "@/components/globe/types";
import { forecastYear, strategyOf } from "@/lib/farm-future/data";
import { FIELD_METRICS, fieldValues, paintFields, RAMP, type FieldMetric } from "@/lib/farm-future/fieldColours";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { twinConfig } from "@/lib/farms";
import { color } from "@/lib/farm-view/tokens";
import { fmt } from "@/lib/forecast/select";
import { useAppStore } from "@/lib/store";

import { FvButton } from "@/components/farm-view/FvButton";

const SIZE = 1024;

/** Current field values (or null when there is no engine forecast for this farm). */
export function useFieldValues() {
  const { data, forecast } = useFutureData();
  const t = useFutureStore((s) => s.t);
  const strategyId = useFutureStore((s) => s.strategyId);
  const metric = useFutureStore((s) => s.fieldMetric);
  return useMemo(() => {
    if (!forecast) return null;
    const year = forecastYear(t, forecast.horizon_years);
    const s = strategyOf(data, strategyId);
    return { year, strategy: s, metric, ...fieldValues(forecast, s.engineId, metric, year) };
  }, [forecast, data, t, strategyId, metric]);
}

/** Overlays for the globe: one canvas with every field filled. Empty outside Future mode or without engine data. */
export function useFieldColourOverlays(): GroundOverlay[] {
  const farmId = useAppStore((s) => s.farmId);
  const mode = useFutureStore((s) => s.mode);
  const twin = twinConfig(farmId);
  const fv = useFieldValues();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);
  const on = mode === "future" && !!twin && !!fv && fv.values.length > 0;
  useEffect(() => {
    if (!on || !twin || !fv) return;
    if (!canvas.current) {
      canvas.current = document.createElement("canvas");
      canvas.current.width = canvas.current.height = SIZE;
    }
    const byId = new Map(fv.values.map((v) => [v.fieldId, v.colour]));
    paintFields(canvas.current, twin.simBbox, twin.fields.flatMap((f) => (byId.has(f.id) ? [{ ring: f.ring, colour: byId.get(f.id)! }] : [])));
    setVersion((v) => v + 1);
  }, [on, twin, fv]);
  return useMemo(
    () => (on && twin && canvas.current && version > 0 ? [{ id: "future-field-colours", bbox: twin.simBbox, canvas: canvas.current, version, opacity: 0.62 }] : []),
    [on, twin, version],
  );
}

/** Legend and metric switch, bottom-right above the timeline. */
export function FieldColourLegend({ embedded = false }: { embedded?: boolean }) {
  const fv = useFieldValues();
  const farmId = useAppStore((s) => s.farmId);
  const setMetric = useFutureStore((s) => s.setFieldMetric);
  if (!fv || !twinConfig(farmId)) return null;
  const spec = FIELD_METRICS[fv.metric];
  const names = new Map(twinConfig(farmId)!.fields.map((f) => [f.id, f.name]));
  return (
    <section className="fv-glass fv-auto ff-card" data-testid="field-colour-legend" aria-label="Field colours" style={{ ...(embedded ? { position: "relative" as const, width: "100%", boxSizing: "border-box" as const } : { right: 40, bottom: 200, width: 280 }), gap: 6, padding: "10px 14px" }}>
      <div role="radiogroup" aria-label="Colour fields by" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(Object.keys(FIELD_METRICS) as FieldMetric[]).map((m) => (
          <FvButton key={m} role="radio" aria-checked={m === fv.metric} className="fv-pill fv-auto" data-testid={`field-metric-${m}`} onClick={() => setMetric(m)} style={{ height: 24, padding: "0 8px", opacity: m === fv.metric ? 1 : 0.65 }}>
            <span className="l" style={{ fontSize: 11.5, color: color.ink }}>{FIELD_METRICS[m].label.split(" (")[0]}</span>
          </FvButton>
        ))}
      </div>
      <span className="ff-p">{spec.label} · {fv.strategy.name} · year {fv.year}</span>
      <div aria-hidden style={{ height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${RAMP.join(",")})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: color.inkSecondary }}>
        <span>better</span>
        <span>{fmt(fv.min)}–{fmt(fv.max)} {fv.unit} over years 1–10</span>
        <span>worse</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2 }}>
        {fv.values.map((v) => (
          <li key={v.fieldId} data-testid="field-colour-row" style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 8, alignItems: "center", fontSize: 11.5 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: v.colour }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.get(v.fieldId) ?? v.fieldId}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: color.inkSecondary }}>{fmt(v.value, v.unit.split(",")[0])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
