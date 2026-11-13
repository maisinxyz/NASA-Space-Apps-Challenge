import { describe, expect, it } from "vitest";

import { meanInPolygon } from "./fieldStats";

describe("meanInPolygon", () => {
  // 4x4 grid over bbox [0,0,4,4]: row 0 = north. Bytes 0..254 map to 0..90 degrees.
  const data = new Uint8Array(16).fill(254);
  data[12] = 0; // row 3 (south), col 0
  data[13] = 255; // nodata, row 3 col 1
  const r = { width: 4, height: 4, data };

  it("averages only cells whose centres are inside, skipping nodata", () => {
    const southWest = [[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]; // covers row 3, cols 0-1
    expect(meanInPolygon(r, [0, 0, 4, 4], southWest, [0, 90])).toEqual({ mean: 0, cells: 1 });
    const all = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
    expect(meanInPolygon(r, [0, 0, 4, 4], all, [0, 90])?.cells).toBe(15);
  });

  it("returns null when the polygon holds no valid cell", () => {
    expect(meanInPolygon(r, [0, 0, 4, 4], [[10, 10], [11, 10], [11, 11], [10, 10]], [0, 90])).toBeNull();
  });
});
