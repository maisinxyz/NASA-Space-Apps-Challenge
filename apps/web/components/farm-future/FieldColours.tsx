"use client";
// Future mode: each twin field coloured from its engine trajectory at the clock year (F2), and the legend.
// The overlay is a north-up canvas over the twin's simulation square, drawn by the globe like any GroundOverlay.
import { useEffect, useMemo, useRef, useState } from "react";

import type { GroundOverlay } from "@/components/globe/types";
import { forecastYear, strategyOf } from "@/lib/farm-future/data";
import { fieldValues, paintFields } from "@/lib/farm-future/fieldColours";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { NEUTRAL } from "@/lib/conditions/model";
import { useConditionView } from "@/lib/conditions/useConditionView";
import { twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";


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
  const view = useConditionView();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);
  const on = mode !== "compare" && !!twin;
  useEffect(() => {
    if (!on || !twin) return;
    if (!canvas.current) {
      canvas.current = document.createElement("canvas");
      canvas.current.width = canvas.current.height = SIZE;
    }
    // Same colours as the 2D map: the selected condition at the scrubber year, hotspot zones on top.
    const byId = new Map(view?.plots.map((p) => [p.fieldId, p.colour]) ?? []);
    paintFields(canvas.current, twin.simBbox, [
      ...twin.fields.map((f) => ({ ring: f.ring, colour: byId.get(f.id) ?? NEUTRAL })),
      ...(view?.zones.map((z) => ({ ring: z.ring, colour: z.colour })) ?? []),
    ]);
    setVersion((v) => v + 1);
  }, [on, twin, view]);
  return useMemo(
    () => (on && twin && canvas.current && version > 0 ? [{ id: "future-field-colours", bbox: twin.simBbox, canvas: canvas.current, version, opacity: 0.62 }] : []),
    [on, twin, version],
  );
}
