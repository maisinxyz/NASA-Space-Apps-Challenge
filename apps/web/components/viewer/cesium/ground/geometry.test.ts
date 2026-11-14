import { describe, expect, it } from "vitest";

import { clipRingToBbox, heightsToRgba, indexToCoverage, lonLatToUv, pointInRing, rasterizeFieldIndex, ringsInBbox, type Bbox } from "./geometry";

const bbox: Bbox = [10, 50, 11, 51];
const sq = (w: number, s: number, e: number, n: number): [number, number][] => [[w, s], [e, s], [e, n], [w, n]];

describe("geometry", () => {
  it("lonLatToUv corners and centre (v south->north)", () => {
    expect(lonLatToUv(bbox, 10, 50)).toEqual([0, 0]);
    expect(lonLatToUv(bbox, 11, 51)).toEqual([1, 1]);
    expect(lonLatToUv(bbox, 10.5, 50.5)).toEqual([0.5, 0.5]);
  });
  it("ringsInBbox keeps intersecting rings only", () => {
    const inside = sq(10.2, 50.2, 10.3, 50.3);
    const straddle = sq(10.9, 50.9, 11.5, 51.5);
    const outside = sq(20, 20, 21, 21);
    expect(ringsInBbox([inside, straddle, outside, [[10, 50]]], bbox)).toEqual([inside, straddle]);
  });
  it("pointInRing", () => {
    const r = sq(0, 0, 2, 2);
    expect(pointInRing(r, 1, 1)).toBe(true);
    expect(pointInRing(r, 3, 1)).toBe(false);
  });
  it("clipRingToBbox clips and drops outside rings", () => {
    const c = clipRingToBbox(sq(10.9, 50.9, 11.5, 51.5), bbox);
    expect(c.every(([x, y]) => x <= 11 && y <= 51)).toBe(true);
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(clipRingToBbox(sq(20, 20, 21, 21), bbox).length).toBeLessThan(3);
  });
  it("rasterizeFieldIndex: indices and outside zeros", () => {
    const f = [{ ring: sq(10, 50, 10.5, 50.5) }, { ring: sq(10.5, 50.5, 11, 51) }];
    const r = rasterizeFieldIndex(f, bbox, 8);
    expect(r[0 * 8 + 0]).toBe(1); // south-west
    expect(r[7 * 8 + 7]).toBe(2); // north-east
    expect(r[0 * 8 + 7]).toBe(0); // south-east outside
    expect(r[7 * 8 + 0]).toBe(0);
  });
  it("more than 8 fields: extras ignored, no throw", () => {
    const f = Array.from({ length: 12 }, () => ({ ring: sq(10, 50, 11, 51) }));
    const r = rasterizeFieldIndex(f, bbox, 4);
    expect(Math.max(...r)).toBe(8);
  });
  it("coverage planes hold slots 3p..3p+2", () => {
    const idx = Uint8Array.from([1, 4, 8, 0]);
    expect([...indexToCoverage(idx, 0)].slice(0, 4)).toEqual([255, 0, 0, 255]);
    expect([...indexToCoverage(idx, 1)].slice(4, 8)).toEqual([255, 0, 0, 255]);
    expect([...indexToCoverage(idx, 2)].slice(8, 12)).toEqual([0, 255, 0, 255]);
    expect([...indexToCoverage(idx, 0)].slice(12, 16)).toEqual([0, 0, 0, 255]);
  });
  it("heightsToRgba: flat is mid-grey, slope normalised with downhill gradient", () => {
    expect([...heightsToRgba(new Float32Array(4), 2)].slice(0, 4)).toEqual([128, 128, 128, 255]);
    const n = 4;
    const h = Float32Array.from({ length: 16 }, (_, i) => (i % n) * 2); // rises to the east
    const out = heightsToRgba(h, n);
    expect(out[0]).toBe(0);
    expect(out[(n - 1) * 4]).toBe(255);
    expect(out[1 * 4 + 1]).toBeLessThan(128); // downhill = west (negative u)
  });
});
