import { describe, expect, it } from "vitest";

import { boxOfBbox, fromOffsetM } from "./clamp";
import { ringAreaHa, ringsToGeoJson, ringsToTs, squareBbox } from "./trace";

const c = { lon: -76.25, lat: 42.44 };
const sq = (m: number): [number, number][] =>
  [[0, 0], [m, 0], [m, m], [0, m]].map(([x, y]) => {
    const p = fromOffsetM(c, { x, y });
    return [p.lon, p.lat];
  });

describe("trace helpers", () => {
  it("ring area in hectares, either winding", () => {
    expect(ringAreaHa(sq(100))).toBeCloseTo(1, 3);
    expect(ringAreaHa(sq(100).reverse())).toBeCloseTo(1, 3);
    expect(ringAreaHa(sq(100).slice(0, 2))).toBe(0);
  });
  it("square bbox is square in metres", () => {
    const b = boxOfBbox(squareBbox(c, 1300));
    expect(b.halfX).toBeCloseTo(650, 3);
    expect(b.halfY).toBeCloseTo(650, 3);
  });
  it("exports TS with 6 decimals and closed GeoJSON polygons", () => {
    expect(ringsToTs([[[-76.1234567, 42.1]]])).toBe("[\n  [[-76.123457, 42.1]],\n]");
    const g = JSON.parse(ringsToGeoJson([sq(100)]));
    const ring = g.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[4]).toEqual(ring[0]);
    expect(g.features[0].properties.areaHa).toBeCloseTo(1, 2);
  });
});
