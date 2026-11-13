import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { diffMm } from "@/lib/decode/diff";
import { decodeGray8 } from "@/lib/decode/layer";
import { buildLut, DIFF_LUT_ROW } from "./luts";
import { downsampleFrames, frameCoord, splitPlan, terraformAt, TERRAFORM_SECONDS } from "./timing";

const FIXTURES = resolve(__dirname, "../../../../packages/contracts/fixtures");
const read = (rel: string) => new Uint8Array(readFileSync(resolve(FIXTURES, rel)));
const json = <T>(rel: string) => JSON.parse(readFileSync(resolve(FIXTURES, rel), "utf8")) as T;

describe("water frame lookup", () => {
  const times = Array.from({ length: 60 }, (_, i) => i * 72);

  it("interpolates between the two nearest frames and clamps", () => {
    expect(frameCoord(times, 0)).toBe(0);
    expect(frameCoord(times, 72 * 12)).toBe(12);
    expect(frameCoord(times, 72 * 12 + 18)).toBeCloseTo(12.25, 9);
    expect(frameCoord(times, -5)).toBe(0);
    expect(frameCoord(times, 1e9)).toBe(59);
  });

  it("handles uneven frame times and degenerate lists", () => {
    expect(frameCoord([0, 10, 40], 25)).toBeCloseTo(1.5, 9);
    expect(frameCoord([], 5)).toBe(0);
    expect(frameCoord([7], 5)).toBe(0);
  });

  it("scrubbing 0..59 is monotonic with no jumps larger than the scrub step", () => {
    let prev = 0;
    for (let t = 0; t <= 59 * 72; t += 9) {
      const f = frameCoord(times, t);
      expect(f - prev).toBeGreaterThanOrEqual(0);
      expect(f - prev).toBeLessThanOrEqual(0.125 + 1e-9);
      prev = f;
    }
  });

  it("low-tier downsample keeps empty cells empty and wet cells wet", () => {
    const d = downsampleFrames(new Uint8Array([0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 4, 4, 1);
    expect([d.width, d.height]).toEqual([2, 2]);
    expect(Array.from(d.frames)).toEqual([0, 9, 0, 0]);
  });
});

describe("A/B split stays in sync", () => {
  it("both sides get the same time and frame coordinate for 60 frames, and tile the canvas", () => {
    const times = Array.from({ length: 60 }, (_, i) => i * 72);
    for (let i = 0; i < 60; i++) {
      const timeMin = i * 71.3;
      const [a, b] = splitPlan(1920, "split", 0.5, timeMin, [times, times]);
      expect(a.timeMin).toBe(timeMin);
      expect(b.timeMin).toBe(a.timeMin);
      expect(b.frame).toBe(a.frame);
      expect(a.x + a.width).toBe(b.x);
      expect(b.x + b.width).toBe(1920);
      expect([a.side, b.side]).toEqual([0, 1]);
    }
    expect(splitPlan(1920, "single", 0.5, 10, [times])).toHaveLength(1);
  });
});

describe("terraform", () => {
  it("is deterministic, monotonic, and done at about 2.5 s", () => {
    expect(terraformAt(0)).toEqual({ rise: 0, imagery: 0, settle: 0, done: false });
    expect(terraformAt(TERRAFORM_SECONDS)).toEqual({ rise: 1, imagery: 1, settle: 1, done: true });
    expect(terraformAt(1.1)).toEqual(terraformAt(1.1));
    let prev = 0;
    for (let t = 0; t <= 2.5; t += 0.1) {
      expect(terraformAt(t).rise).toBeGreaterThanOrEqual(prev);
      prev = terraformAt(t).rise;
    }
  });
});

describe("diff glow encoding", () => {
  it("LUT: 128 is transparent, sign picks the hue, magnitude grows the alpha", () => {
    const lut = buildLut([], 256);
    const px = (b: number) => Array.from(lut.subarray((DIFF_LUT_ROW * 256 + b) * 4, (DIFF_LUT_ROW * 256 + b) * 4 + 4));
    expect(px(128)[3]).toBe(0);
    expect(px(255)[2]).toBeGreaterThan(px(255)[0]); // wetter: purple, blue channel dominates
    expect(px(1)[0]).toBeGreaterThan(px(1)[2]); // drier: orange, red channel dominates
    expect(px(255)[3]).toBeGreaterThan(px(160)[3]);
    expect(px(1)[3]).toBeGreaterThan(px(96)[3]);
  });

  it("the mock diff fixture decodes to the sign and scale DiffStats reports", () => {
    const stats = json<{ max_abs_diff_mm: number; mean_diff_mm: number }>("simulations/sim_mock_001/diff/rot_existing__rot_cover.json");
    const grid = decodeGray8(read("simulations/sim_mock_001/diff/rot_existing__rot_cover.png"));
    let sum = 0;
    let maxAbs = 0;
    for (const b of grid.data) {
      const mm = diffMm(b, stats.max_abs_diff_mm);
      sum += mm;
      maxAbs = Math.max(maxAbs, Math.abs(mm));
    }
    expect(Math.sign(sum)).toBe(Math.sign(stats.mean_diff_mm)); // cover is drier than existing
    expect(maxAbs).toBeLessThanOrEqual(stats.max_abs_diff_mm + 1e-6);
    expect(maxAbs).toBeGreaterThan(stats.max_abs_diff_mm * 0.9);
  });
});
