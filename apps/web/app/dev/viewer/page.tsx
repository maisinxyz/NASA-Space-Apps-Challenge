"use client";
// Dev harness for <TwinViewer /> (track A). Not part of the product UI.
import { useEffect, useRef, useState } from "react";
import { getSimulation, getTerrain, isMock } from "@/lib/api/client";
import type { SimulationStatus, TerrainPackage } from "@/lib/api/types";
import { type FieldFeature, isCoarseImagery, loadMockFields, mockExtrasEnabled, type ProbeResult, TwinViewer, type TwinViewerHandle, type ViewerLayerName, type ViewerQuality, type ViewerStats } from "@/components/viewer";

const TERRAINS = ["terr_mock_tilted", "terr_mock_hills", "terr_mock_bowl"];
const LAYERS: ViewerLayerName[] = ["slope", "flow_accumulation", "depressions", "cover_class", "risk"];
const ROTATIONS = ["rot_existing", "rot_cover", "rot_forage"];

export default function DevViewer() {
  const [terrainId, setTerrainId] = useState(TERRAINS[0]);
  const [terrain, setTerrain] = useState<TerrainPackage | null>(null);
  const [fields, setFields] = useState<FieldFeature[]>([]);
  const [sim, setSim] = useState<SimulationStatus | null>(null);
  const [useSim, setUseSim] = useState(false);
  const [layers, setLayers] = useState<ViewerLayerName[]>([]);
  const [mode, setMode] = useState<"single" | "split">("single");
  const [a, setA] = useState(ROTATIONS[0]);
  const [b, setB] = useState(ROTATIONS[1]);
  const [timeMin, setTimeMin] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [quality, setQuality] = useState<ViewerQuality>("auto");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [firstFrameMs, setFirstFrameMs] = useState<number | null>(null);
  const loadStarted = useRef(0);
  const firstReady = useRef(false);
  const [log, setLog] = useState<string[]>([]);
  const viewer = useRef<TwinViewerHandle>(null);
  const say = (m: string) => setLog((l) => [...l.slice(-5), m]);

  useEffect(() => {
    let cancelled = false;
    loadStarted.current = performance.now();
    firstReady.current = false;
    setFirstFrameMs(null);
    setStats(null);
    setTerrain(null);
    setFields([]);
    setSelected(null);
    getTerrain(terrainId).then(async (t) => {
      if (cancelled) return;
      setTerrain(t);
      const nextFields = await loadMockFields(t);
      if (!cancelled) setFields(nextFields);
    }).catch((e: unknown) => { if (!cancelled) say(`Terrain load failed: ${String(e)}`); });
    return () => { cancelled = true; };
  }, [terrainId]);
  useEffect(() => {
    getSimulation("sim_mock_001").then(setSim);
  }, []);

  const times = sim?.results[a]?.frame_times_min ?? [0, 1];
  return (
    <main style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "100vh", font: "13px/1.5 system-ui, sans-serif" }}>
      <aside style={{ padding: 12, overflow: "auto", display: "grid", gap: 8, alignContent: "start" }}>
        <strong>/dev/viewer {isMock && <mark>mock</mark>}</strong>
        <label>
          Terrain{" "}
          <select value={terrainId} onChange={(e) => setTerrainId(e.target.value)}>
            {TERRAINS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div>Vertical scale: x1.5 exaggerated{terrain && isCoarseImagery(terrain) ? " · coarse imagery" : ""}</div>
        <fieldset>
          <legend>Layers</legend>
          {LAYERS.map((l) => (
            <label key={l} style={{ display: "block" }}>
              <input type="checkbox" checked={layers.includes(l)} onChange={(e) => setLayers((cur) => (e.target.checked ? [...cur, l] : cur.filter((x) => x !== l)))} /> {l}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Simulation sim_mock_001 (made for terr_mock_hills)</legend>
          <label style={{ display: "block" }}>
            <input type="checkbox" checked={useSim} onChange={(e) => setUseSim(e.target.checked)} /> water + risk
          </label>
          <label style={{ display: "block" }}>
            <input type="checkbox" checked={mode === "split"} onChange={(e) => setMode(e.target.checked ? "split" : "single")} /> A/B split
          </label>
          <label style={{ display: "block" }}>
            <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} /> difference (B minus A, mm, modeled)
          </label>
          A <select value={a} onChange={(e) => setA(e.target.value)}>{ROTATIONS.map((r) => <option key={r}>{r}</option>)}</select>{" "}
          B <select value={b} onChange={(e) => setB(e.target.value)}>{ROTATIONS.map((r) => <option key={r}>{r}</option>)}</select>
          <input type="range" min={0} max={times[times.length - 1]} step={1} value={timeMin} onChange={(e) => setTimeMin(Number(e.target.value))} style={{ width: "100%" }} />
          t = {timeMin} min from storm start
        </fieldset>
        <label>
          Quality{" "}
          <select value={quality} onChange={(e) => setQuality(e.target.value as ViewerQuality)}>
            <option>auto</option>
            <option>low</option>
            <option>high</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> reduced motion
        </label>
        <div>
          <button onClick={() => viewer.current?.replay()}>Replay terraform</button> <button onClick={() => viewer.current?.setCameraPreset("overview")}>Overview</button>{" "}
          <button onClick={() => viewer.current?.setCameraPreset("field")}>Field</button>
        </div>
        <div data-testid="stats">{stats ? `${stats.fps} fps · ${stats.drawCalls} draw calls · tier ${stats.tier}` : "no stats yet"}</div>
        <div data-testid="first-frame">First rendered terrain frame: {firstFrameMs === null ? "pending" : `${Math.round(firstFrameMs)} ms (measured)`}. Includes terrain metadata/assets and first draw; excludes terraform completion.</div>
        <div data-testid="renderer-memory">Renderer resources: {stats?.memory ? `${stats.memory.geometries} geometries · ${stats.memory.textures} textures · ${stats.memory.programs} programs (measured counts)` : "pending"}. These counts do not measure VRAM bytes.</div>
        <div>
          Fields: {mockExtrasEnabled ? <mark>mock R1, illustrative (synthetic)</mark> : "off (NEXT_PUBLIC_MOCK_EXTRAS=1)"} · selected: {selected ?? "none"}
        </div>
        <pre data-testid="probe" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {probe ? `lon ${probe.lon.toFixed(6)} lat ${probe.lat.toFixed(6)}\nelevation ${probe.elevation_m.toFixed(2)} m\n${JSON.stringify(probe.layer)}` : "probe: move over the terrain"}
        </pre>
        <pre data-testid="log" style={{ margin: 0 }}>{log.join("\n")}</pre>
      </aside>
      {terrain ? (
        <TwinViewer
          ref={viewer}
          className="dev-viewer"
          terrain={terrain}
          fields={fields}
          layers={layers}
          selectedFieldId={selected}
          mode={mode}
          rotationIds={mode === "split" || showDiff ? [a, b] : [a]}
          sim={useSim && sim ? { simId: sim.id, results: sim.results } : undefined}
          timeMin={timeMin}
          showDiff={showDiff}
          quality={quality}
          reducedMotion={reducedMotion}
          onFieldSelect={setSelected}
          onProbe={setProbe}
          onReady={() => {
            if (!firstReady.current) {
              firstReady.current = true;
              setFirstFrameMs(performance.now() - loadStarted.current);
            }
            say("onReady");
          }}
          onTerraformDone={() => say("onTerraformDone")}
          onError={(e) => say(`onError: ${e.message}`)}
          onStats={setStats}
          pins={[{ id: "pin_dev", lon: (terrain.bbox_wgs84[0] + terrain.bbox_wgs84[2]) / 2, lat: (terrain.bbox_wgs84[1] + terrain.bbox_wgs84[3]) / 2, label: "Dev pin at the terrain centre", text: "3" }]}
          onPinSelect={(id) => say(`pin ${id}`)}
        />
      ) : (
        <div style={{ padding: 24 }}>Loading terrain…</div>
      )}
      <style>{".dev-viewer{width:100%;height:100vh}.dev-viewer canvas{display:block}"}</style>
    </main>
  );
}
