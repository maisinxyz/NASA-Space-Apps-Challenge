"use client";
// Body of /dev/farms-check (dev only): the farm 3D check of docs/farm-scouting/FARMS.md, run locally by the team.
// For each scouted candidate (plus Cornell as a known-3D control) it flies the app's own viewer in, waits for tiles,
// shows an oblique view (pitch -30°, ~350 m) and a top-down view (pitch -89°, ~1000 m) for 5 s each, and prints the
// stage-1 numbers: OSM building footprints (Overpass) sampled with scene.sampleHeightMostDetailed on the Google tileset
// against the local mesh ground and Cesium World Terrain, plus the smallest tile geometric error seen near the centre.
// Google Map Tiles policy: tiles are only streamed into this viewer; nothing is cached, stored or exported except the
// summary numbers you copy by hand. Open-ground points (>= 40 m from any OSM building) are the flat control.
import { type BoundingSphere, Cartesian3, Cartographic, type Cesium3DTile, type Viewer } from "cesium";
import { useEffect, useRef, useState } from "react";

import { GlobeDev } from "@/components/globe/Globe";
import type { Farm, GlobeHandle, TileTier } from "@/components/globe/types";
import type { LoadedTier } from "@/components/viewer/cesium/tiles";
import { CANDIDATES, FARMS } from "@/lib/farms";
import { type BuildingPoint, type BuildingSample, buildingsFromOverpass, distanceKm, fmtM, fmtShare, groundRing, offsetM, orbitCamera, overpassQuery, stage1, type Stage1 } from "@/lib/scouting/check";

type Live = { viewer: Viewer; tier: LoadedTier };
type Row = Stage1 & { id: string; name: string; status: string; minGeomErrorM: number | null; openShare3d: number | null; openPoints: number; osmError?: string };

declare global {
  interface Window {
    /** Dev only: results of the farm check, for a browser script. */
    __ftFarmsCheck?: { rows: Row[]; running: boolean };
  }
}

const TIER_A: TileTier[] = ["A", "B", "C"];
const OVERPASS = "https://overpass-api.de/api/interpreter"; // public Overpass instance, https://wiki.openstreetmap.org/wiki/Overpass_API
const DWELL_MS = 5000;
const SAMPLE_RADIUS_M = 600;
const MAX_BUILDINGS = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until the viewer reports no pending tiles for 1.5 s (or `maxMs` passes). */
async function settle(live: Live, maxMs = 45000) {
  const t0 = performance.now();
  let quietSince = 0;
  while (performance.now() - t0 < maxMs) {
    live.viewer.scene.requestRender();
    if (live.tier.pending() === 0) {
      quietSince ||= performance.now();
      if (performance.now() - quietSince > 1500) return true;
    } else quietSince = 0;
    await sleep(250);
  }
  return false;
}

async function heights(viewer: Viewer, pts: [number, number][]): Promise<(number | undefined)[]> {
  if (!viewer.scene.sampleHeightSupported || !pts.length) return pts.map(() => undefined);
  const out = await viewer.scene.sampleHeightMostDetailed(pts.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat)));
  return out.map((c) => (c && Number.isFinite(c.height) ? c.height : undefined));
}

async function osmBuildings(lon: number, lat: number): Promise<BuildingPoint[]> {
  const r = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassQuery(lon, lat, SAMPLE_RADIUS_M) }) });
  if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
  return buildingsFromOverpass(await r.json());
}

/** Grid points inside the sample radius at least 40 m from every OSM building: the open-ground (flat) control. */
function openPoints(lon: number, lat: number, b: BuildingPoint[]): [number, number][] {
  const pts: [number, number][] = [];
  for (let e = -400; e <= 400; e += 200)
    for (let n = -400; n <= 400; n += 200) {
      const p = offsetM(lon, lat, e, n);
      if (b.every((x) => distanceKm({ lon: p[0], lat: p[1] }, x) * 1000 > x.radiusM + 40)) pts.push(p);
    }
  return pts;
}

const devFarm = (f: Farm): Farm => ({ ...f, tier: "explore", radiusM: Math.max(f.radiusM, 1500), minRangeM: undefined, framing: undefined });

export default function FarmsCheck() {
  const [farms] = useState<Farm[]>(() => [...FARMS.filter((f) => f.id === "cornell-ruminant"), ...CANDIDATES.map((c) => c.farm)].map(devFarm));
  const [selectedId, setSelectedId] = useState(farms[0].id);
  const [live, setLive] = useState<Live | null>(null);
  const [tier, setTier] = useState<TileTier | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const globe = useRef<GlobeHandle>(null);
  const stop = useRef(false);

  useEffect(() => {
    window.__ftFarmsCheck = { rows, running };
  }, [rows, running]);

  const checkOne = async (f: Farm): Promise<Row> => {
    if (!live) throw new Error("viewer not ready");
    const row: Row = { id: f.id, name: f.name, status: "flying", buildingsSampled: 0, share3dLocal: null, share3dTerrain: null, medianLocalM: null, medianTerrainM: null, minGeomErrorM: null, openShare3d: null, openPoints: 0 };
    const put = (r: Partial<Row>) => setRows((rs) => [...rs.filter((x) => x.id !== f.id), { ...row, ...r }]);
    put({});
    setSelectedId(f.id);
    await sleep(6000); // fly-in
    await settle(live);

    // Detail proxy: smallest geometric error of a visible Google tile whose bounds reach within 300 m of the centre.
    const centre = Cartesian3.fromDegrees(f.lon, f.lat);
    let minErr = Number.POSITIVE_INFINITY;
    const onVisible = (t: Cesium3DTile) => {
      const s: BoundingSphere = t.boundingSphere;
      if (Cartesian3.distance(s.center, centre) - s.radius < 300 && t.geometricError < minErr) minErr = t.geometricError;
    };
    const ts = live.tier.tileset;
    ts?.tileVisible.addEventListener(onVisible);

    const ground = await live.tier.sampleGround(f.lon, f.lat);
    for (const [range, pitch] of [
      [350, -30],
      [1000, -89],
    ] as const) {
      if (stop.current) break;
      globe.current?.setCamera(orbitCamera({ lon: f.lon, lat: f.lat, ground }, range, pitch, 0));
      await settle(live);
      await sleep(DWELL_MS);
    }
    ts?.tileVisible.removeEventListener(onVisible);
    row.minGeomErrorM = Number.isFinite(minErr) ? minErr : null;

    put({ status: "sampling" });
    let b: BuildingPoint[] = [];
    try {
      b = (await osmBuildings(f.lon, f.lat)).sort((x, y) => distanceKm(f, x) - distanceKm(f, y)).slice(0, MAX_BUILDINGS);
    } catch (e) {
      row.osmError = e instanceof Error ? e.message : String(e);
    }
    const roofs = await heights(live.viewer, b.map((x) => [x.lon, x.lat]));
    const rings = b.map((x) => groundRing(x));
    const ringH = await heights(live.viewer, rings.flat());
    const terr = await Promise.all(b.map((x) => live.tier.sampleGround(x.lon, x.lat)));
    const samples: BuildingSample[] = b.map((_, i) => {
      const hs = ringH.slice(i * 6, i * 6 + 6).filter((h): h is number => h !== undefined);
      return { roof: roofs[i], localGround: hs.length ? Math.min(...hs) : undefined, terrain: terr[i] };
    });
    // Open-ground control: tileset vs terrain at points away from buildings (trees can still read as 3D).
    const open = openPoints(f.lon, f.lat, b);
    const oh = await heights(live.viewer, open);
    const ot = await Promise.all(open.map(([lon, lat]) => live.tier.sampleGround(lon, lat)));
    const od = oh.map((h, i) => (h === undefined ? undefined : h - ot[i])).filter((d): d is number => d !== undefined);
    const done: Row = { ...row, ...stage1(samples), status: "done", openPoints: od.length, openShare3d: od.length ? od.filter((d) => d >= 3).length / od.length : null };
    put(done);
    return done;
  };

  const runAll = async (list: Farm[]) => {
    stop.current = false;
    setRunning(true);
    try {
      for (const f of list) {
        if (stop.current) break;
        await checkOne(f);
      }
    } catch (e) {
      setNote(`Stopped: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const markdown = () =>
    [
      "| id | buildings sampled | share >= 3 m (local ground) | share >= 3 m (terrain) | median (local) | median (terrain) | min tile geometric error | open-ground share >= 3 m |",
      "|---|---|---|---|---|---|---|---|",
      ...rows.map((r) => `| ${r.id} | ${r.buildingsSampled}${r.osmError ? ` (${r.osmError})` : ""} | ${fmtShare(r.share3dLocal)} | ${fmtShare(r.share3dTerrain)} | ${fmtM(r.medianLocalM)} | ${fmtM(r.medianTerrainM)} | ${fmtM(r.minGeomErrorM)} | ${fmtShare(r.openShare3d)} of ${r.openPoints} |`),
    ].join("\n");

  const selected = farms.find((f) => f.id === selectedId)!;
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
        onSelect={(id) => id && setSelectedId(id)}
        onReady={(i) => setTier(i.tier)}
        onError={(e) => setNote(e.message)}
        onViewer={setLive}
      />
      <div className="absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] w-[30rem] flex-col gap-2 overflow-y-auto rounded-md bg-surface/95 p-3 text-xs text-ink shadow">
        <p className="text-sm font-semibold">Farm 3D check (dev only)</p>
        <p>
          Tier {tier ?? "…"} · surface {live?.tier.surface ?? "…"} · {farms.length} sites (Cornell = known-3D control). Tier must be A with surface google for valid numbers.
        </p>
        <p className="text-ink-muted">
          Viewing: {selected.name} ({selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}, approximate location)
        </p>
        {note && <p className="text-danger">{note}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!live || running} onClick={() => void runAll(farms)}>
            Run all
          </button>
          <button className={btn} disabled={!live || running} onClick={() => void runAll([selected])}>
            Run this site
          </button>
          <button className={btn} disabled={!running} onClick={() => (stop.current = true)}>
            Stop
          </button>
          <button className={btn} disabled={!rows.length} onClick={() => void navigator.clipboard?.writeText(markdown()).catch(() => {})}>
            Copy markdown
          </button>
          <select className="rounded border border-line bg-surface-2 px-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Site">
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id}
              </option>
            ))}
          </select>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-ink-muted">
              <th>id</th>
              <th>bldgs</th>
              <th>3D (local)</th>
              <th>3D (terrain)</th>
              <th>median</th>
              <th>min err</th>
              <th>open 3D</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid={`row-${r.id}`}>
                <td>{r.id}</td>
                <td title={r.osmError}>{r.osmError ? "OSM error" : r.buildingsSampled}</td>
                <td>{fmtShare(r.share3dLocal)}</td>
                <td>{fmtShare(r.share3dTerrain)}</td>
                <td>{fmtM(r.medianLocalM)}</td>
                <td>{fmtM(r.minGeomErrorM)}</td>
                <td>{fmtShare(r.openShare3d)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-ink-muted">
          Read: a farm with real 3D buildings shows share (local) well above 50 % and median 4+ m; a draped/flat mesh shows ~0 % and ~0 m. Open-ground share
          should stay low (trees raise it). Min tile geometric error is a detail proxy: smaller is sharper. Then confirm visually. Building footprints © OpenStreetMap
          contributors (ODbL).
        </p>
      </div>
    </div>
  );
}
