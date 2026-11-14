"use client";
// Body of /dev/trace (dev only). Google 3D (tier A, loaded lazily after the farm fly-in, as in the product farm view).
// Click the 3D surface to add vertices; finish rings; copy rings as TS / GeoJSON, a sim square, or the camera as
// Farm.framing. ?lon=&lat= opens a custom point, ?r= sets the camera radius (m, default 3000).
import { Cartesian2, Cartesian3, Cartographic, ClassificationType, Color, CustomDataSource, Math as CesiumMath, PolygonHierarchy, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";

import { GlobeDev } from "@/components/globe/Globe";
import type { Farm, GlobeHandle, TileTier } from "@/components/globe/types";
import type { LoadedTier } from "@/components/viewer/cesium/tiles";
import { type Ring, ringAreaHa, ringsToGeoJson, ringsToTs, squareBbox } from "@/components/viewer/cesium/trace";

// Approximate points of the new farms (sources and TODO(verify) in docs/progress/s1-C3-render.md, Phase A).
const PRESETS: { id: string; name: string; lon: number; lat: number }[] = [
  { id: "cornell", name: "Cornell Ruminant Center barns (approx.)", lon: -76.2451, lat: 42.4425 },
  { id: "beltsville", name: "Beltsville ARC campus point (approx.)", lon: -76.8844, lat: 39.0319 },
  { id: "oakville", name: "Oakville Grade area, Napa (approx.)", lon: -122.4121, lat: 38.4201 },
];
const TIER_A: TileTier[] = ["A", "B", "C"];

const farmOf = (id: string, name: string, lon: number, lat: number, radiusM: number): Farm => ({
  id,
  name,
  owner: "dev tracer",
  country: "dev",
  lon,
  lat,
  tier: "explore",
  sourceUrl: "",
  coordsVerified: false,
  radiusM,
});

type Live = { viewer: Viewer; tier: LoadedTier };
declare global {
  interface Window {
    /** Dev only: lets a browser script drive the tracer (camera through the Globe's own orbit). */
    __ftTrace?: { globe: GlobeHandle | null; viewer: Viewer } | null;
  }
}

/** Surface point under a screen position: 3D tiles depth first, then the globe, then the ellipsoid. */
function pickLonLatH(viewer: Viewer, pos: Cartesian2): [number, number, number] | null {
  const { scene } = viewer;
  scene.render(); // requestRenderMode: the depth buffer can be stale or empty without a fresh frame
  let c: Cartesian3 | undefined = scene.pickPositionSupported ? scene.pickPosition(pos) : undefined;
  if (!c && scene.globe.show) {
    const ray = scene.camera.getPickRay(pos);
    c = ray ? scene.globe.pick(ray, scene) : undefined;
  }
  c ??= scene.camera.pickEllipsoid(pos);
  if (!c) return null;
  const g = Cartographic.fromCartesian(c);
  return [CesiumMath.toDegrees(g.longitude), CesiumMath.toDegrees(g.latitude), g.height];
}

const r6 = (v: number) => Number(v.toFixed(6));

export default function Tracer() {
  const [init] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const lon = Number(q.get("lon"));
    const lat = Number(q.get("lat"));
    const radiusM = Number(q.get("r")) || 3000;
    const custom = q.has("lon") && q.has("lat") && Number.isFinite(lon) && Number.isFinite(lat) ? farmOf("query", `Query point ${lon}, ${lat}`, lon, lat, radiusM) : null;
    return { radiusM, custom };
  });
  const [farms, setFarms] = useState<Farm[]>(() => [...(init.custom ? [init.custom] : []), ...PRESETS.map((p) => farmOf(p.id, p.name, p.lon, p.lat, init.radiusM))]);
  const [selectedId, setSelectedId] = useState<string>(farms[0].id);
  const [live, setLive] = useState<Live | null>(null);
  const [tier, setTier] = useState<TileTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [tracing, setTracing] = useState(true);
  const [rings, setRings] = useState<Ring[]>([]);
  const [current, setCurrent] = useState<[number, number, number][]>([]);
  const [side, setSide] = useState(1300);
  const [simBbox, setSimBbox] = useState<[number, number, number, number] | undefined>(undefined);
  const [out, setOut] = useState("");
  const [paste, setPaste] = useState("");
  const globe = useRef<GlobeHandle>(null);
  const tracingRef = useRef(tracing);
  useEffect(() => {
    tracingRef.current = tracing;
  }, [tracing]);

  useEffect(() => {
    window.__ftTrace = live ? { globe: globe.current, viewer: live.viewer } : null;
  }, [live]);

  // Click on the 3D surface = add a vertex (a drag orbits instead: Cesium only reports clicks without movement).
  useEffect(() => {
    if (!live) return;
    const h = new ScreenSpaceEventHandler(live.viewer.scene.canvas);
    h.setInputAction((e: { position: Cartesian2 }) => {
      if (!tracingRef.current) return;
      const p = pickLonLatH(live.viewer, e.position);
      if (p) setCurrent((c) => [...c, p]);
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => h.destroy();
  }, [live]);

  // Draw finished rings (faint fill + outline) and the ring in progress (points + line).
  const ds = useMemo(() => new CustomDataSource("trace"), []);
  useEffect(() => {
    if (!live) return;
    void live.viewer.dataSources.add(ds);
    return () => {
      if (!live.viewer.isDestroyed()) live.viewer.dataSources.remove(ds);
    };
  }, [live, ds]);
  useEffect(() => {
    if (!live) return;
    ds.entities.removeAll();
    const line = (ring: number[][], color: Color, close: boolean) =>
      ds.entities.add({
        polyline: { positions: Cartesian3.fromDegreesArray((close ? [...ring, ring[0]] : ring).flatMap((p) => [p[0], p[1]])), width: 2, material: color, clampToGround: true, classificationType: ClassificationType.BOTH },
      });
    rings.forEach((r, i) => {
      ds.entities.add({
        polygon: { hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(r.flat())), material: Color.YELLOW.withAlpha(0.18), classificationType: ClassificationType.BOTH },
      });
      line(r, Color.YELLOW, true);
      const [lon, lat] = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
      ds.entities.add({ position: Cartesian3.fromDegrees(lon, lat, current[0]?.[2] ?? 0), label: { text: `f${i + 1}`, font: "600 13px sans-serif", disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    });
    for (const p of current) ds.entities.add({ position: Cartesian3.fromDegrees(p[0], p[1], p[2]), point: { pixelSize: 7, color: Color.ORANGE, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    if (current.length >= 2) line(current, Color.ORANGE, false);
    live.viewer.scene.requestRender();
  }, [live, ds, rings, current]);

  const centrePick = () => {
    if (!live) return null;
    const c = live.viewer.scene.canvas;
    return pickLonLatH(live.viewer, new Cartesian2(c.clientWidth / 2, c.clientHeight / 2));
  };
  const show = (text: string) => {
    setOut(text);
    void navigator.clipboard?.writeText(text).catch(() => {});
  };
  const finish = () => {
    if (current.length >= 3) setRings((r) => [...r, current.map(([lon, lat]) => [r6(lon), r6(lat)] as [number, number])]);
    setCurrent([]);
  };
  const setFraming = () => {
    const at = centrePick();
    const cam = globe.current?.getCamera();
    if (!at || !cam || !live) return;
    const rangeM = Cartesian3.distance(live.viewer.camera.positionWC, Cartesian3.fromDegrees(at[0], at[1], at[2]));
    show(`{ lon: ${r6(at[0])}, lat: ${r6(at[1])}, rangeM: ${Math.round(rangeM)}, pitchDeg: ${cam.pitch.toFixed(1)}, headingDeg: ${cam.heading.toFixed(1)} }`);
  };
  const squareHere = () => {
    const at = centrePick();
    if (!at) return;
    const b = squareBbox({ lon: at[0], lat: at[1] }, side).map(r6) as [number, number, number, number];
    setSimBbox(b);
    show(`[${b.join(", ")}] // ${side} m square centred ${r6(at[0])}, ${r6(at[1])}`);
  };
  const recentre = () => {
    const at = centrePick();
    if (!at) return;
    const id = `here-${farms.length}`;
    setFarms((f) => [...f, farmOf(id, `Re-centred ${at[0].toFixed(4)}, ${at[1].toFixed(4)}`, at[0], at[1], init.radiusM)]);
    setSelectedId(id);
  };

  const btn = "rounded border border-line px-2 disabled:opacity-40";
  return (
    <div className="relative h-[calc(100dvh-5.5rem)] min-h-[30rem] bg-black">
      <GlobeDev
        ref={globe}
        farms={farms}
        selectedId={selectedId}
        view="farm"
        reducedMotion={false}
        tierOrder={TIER_A}
        simBbox={simBbox}
        onSelect={(id) => id && setSelectedId(id)}
        onReady={(i) => setTier(i.tier)}
        onError={(e) => setError(e.message)}
        onViewer={setLive}
        onLoadProgress={(i) => setPending(i.pending)}
      />
      <div className="absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] w-80 flex-col gap-2 overflow-y-auto rounded-md bg-surface/95 p-3 text-sm text-ink shadow">
        <p className="font-semibold">Field tracer (dev only)</p>
        <p data-testid="tier">
          Tier {tier ?? "…"} · surface {live?.tier.surface ?? "…"} · tiles pending {pending ?? "…"}
        </p>
        {error && <p className="text-danger">Error: {error}</p>}
        <select className="rounded border border-line bg-surface-2 px-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Location">
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={recentre}>
            Re-centre here
          </button>
          <button className={btn} onClick={() => globe.current?.resetView()}>
            Reset view
          </button>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={tracing} onChange={(e) => setTracing(e.target.checked)} /> Click adds a vertex (drag orbits, shift-drag pans)
        </label>
        <p data-testid="current">Current ring: {current.length} points</p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!current.length} onClick={() => setCurrent((c) => c.slice(0, -1))}>
            Undo point
          </button>
          <button className={btn} disabled={current.length < 3} onClick={finish}>
            Finish ring
          </button>
          <button className={btn} disabled={!rings.length} onClick={() => setRings((r) => r.slice(0, -1))}>
            Drop last ring
          </button>
        </div>
        <ol data-testid="rings" className="list-decimal pl-5">
          {rings.map((r, i) => (
            <li key={i}>
              f{i + 1}: {r.length} pts, {ringAreaHa(r).toFixed(1)} ha
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!rings.length} onClick={() => show(ringsToTs(rings))}>
            Copy TS
          </button>
          <button className={btn} disabled={!rings.length} onClick={() => show(ringsToGeoJson(rings))}>
            Copy GeoJSON
          </button>
          <button className={btn} onClick={setFraming}>
            Set framing
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            Square
            <input className="w-20 rounded border border-line bg-surface-2 px-1" type="number" min={200} max={5000} step={50} value={side} onChange={(e) => setSide(Number(e.target.value))} /> m
          </label>
          <button className={btn} onClick={squareHere}>
            Square at centre
          </button>
          <button className={btn} disabled={!simBbox} onClick={() => setSimBbox(undefined)}>
            Clear
          </button>
        </div>
        <textarea data-testid="out" readOnly className="h-28 rounded border border-line bg-surface-2 p-1 font-mono text-xs" value={out} aria-label="Output" />
        <textarea
          className="h-16 rounded border border-line bg-surface-2 p-1 font-mono text-xs"
          placeholder="Paste rings ([lon,lat][][]) to show them"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          aria-label="Paste rings"
        />
        <button
          className={btn}
          disabled={!paste.trim()}
          onClick={() => {
            try {
              setRings(JSON.parse(paste) as Ring[]);
            } catch (e) {
              setError(`Paste: ${String(e)}`);
            }
          }}
        >
          Load pasted rings
        </button>
      </div>
    </div>
  );
}
