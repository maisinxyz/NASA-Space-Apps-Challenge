// Small geometry helpers for the 2D map: the first-open view box, the drawn polygon, its area.
export type LonLat = [number, number];
export type Camera2D = { center: LonLat; zoom: number; bearing: number; pitch: number };

const R = 6_371_008.8; // mean Earth radius, m

/** [[west, south], [east, north]] of a square of side sizeM around (lon, lat). */
export function boxAround(lon: number, lat: number, sizeM: number): [LonLat, LonLat] {
  const dLat = (sizeM / 2 / R) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  return [[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]];
}

/** Geodesic-free planar area of a ring in hectares (equirectangular around the ring's mean latitude). Fine below a few km. */
export function ringAreaHa(ring: LonLat[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((a, p) => a + p[1], 0) / ring.length) * (Math.PI / 180);
  const xy = ring.map(([lon, lat]) => [((lon * Math.PI) / 180) * R * Math.cos(lat0), ((lat * Math.PI) / 180) * R]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2 / 10_000;
}

/** Closed ring (first point repeated) rounded to 6 decimals, as the API expects. */
export function closeRing(points: LonLat[]): LonLat[] {
  const r = points.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)] as LonLat);
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]);
  return r;
}

/** Each farm's last 2D camera, kept for the session (restored when 2D opens again). */
const saved = new Map<string, Camera2D>();
export const saveCamera = (farmId: string, c: Camera2D) => void saved.set(farmId, c);
export const savedCamera = (farmId: string) => saved.get(farmId) ?? null;
export const clearCamera = (farmId: string) => void saved.delete(farmId);

export const MAX_FIELD_HA = 200;
