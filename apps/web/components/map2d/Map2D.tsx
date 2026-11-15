"use client";
// 2D bird's-eye view (v4 PRD F3). MapLibre over the paused Cesium globe: 2022 municipal orthophotos, the twin's field
// outlines coloured per field (D4), field popovers, and a draw-polygon tool that analyses a custom field
// (POST /field/analyze, 2D only, D7). Unmounting removes the map (its WebGL context is released); the Cesium camera
// was never touched, so 3D Explore comes back where it was.
import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MlMapCtor, getVersion, setWorkerUrl, NavigationControl, ScaleControl, type GeoJSONSource, type Map as MlMap, type MapMouseEvent, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { ApiError, postFieldAnalyze } from "@/lib/api/client";
import type { FieldAnalyzeResponse } from "@/lib/api/types";
import { FIELD_METRICS } from "@/lib/farm-future/fieldColours";
import { farmById, twinConfig } from "@/lib/farms";
import { color } from "@/lib/farm-view/tokens";
import { fmt } from "@/lib/forecast/select";
import { boxAround, closeRing, MAX_FIELD_HA, ringAreaHa, savedCamera, saveCamera, type LonLat } from "@/lib/map2d/geo";
import { imageryFor } from "@/lib/map2d/imagery";
import { usePlots, usePlotStore } from "@/lib/plots/store";
import { useConditionView } from "@/lib/conditions/useConditionView";
import { useFutureStore } from "@/lib/farm-future/store";
import { useAppStore } from "@/lib/store";

import { useFieldValues } from "@/components/farm-future/FieldColours";
import { FvButton } from "@/components/farm-view/FvButton";
import { AskCopilot } from "@/components/copilot/AskCopilot";

const NEUTRAL = "#E2B866";
const VIEW_M = 3000;

// Map chrome lives in the bottom 40px strip the floating windows leave free: scale bar bottom-left, caption beside it,
// MapLibre attribution bottom-right. Scoped to the map2d root; no global rules.
const MAP_CHROME_CSS = `
[data-testid="map2d"] .maplibregl-ctrl-bottom-left{left:16px;bottom:6px;display:flex;flex-direction:row;align-items:flex-end;gap:8px;max-height:28px;overflow:hidden}
[data-testid="map2d"] .maplibregl-ctrl-bottom-left .maplibregl-ctrl{margin:0}
[data-testid="map2d"] .maplibregl-ctrl-scale{font-size:10px;line-height:12px;margin:0}
[data-testid="map2d"] .maplibregl-ctrl-bottom-right{right:6px;bottom:6px;display:flex;flex-direction:column;align-items:flex-end}
[data-testid="map2d"] .maplibregl-ctrl-bottom-right .maplibregl-ctrl{margin:0}
[data-testid="map2d"] .maplibregl-ctrl-attrib,[data-testid="map2d"] .maplibregl-ctrl-attrib-inner{font-size:10px;line-height:14px;white-space:nowrap}
`;

function styleFor(farmId: string): StyleSpecification {
  const img = imageryFor(farmId);
  return {
    version: 8,
    sources: img
      ? { imagery: { type: "raster", tiles: [img.tiles], tileSize: img.tileSize, maxzoom: img.maxzoom, attribution: `${img.attribution} (captured ${img.year})` } }
      : {},
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#1b1712" } },
      ...(img ? [{ id: "imagery", type: "raster" as const, source: "imagery" }] : []),
    ],
  };
}

type DraftFeature = { type: "Feature"; properties: Record<string, never>; geometry: { type: "Point"; coordinates: LonLat } | { type: "LineString"; coordinates: LonLat[] } | { type: "Polygon"; coordinates: LonLat[][] } };
type Popover = { fieldId: string; at: LonLat };

export function Map2D({ toolsOpen = false, onExit }: { toolsOpen?: boolean; onExit?: () => void }) {
  const farmId = useAppStore((s) => s.farmId);
  const farm = farmById(farmId);
  const twin = twinConfig(farmId);
  const fv = useFieldValues();
  const cv = useConditionView();
  const plots = usePlots(farmId);
  const addPlot = usePlotStore((s) => s.add);
  const removePlot = usePlotStore((s) => s.remove);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [imageryFailed, setImageryFailed] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [projection, setProjection] = useState<"mercator" | "globe">("mercator");
  const [popover, setPopover] = useState<Popover | null>(null);
  const [selPlot, setSelPlot] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<LonLat[]>([]);
  const drawingRef = useRef(false);
  drawingRef.current = drawing;
  const [analysis, setAnalysis] = useState<{ status: "idle" | "loading" | "ready" | "error"; result?: FieldAnalyzeResponse; error?: string }>({ status: "idle" });

  // Create once per farm; remove on unmount.
  useEffect(() => {
    if (!box.current || !farm) return;
    const cam = savedCamera(farm.id);
    setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
    void attempt; // retry button bumps this to rebuild the map
    setInitFailed(false);
    let map: MlMap;
    try {
      map = new MlMapCtor({
      container: box.current,
      style: styleFor(farm.id),
      bounds: cam ? undefined : boxAround(farm.lon, farm.lat, VIEW_M),
      center: cam?.center,
      zoom: cam?.zoom,
      bearing: cam?.bearing ?? 0,
      pitch: cam?.pitch ?? 0,
      attributionControl: { compact: false },
      keyboard: true,
      maxPitch: 60,
      });
    } catch {
      setInitFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new ScaleControl({ unit: "imperial" }), "bottom-left");
    map.on("error", (e) => {
      const src = (e as unknown as { sourceId?: string }).sourceId;
      if (src === "imagery") setImageryFailed(true);
      else if (!src && !map.loaded()) setInitFailed(true); // worker/style/WebGL failure before the map ever loaded
    });
    map.on("sourcedata", (e) => {
      if (e.sourceId === "fields" && e.isSourceLoaded) setFieldsReady(true);
    });
    map.on("load", () => {
      // Forecast fields (the plots the engine forecasts): coloured by the selected metric at the scrubber year.
      map.addSource("fields", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "fields-fill", type: "fill", source: "fields", paint: { "fill-color": ["get", "colour"], "fill-opacity": 0.6, "fill-color-transition": { duration: 400 } } });
      map.addLayer({ id: "fields-line", type: "line", source: "fields", paint: { "line-color": "#ffffff", "line-width": 3 } });
      // Hotspot zones of the selected condition (erosion, water stress, frost pockets).
      map.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": ["get", "colour"], "fill-opacity": 0.85 } });
      map.addLayer({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": "#ffffff", "line-width": 1.5, "line-dasharray": [1, 1] } });
      // User-drawn plots: display only, dashed outline.
      map.addSource("plots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "plots-fill", type: "fill", source: "plots", paint: { "fill-color": ["get", "colour"], "fill-opacity": 0.35 } });
      map.addLayer({ id: "plots-line", type: "line", source: "plots", paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 1.5] } });
      map.addSource("draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#ffd23f", "fill-opacity": 0.45 } });
      map.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#ffd23f", "line-width": 3 } });
      map.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": "#ffd23f", "circle-stroke-color": "#05070c", "circle-stroke-width": 1 } });
      setReady(true);
    });
    map.on("click", (e: MapMouseEvent) => {
      if (drawingRef.current) {
        // Each click adds one corner of the plot.
        const c: LonLat = [e.lngLat.lng, e.lngLat.lat];
        setPoints((p) => [...p, c]);
        return;
      }
      const plotHit = map.queryRenderedFeatures(e.point, { layers: ["plots-fill"] })[0];
      const fieldHit = plotHit ? undefined : map.queryRenderedFeatures(e.point, { layers: ["fields-fill"] })[0];
      setSelPlot((plotHit?.properties?.id as string | undefined) ?? null);
      const id = fieldHit?.properties?.id as string | undefined;
      setPopover(id ? { fieldId: id, at: [e.lngLat.lng, e.lngLat.lat] } : null);
      if (id) {
        useAppStore.setState({ twinFieldId: id });
        useFutureStore.setState({ focusFieldId: id });
      }
    });
    map.on("mousemove", "plots-fill", () => (map.getCanvas().style.cursor = drawingRef.current ? "crosshair" : "pointer"));
    map.on("mousemove", "fields-fill", () => (map.getCanvas().style.cursor = drawingRef.current ? "crosshair" : "pointer"));
    map.on("mouseleave", "fields-fill", () => (map.getCanvas().style.cursor = drawingRef.current ? "crosshair" : ""));
    return () => {
      const c = map.getCenter();
      saveCamera(farm.id, { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
      map.remove();
      mapRef.current = null;
      setReady(false);
      setFieldsReady(false);
    };
  }, [farm, attempt]);

  // Forecast field outlines, coloured per year.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !twin) return;
    const colours = new Map(cv?.plots.map((p) => [p.fieldId, p.colour]) ?? []);
    (map.getSource("fields") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: twin.fields.map((f) => ({
        type: "Feature",
        properties: { id: f.id, name: f.name, colour: colours.get(f.id) ?? NEUTRAL },
        geometry: { type: "Polygon", coordinates: [closeRing(f.ring)] },
      })),
    });
    (map.getSource("zones") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: (cv?.zones ?? []).map((z) => ({ type: "Feature", properties: { colour: z.colour }, geometry: { type: "Polygon", coordinates: [closeRing(z.ring)] } })),
    });
  }, [ready, twin, cv]);

  // Drawn plots.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("plots") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: plots.map((f) => ({
        type: "Feature",
        properties: { id: f.id, name: f.name, colour: f.colour },
        geometry: { type: "Polygon", coordinates: [closeRing(f.ring)] },
      })),
    });
  }, [ready, plots]);

  // Draft polygon.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const features: DraftFeature[] = points.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (points.length >= 3) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closeRing(points)] } });
    else if (points.length === 2) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } });
    (map.getSource("draft") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features } as Parameters<GeoJSONSource["setData"]>[0]);
  }, [ready, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [drawing, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) map.setProjection({ type: projection });
  }, [ready, projection]);

  if (!farm) return null;
  const img = imageryFor(farm.id);
  const area = ringAreaHa(points);
  const tooBig = area > MAX_FIELD_HA;
  const capText = img ? `Aerial photo: ${img.attribution}, captured ${img.year} (not the forecast period)` : "";

  const reset = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setBearing(0);
    map.setPitch(0);
    map.fitBounds(boxAround(farm.lon, farm.lat, VIEW_M), { duration: 400 });
  };
  const finish = async () => {
    if (points.length < 3 || tooBig) return;
    setDrawing(false);
    setAnalysis({ status: "loading" });
    try {
      const result = await postFieldAnalyze({ polygon: { type: "Polygon", coordinates: [closeRing(points)] }, rotation: "preset", scenario: "baseline" });
      setAnalysis({ status: "ready", result });
    } catch (e) {
      const msg = e instanceof ApiError ? (e.code === "RATE_LIMITED" ? "Too many requests. Wait a moment and try again." : e.message) : "The field could not be analysed.";
      setAnalysis({ status: "error", error: msg });
    }
  };
  const clearDraft = () => {
    setPoints([]);
    setDrawing(false);
    setAnalysis({ status: "idle" });
  };

  const pop = popover && fv ? fv.values.find((v) => v.fieldId === popover.fieldId) : null;
  const popField = popover ? twin?.fields.find((f) => f.id === popover.fieldId) : null;

  return (
    <div data-testid="map2d" data-fields-ready={fieldsReady} style={{ position: "absolute", inset: 0, pointerEvents: "auto", zIndex: 0 }}>
      <style>{MAP_CHROME_CSS}</style>
      <div ref={box} style={{ position: "absolute", inset: 0 }} aria-label={`2D map of ${farm.name}`} role="region" />

      {initFailed && (
        <div role="alert" data-testid="map2d-init-failed" className="fv-glass" style={{ position: "absolute", left: "50%", top: 16, transform: "translateX(-50%)", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, zIndex: 2, display: "flex", gap: 8, alignItems: "center" }}>
          <span>The 2D map could not start.</span>
          <FvButton className="fv-seg" data-testid="map2d-retry" onClick={() => setAttempt((n) => n + 1)}>Retry</FvButton>
          {onExit && <FvButton className="fv-seg" data-testid="map2d-exit" onClick={onExit}>Back to 3D</FvButton>}
        </div>
      )}
      {imageryFailed && !initFailed && (
        <div role="status" data-testid="map2d-imagery-failed" className="fv-glass" style={{ position: "absolute", left: "50%", top: 16, transform: "translateX(-50%)", padding: "8px 14px", borderRadius: 10, fontSize: 12.5, zIndex: 2 }}>
          The aerial imagery did not load. Field outlines still show; 3D Explore is still available.
        </div>
      )}

      <div hidden={!toolsOpen} className="fv-glass map2d-tools" style={{ position: "absolute", right: 56, bottom: 120, display: toolsOpen ? "grid" : "none", gap: 6, padding: 8, borderRadius: 12, zIndex: 2, width: 190 }} data-testid="map2d-tools">
        <FvButton className="fv-seg" data-testid="map2d-reset" onClick={reset}>Reset map</FvButton>
        <FvButton className="fv-seg" data-testid="map2d-projection" aria-pressed={projection === "globe"} onClick={() => setProjection(projection === "globe" ? "mercator" : "globe")}>
          {projection === "globe" ? "Flat map" : "Globe projection"}
        </FvButton>
        {!drawing && points.length === 0 && (
          <FvButton className="fv-seg" data-testid="map2d-draw" onClick={() => { setDrawing(true); setPopover(null); setAnalysis({ status: "idle" }); }}>Draw a field</FvButton>
        )}
        {(drawing || points.length > 0) && (
          <>
            <span style={{ fontSize: 11.5, color: color.inkSecondary }}>
              {drawing ? "Click each corner of the plot (3 or more), then Save plot." : "Drawn field."} 
              {points.length >= 3 ? ` · ${fmt(area, "ha")}` : ""}
            </span>
            {tooBig && <span role="alert" style={{ fontSize: 11.5, color: "#C46A52" }}>Over {MAX_FIELD_HA} ha. Draw a smaller field.</span>}
            {drawing && <FvButton className="fv-seg" data-testid="map2d-undo" disabled={points.length === 0} onClick={() => setPoints((p) => p.slice(0, -1))}>Undo last corner</FvButton>}
            {drawing && <FvButton className="fv-seg" data-testid="map2d-save" disabled={points.length < 3 || tooBig} onClick={() => { addPlot(farm.id, points); clearDraft(); }}>Save plot</FvButton>}
            {drawing && <FvButton className="fv-seg" data-testid="map2d-finish" disabled={points.length < 3 || tooBig} onClick={finish}>Analyse field</FvButton>}
            <FvButton className="fv-seg" data-testid="map2d-clear" onClick={clearDraft}>Clear drawing</FvButton>
          </>
        )}
      </div>

      {plots.length > 0 && (
        <ul className="fv-glass" data-testid="map2d-plots" style={{ position: "absolute", left: 16, top: 16, margin: 0, padding: 8, borderRadius: 12, zIndex: 2, listStyle: "none", display: "grid", gap: 4, fontSize: 12 }}>
          {plots.map((p) => (
            <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: 2, background: p.colour, border: "1.5px solid #fff" }} />
              <span style={{ flex: 1 }}>{p.name} · {fmt(ringAreaHa(p.ring), "ha")}</span>
              <FvButton className="ff-link" aria-label={`Delete ${p.name}`} onClick={() => removePlot(farm.id, p.id)}>Delete</FvButton>
            </li>
          ))}
        </ul>
      )}

      {img && (
        <p
          className="fv-cap map2d-cap"
          title={capText}
          style={{ position: "absolute", left: 256, right: 280, bottom: 6, margin: 0, fontSize: 11, lineHeight: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", zIndex: 2, textShadow: "0 1px 2px rgba(0,0,0,.8)" }}
        >
          {capText}
        </p>
      )}

      {selPlot && plots.find((p) => p.id === selPlot) && (
        <div className="fv-glass" role="dialog" data-testid="map2d-plot-popover" style={{ position: "absolute", left: 16, top: 220, padding: 12, borderRadius: 12, zIndex: 2, display: "grid", gap: 6, fontSize: 12.5 }}>
          <strong>{plots.find((p) => p.id === selPlot)!.name}</strong>
          <div style={{ display: "flex", gap: 10 }}>
            <FvButton className="fv-seg" data-testid="map2d-plot-delete" onClick={() => { removePlot(farm.id, selPlot); setSelPlot(null); }}>Delete plot</FvButton>
            <FvButton className="ff-link" onClick={() => setSelPlot(null)}>Close</FvButton>
          </div>
        </div>
      )}

      {pop && popField && fv && (
        <div className="fv-glass map2d-popover" role="dialog" aria-label={`Field ${popField.name}`} data-testid="map2d-popover" style={{ position: "absolute", left: 16, top: 220, width: 280, padding: 12, borderRadius: 12, zIndex: 2, display: "grid", gap: 6, fontSize: 12.5 }}>
          <strong>{popField.name}</strong>
          <span style={{ color: color.inkSecondary }}>{fmt(popField.areaHa, "ha")}</span>
          <span>
            {FIELD_METRICS[fv.metric].label} in year {fv.year} under {fv.strategy.name}: <b>{fmt(pop.value, pop.unit)}</b>
            {pop.p10 !== null && pop.p90 !== null && pop.p10 !== pop.p90 ? ` (likely ${fmt(pop.p10)} to ${fmt(pop.p90)})` : ""}.
          </span>
          <span style={{ color: color.inkSecondary }}>{FIELD_METRICS[fv.metric].higherIsBetter ? "Higher is better." : "Lower is better."} Scenario forecast, not a measurement.</span>
          <div style={{ display: "flex", gap: 10 }}>
            <AskCopilot kind="field" id={popField.id} fieldId={popField.id} strategyId={fv.strategy.engineId} question={`What does the forecast say about ${popField.name}, and what should I check locally?`} />
            <FvButton className="ff-link" onClick={() => setPopover(null)}>Close</FvButton>
          </div>
        </div>
      )}

      {analysis.status !== "idle" && <AnalysisCard state={analysis} onClose={clearDraft} />}
    </div>
  );
}

function AnalysisCard({ state, onClose }: { state: { status: string; result?: FieldAnalyzeResponse; error?: string }; onClose(): void }) {
  const r = state.result;
  const field = r?.forecast.fields[0];
  return (
    <aside className="fv-glass map2d-analysis" data-testid="map2d-analysis" aria-label="Custom field analysis" style={{ position: "absolute", right: 56, top: 16, width: 320, maxHeight: "calc(100% - 280px)", overflowY: "auto", padding: 14, borderRadius: 14, zIndex: 3, display: "grid", gap: 8, fontSize: 12.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Custom field</strong>
        <FvButton className="ff-link" onClick={onClose}>Close</FvButton>
      </div>
      {state.status === "loading" && <p role="status" style={{ margin: 0 }}>Analysing the field…</p>}
      {state.status === "error" && <p role="alert" style={{ margin: 0, color: "#C46A52" }}>{state.error}</p>}
      {r && field && (
        <>
          {r.forecast.data_mode === "mock" && <span className="ff-synth" style={{ justifySelf: "start" }}>mock</span>}
          <span>{fmt(r.area_ha, "ha")} · {r.location.lat.toFixed(4)}, {r.location.lon.toFixed(4)}</span>
          {field.strategies.map((s) => {
            const soil = s.trajectories.soil_organic_index?.points.find((p) => p.year === 10);
            const irr = s.trajectories.irrigation_need_mm;
            const irr10 = irr?.points.find((p) => p.year === 10);
            return (
              <div key={s.id} style={{ borderTop: "1px solid rgba(242,235,221,.12)", paddingTop: 6, display: "grid", gap: 2 }}>
                <b style={{ fontWeight: 500 }}>{s.role === "existing" ? "Current rotation" : s.label}</b>
                {soil && <span>Soil organic matter, year 10: {fmt(soil.p50)} (index, year 0 = 100)</span>}
                {irr10 && irr && <span>Irrigation need, year 10: {fmt(irr10.p50, irr.unit)}</span>}
              </div>
            );
          })}
          <ul style={{ margin: 0, paddingLeft: 16, color: color.inkSecondary }}>
            {r.resolution_notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <span style={{ color: color.inkSecondary }}>{r.forecast.support_sentence}</span>
        </>
      )}
    </aside>
  );
}
