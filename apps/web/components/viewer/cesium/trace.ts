// Pure helpers for the dev field tracer (/dev/trace): ring area, square bbox, TS / GeoJSON export. No Cesium import.
import { fromOffsetM, type LonLat, offsetM } from "./clamp";

export type Ring = [number, number][];

/** Planar (local equirectangular) area of a ring of [lon, lat], hectares. Fine for fields of a few km. */
export function ringAreaHa(ring: Ring): number {
  if (ring.length < 3) return 0;
  const c = { lon: ring[0][0], lat: ring[0][1] };
  const p = ring.map(([lon, lat]) => offsetM({ lon, lat }, c));
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return Math.abs(a) / 2 / 1e4;
}

/** A square of `sideM` metres (square in metres, not degrees) centred on `c`: [west, south, east, north]. */
export function squareBbox(c: LonLat, sideM: number): [number, number, number, number] {
  const sw = fromOffsetM(c, { x: -sideM / 2, y: -sideM / 2 });
  const ne = fromOffsetM(c, { x: sideM / 2, y: sideM / 2 });
  return [sw.lon, sw.lat, ne.lon, ne.lat];
}

const r6 = (v: number) => Number(v.toFixed(6));

/** Rings as a TS literal: `[lon, lat][]` per ring, 6 decimals (~0.1 m). */
export function ringsToTs(rings: Ring[]): string {
  return `[\n${rings.map((r) => `  [${r.map(([x, y]) => `[${r6(x)}, ${r6(y)}]`).join(", ")}],`).join("\n")}\n]`;
}

/** Rings as a GeoJSON FeatureCollection of closed Polygons (first point repeated, as GeoJSON requires). */
export function ringsToGeoJson(rings: Ring[]): string {
  const features = rings.map((r, i) => ({
    type: "Feature",
    properties: { id: `f${i + 1}`, areaHa: Number(ringAreaHa(r).toFixed(2)) },
    geometry: { type: "Polygon", coordinates: [[...r, r[0]].map(([x, y]) => [r6(x), r6(y)])] },
  }));
  return JSON.stringify({ type: "FeatureCollection", features });
}
