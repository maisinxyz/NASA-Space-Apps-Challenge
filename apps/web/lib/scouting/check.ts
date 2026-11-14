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

/** Overpass QL: building ways within `radiusM` of a point, with node geometry. https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL */
export const overpassQuery = (lon: number, lat: number, radiusM: number, max = 150) => `[out:json][timeout:25];way["building"](around:${radiusM},${lat},${lon});out geom ${max};`;

export const fmtShare = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)} %`);
export const fmtM = (x: number | null) => (x === null ? "n/a" : `${x.toFixed(1)} m`);
