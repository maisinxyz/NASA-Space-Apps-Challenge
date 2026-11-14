// Pure helpers of the farm 3D check (/dev/farms-check, docs/farm-scouting/FARMS.md stage 1). No Cesium imports so
// they can be unit-tested. Numbers are summaries computed in the running viewer; nothing from Google's tiles is stored.

/** One OSM building: centroid and an approximate radius (half the larger bbox side), metres. */
export type BuildingPoint = { lon: number; lat: number; radiusM: number };

/** Heights sampled in the viewer at one building, metres above the WGS84 ellipsoid. */
export type BuildingSample = {
  /** Height of the 3D tileset at the centroid (roof if the building is real 3D). */
  roof: number | undefined;
  /** Lowest tileset height on a ring just outside the footprint (local ground of the mesh). */
  localGround: number | undefined;
  /** Terrain model height at the centroid (Cesium World Terrain). */
  terrain: number | undefined;
};

export type Stage1 = {
  buildingsSampled: number;
  /** Share of sampled buildings whose roof is >= minM above the local mesh ground (0..1). */
  share3dLocal: number | null;
  /** Same, roof vs terrain model height (the PRD-card metric; biased by mesh/terrain offsets). */
  share3dTerrain: number | null;
  /** Median roof minus local mesh ground, metres. */
  medianLocalM: number | null;
  /** Median roof minus terrain height, metres. */
  medianTerrainM: number | null;
};

export const MIN_BUILDING_M = 3;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function stage1(samples: BuildingSample[], minM = MIN_BUILDING_M): Stage1 {
  const local = samples.filter((s) => s.roof !== undefined && s.localGround !== undefined).map((s) => s.roof! - s.localGround!);
  const terr = samples.filter((s) => s.roof !== undefined && s.terrain !== undefined).map((s) => s.roof! - s.terrain!);
  const share = (d: number[]) => (d.length ? d.filter((x) => x >= minM).length / d.length : null);
  return { buildingsSampled: samples.length, share3dLocal: share(local), share3dTerrain: share(terr), medianLocalM: median(local), medianTerrainM: median(terr) };
}

/**
 * Relief grid: points every `stepM` over a square of half-size `halfM`, each with a 6-point ring of `ringM`. Works with
 * no OSM buildings. A draped/flat mesh gives ~0 everywhere; buildings and trees both raise it (screenshots tell them apart).
 */
export function reliefGrid(lon: number, lat: number, halfM = 240, stepM = 40, ringM = 15) {
  const centres: [number, number][] = [];
  for (let e = -halfM; e <= halfM; e += stepM) for (let n = -halfM; n <= halfM; n += stepM) centres.push(offsetM(lon, lat, e, n));
  return { centres, rings: centres.flatMap(([x, y]) => groundRing({ lon: x, lat: y, radiusM: 0 }, 6, ringM)) };
}

/** Share of relief-grid points >= minM above their ring's lowest point, and the 90th percentile of that rise. */
export function reliefStats(centreH: (number | undefined)[], ringH: (number | undefined)[], minM = MIN_BUILDING_M) {
  const d: number[] = [];
  centreH.forEach((h, i) => {
    const r = ringH.slice(i * 6, i * 6 + 6).filter((x): x is number => x !== undefined);
    if (h !== undefined && r.length) d.push(h - Math.min(...r));
  });
  d.sort((a, b) => a - b);
  return { reliefShare3: d.length ? d.filter((x) => x >= minM).length / d.length : null, reliefP90M: d.length ? d[Math.floor(d.length * 0.9)] : null };
}

const M_PER_DEG = 111320;

/** Offset a lon/lat by east/north metres (small distances). */
export function offsetM(lon: number, lat: number, eastM: number, northM: number): [number, number] {
  return [lon + eastM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180)), lat + northM / M_PER_DEG];
}

/** Points on a ring just outside a building, where the mesh should show bare ground. */
export function groundRing(b: BuildingPoint, n = 6, marginM = 8): [number, number][] {
  const r = b.radiusM + marginM;
  return Array.from({ length: n }, (_, i) => offsetM(b.lon, b.lat, r * Math.sin((2 * Math.PI * i) / n), r * Math.cos((2 * Math.PI * i) / n)));
}

/**
 * Camera that looks at a ground point from `rangeM` away at `pitchDeg` (negative = looking down) and `headingDeg`,
 * as a CameraState (degrees, metres).
 */
export function orbitCamera(t: { lon: number; lat: number; ground: number }, rangeM: number, pitchDeg: number, headingDeg: number) {
  const p = (Math.abs(pitchDeg) * Math.PI) / 180;
  const h = (headingDeg * Math.PI) / 180;
  const d = rangeM * Math.cos(p);
  const [lon, lat] = offsetM(t.lon, t.lat, -d * Math.sin(h), -d * Math.cos(h));
  return { lon, lat, height: t.ground + rangeM * Math.sin(p), heading: headingDeg, pitch: pitchDeg };
}

/** Great-circle distance, km. */
export function distanceKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const r = Math.PI / 180;
  const s = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Buildings from an Overpass `out geom` JSON answer (ways with a `geometry` list of lat/lon nodes). */
export function buildingsFromOverpass(json: { elements?: { geometry?: { lat: number; lon: number }[] }[] }): BuildingPoint[] {
  return (json.elements ?? [])
    .filter((e) => (e.geometry?.length ?? 0) >= 3)
    .map((e) => {
      const g = e.geometry!;
      const lat = g.reduce((a, p) => a + p.lat, 0) / g.length;
      const lon = g.reduce((a, p) => a + p.lon, 0) / g.length;
      const lats = g.map((p) => p.lat);
      const lons = g.map((p) => p.lon);
      const hM = (Math.max(...lats) - Math.min(...lats)) * M_PER_DEG;
      const wM = (Math.max(...lons) - Math.min(...lons)) * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
      return { lon, lat, radiusM: Math.max(hM, wM) / 2 };
    });
}

type OsmApiElement = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> };

/** Buildings from an OSM API 0.6 `map.json` answer (nodes and ways by reference). https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box:_GET_/api/0.6/map */
export function buildingsFromOsmApi(json: { elements?: OsmApiElement[] }): BuildingPoint[] {
  const els = json.elements ?? [];
  const nodes = new Map(els.filter((e) => e.type === "node").map((e) => [e.id, { lat: e.lat!, lon: e.lon! }]));
  const ways = els.filter((e) => e.type === "way" && e.tags?.building && e.nodes);
  return buildingsFromOverpass({ elements: ways.map((w) => ({ geometry: w.nodes!.map((id) => nodes.get(id)).filter((p): p is { lat: number; lon: number } => !!p) })) });
}

/** OSM API bbox [w,s,e,n] covering `radiusM` around a point (the API caps a request at 0.25 deg²). */
export const osmApiBbox = (lon: number, lat: number, radiusM: number) => {
  const [w, s] = offsetM(lon, lat, -radiusM, -radiusM);
  const [e, n] = offsetM(lon, lat, radiusM, radiusM);
  return `${w.toFixed(5)},${s.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}`;
};

/** Overpass QL: building ways within `radiusM` of a point, with node geometry. https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL */
export const overpassQuery = (lon: number, lat: number, radiusM: number, max = 150) => `[out:json][timeout:25];way["building"](around:${radiusM},${lat},${lon});out geom ${max};`;

export const fmtShare = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)} %`);
export const fmtM = (x: number | null) => (x === null ? "n/a" : `${x.toFixed(1)} m`);
