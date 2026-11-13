import { describe, expect, it } from "vitest";
import { frameToRgba } from "./drape";

// 2x1 frames: pixel 0 goes 0 -> 200, pixel 1 stays dry.
const frames = [Uint8Array.of(0, 0), Uint8Array.of(200, 0), Uint8Array.of(255, 0)];
const alpha = (coord: number, px = 0) => frameToRgba(frames, 2, 1, coord)[px * 4 + 3];

describe("frameToRgba", () => {
  it("fills a width*height*4 buffer and reuses the one passed in", () => {
    const out = new Uint8ClampedArray(8);
    expect(frameToRgba(frames, 2, 1, 1, out)).toBe(out);
    expect(frameToRgba(frames, 2, 1, 1)).toHaveLength(8);
  });
  it("keeps dry cells fully transparent and wet cells visible", () => {
    expect(alpha(0)).toBe(0);
    expect(alpha(1, 1)).toBe(0);
    expect(alpha(1)).toBeGreaterThan(80);
  });
  it("interpolates between neighbouring frames", () => {
    const half = alpha(0.5);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(alpha(1));
    expect(alpha(1.5)).toBeGreaterThan(alpha(1));
    expect(alpha(1.5)).toBeLessThan(alpha(2));
  });
  it("gets bluer (less red) as depth grows", () => {
    expect(frameToRgba(frames, 2, 1, 2)[0]).toBeLessThan(frameToRgba(frames, 2, 1, 1)[0]);
  });
  it("clamps out-of-range coordinates and tolerates no frames", () => {
    expect(alpha(-3)).toBe(alpha(0));
    expect(alpha(99)).toBe(alpha(2));
    expect(Array.from(frameToRgba([], 2, 1, 0))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
