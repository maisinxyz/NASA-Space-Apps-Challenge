// A1 tests on fixtures generated in code (no files): 16x16 tilted plane, hand-made 3-frame FTW1, boundary bytes.
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";

import { diffMm } from "./diff";
import { byteToDepthMm, frameAt, parseFtw1 } from "./ftw1";
import { decodeHeightmap } from "./heightmap";
import { decodeGray8, layerValue } from "./layer";
import { decodeNormalMap, normalAt } from "./normal";
import { riskIndex } from "./risk";

const N = 16;

describe("16x16 tilted plane", () => {
  // Rises to the east and to the north; value 0 at the south-west corner, 65535 at the north-east corner.
  const data = new Uint16Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) data[r * N + c] = Math.round(((c + (N - 1 - r)) / (2 * (N - 1))) * 65535);
  const hm = decodeHeightmap(encode({ width: N, height: N, data, depth: 16, channels: 1 }), 100, 130);
  const z = (r: number, c: number) => hm.elevations[r * N + c];

  it("maps 0 and 65535 to min_m and max_m", () => {
    expect(z(N - 1, 0)).toBe(100);
    expect(z(0, N - 1)).toBe(130);
  });

  it("keeps row 0 = north and column 0 = west", () => {
    expect(z(0, 0)).toBeGreaterThan(z(N - 1, 0)); // north edge is higher than south
    expect(z(0, N - 1)).toBeGreaterThan(z(0, 0)); // east is higher than west
    expect(z(0, 0)).toBeCloseTo(115, 2);
  });
});

describe("FTW1, hand-made 3 frames", () => {
  const w = 2;
  const h = 2;
  const buf = new Uint8Array(16 + 3 * w * h);
  const view = new DataView(buf.buffer);
  buf.set([0x46, 0x54, 0x57, 0x31]); // "FTW1"
  view.setUint16(4, w, true);
  view.setUint16(6, h, true);
  view.setUint16(8, 3, true);
  view.setUint8(10, 1);
  view.setFloat32(12, 510, true);
  buf.set([0, 0, 0, 0, 1, 2, 3, 4, 255, 128, 0, 0], 16);

  it("parses header and frames in time order", () => {
    const f = parseFtw1(buf);
    expect([f.width, f.height, f.frameCount, f.maxDepthMm]).toEqual([2, 2, 3, 510]);
    expect(Array.from(frameAt(f, 1))).toEqual([1, 2, 3, 4]);
    expect(byteToDepthMm(f, 0)).toBe(0);
    expect(byteToDepthMm(f, 255)).toBe(510);
    expect(byteToDepthMm(f, frameAt(f, 2)[1])).toBe(256);
  });

  it("rejects an unsupported dtype", () => {
    const bad = buf.slice();
    bad[10] = 2;
    expect(() => parseFtw1(bad)).toThrow(/dtype/);
  });
});

describe("8-bit rasters", () => {
  it("layer bytes: 0 and 254 span the legend range, 255 is nodata", () => {
    expect(layerValue(0, [0, 30])).toBe(0);
    expect(layerValue(254, [0, 30])).toBe(30);
    expect(layerValue(127, [0, 30])).toBeCloseTo(15, 5);
    expect(layerValue(255, [0, 30])).toBeNull();
  });

  it("diff bytes: 128 is no change, 255 is +max, 1 is -max", () => {
    expect(diffMm(128, 400)).toBe(0);
    expect(diffMm(255, 400)).toBe(400);
    expect(diffMm(1, 400)).toBe(-400);
  });

  it("risk bytes: 0-100 index, 255 masked", () => {
    expect(riskIndex(0)).toBe(0);
    expect(riskIndex(100)).toBe(100);
    expect(riskIndex(255)).toBeNull();
  });

  it("decodes gray8 without touching bytes and rejects 16-bit", () => {
    const g = decodeGray8(encode({ width: 2, height: 2, data: new Uint8Array([0, 128, 254, 255]), depth: 8, channels: 1 }));
    expect(Array.from(g.data)).toEqual([0, 128, 254, 255]);
    expect(() => decodeGray8(encode({ width: 1, height: 1, data: new Uint16Array([1]), depth: 16, channels: 1 }))).toThrow(/8-bit/);
  });

  it("normal map: flat ground is straight up", () => {
    const m = decodeNormalMap(encode({ width: 1, height: 1, data: new Uint8Array([128, 128, 255]), depth: 8, channels: 3 }));
    const [e, n, u] = normalAt(m, 0, 0);
    expect(e).toBeCloseTo(0, 2);
    expect(n).toBeCloseTo(0, 2);
    expect(u).toBe(1);
    expect(m.rgba[3]).toBe(255);
  });
});
