import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { TerrainPackage } from "@/lib/api/types";
import { diffMm } from "@/lib/decode/diff";
import { decodeHeightmap } from "@/lib/decode/heightmap";
import { decodeGray8 } from "@/lib/decode/layer";
import { cropRowPoints, fieldAt, localToLonLat, lonLatToLocal, makeFrame, pickHeightfield, rasterizeFields, sampleHeight, terrainVertices, toLocalFields } from "./geo";
import { buildLut, DIFF_LUT_ROW } from "./luts";
import { downsampleFrames, frameCoord, splitPlan, terraformAt, TERRAFORM_SECONDS } from "./timing";
import type { FieldFeature } from "./types";

const FIXTURES = resolve(__dirname, "../../../../packages/contracts/fixtures");
const read = (rel: string) => new Uint8Array(readFileSync(resolve(FIXTURES, rel)));
const json = <T>(rel: string) => JSON.parse(readFileSync(resolve(FIXTURES, rel), "utf8")) as T;

const tilted = json<TerrainPackage>("terrain/terr_mock_tilted/terrain.json");
const frame = makeFrame(tilted);
const hm = decodeHeightmap(read("terrain/terr_mock_tilted/heightmap.png"), tilted.elevation.min_m, tilted.elevation.max_m);

describe("terrain mesh on the tilted plane", () => {
  const { positions } = terrainVertices(frame, hm);
  const ys = Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 1]);

  it("spans exactly 0 .. (max_m - min_m) in Y, so any exaggeration is a pure scale", () => {
    expect(Math.min(...ys)).toBeCloseTo(0, 3);
    expect(Math.max(...ys)).toBeCloseTo(tilted.elevation.max_m - tilted.elevation.min_m, 3);
  });

  it("is a ramp: +X is east (higher), -Z is north (higher)", () => {
    const W = frame.width;
    const y = (r: number, c: number) => positions[(r * W + c) * 3 + 1];
    expect(positions[(W - 1) * 3]).toBeGreaterThan(positions[0]); // column 0 = west = -X
    expect(positions[2]).toBeLessThan(positions[((frame.height - 1) * W) * 3 + 2]); // row 0 = north = -Z
    expect(y(0, W - 1) - y(0, 0)).toBeCloseTo(0.05 * (W - 1) * frame.cell, 1);
    expect(y(0, 0) - y(frame.height - 1, 0)).toBeCloseTo(0.02 * (frame.height - 1) * frame.cell, 1);
  });
});

describe("probe", () => {
  it("a vertical ray reads the decoded elevation of the cell under it", () => {
    for (const [r, c] of [[10, 20], [128, 128], [200, 31]]) {
      const x = (c + 0.5 - frame.width / 2) * frame.cell;
      const z = (r + 0.5 - frame.height / 2) * frame.cell;
      const hit = pickHeightfield(frame, hm, 1.5, x, 500, z, 0, -1, 0);
      expect(hit).not.toBeNull();
      expect(hit!.height + hm.minM).toBeCloseTo(hm.elevations[r * frame.width + c], 2);
    }
  });

  it("an oblique ray lands on the surface at the given exaggeration, and misses off the side", () => {
    const hit = pickHeightfield(frame, hm, 1.5, -400, 300, 400, 0.6, -0.5, -0.62)!;
    const t = (hit.x + 400) / 0.6;
    expect(300 - 0.5 * t).toBeCloseTo(sampleHeight(frame, hm, hit.x, hit.z) * 1.5, 0);
    expect(pickHeightfield(frame, hm, 1.5, 5000, 300, 5000, 0, -1, 0)).toBeNull();
  });

  it("lon/lat round-trips and the bbox corners map to the raster corners", () => {
    const [w, s, e, n] = tilted.bbox_wgs84;
    expect(lonLatToLocal(frame, w, n)).toEqual([-frame.sizeX / 2, -frame.sizeZ / 2]); // north-west
    const [lon, lat] = localToLonLat(frame, ...lonLatToLocal(frame, w + (e - w) * 0.3, s + (n - s) * 0.8));
    expect(lon).toBeCloseTo(w + (e - w) * 0.3, 9);
    expect(lat).toBeCloseTo(s + (n - s) * 0.8, 9);
  });
});

describe("fields (R1 mock)", () => {
  const { features } = JSON.parse(readFileSync(resolve(__dirname, "../../public/mock-extras/fields.json"), "utf8")) as { features: FieldFeature[] };
  const hills = makeFrame(json<TerrainPackage>("terrain/terr_mock_hills/terrain.json"));
  const fields = toLocalFields(hills, features);

  it("a point selects exactly the field that contains it; empty land selects none", () => {
    fields.forEach((f, i) => expect(fieldAt(fields, f.centroid[0], f.centroid[1])).toBe(i));
    expect(fieldAt(fields, hills.sizeX / 2 - 1, hills.sizeZ / 2 - 1)).toBe(-1);
  });

  it("the id raster agrees with point-in-polygon picking", () => {
    const res = 256;
    const { ids, distance } = rasterizeFields(hills, fields, res);
    fields.forEach((f, i) => {
      const c = Math.floor((f.centroid[0] / hills.sizeX + 0.5) * res);
      const r = Math.floor((f.centroid[1] / hills.sizeZ + 0.5) * res);
      expect(ids[(r * res + c) * 2]).toBe(i + 1);
      expect(distance[r * res + c]).toBe(255); // field centres are far from any edge
      // a vertex lies on the outline: distance about 0 and the nearest edge belongs to this field
      const vc = Math.floor((f.ring[0][0] / hills.sizeX + 0.5) * res);
      const vr = Math.floor((f.ring[0][1] / hills.sizeZ + 0.5) * res);
      expect(distance[vr * res + vc]).toBeLessThan(64);
      expect(ids[(vr * res + vc) * 2 + 1]).toBe(i + 1);
    });
    expect(ids[0]).toBe(0);
  });

  it("crop rows stay inside the field and under the cap", () => {
    const { points } = cropRowPoints(fields[0].ring, 4, 4, 300);
    expect(points.length / 2).toBeGreaterThan(50);
    expect(points.length / 2).toBeLessThanOrEqual(300);
    for (let i = 0; i < points.length; i += 2) expect(fieldAt(fields, points[i], points[i + 1])).toBe(0);
  });
});

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
