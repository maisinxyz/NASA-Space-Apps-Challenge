import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { TerrainPackage } from "../api/types";
import { byteToDepthMm, frameAt, FTW1_HEADER_BYTES, parseFtw1 } from "./ftw1";
import { decodeHeightmap } from "./heightmap";

const FIXTURES = resolve(__dirname, "../../../../packages/contracts/fixtures");
const read = (rel: string) => new Uint8Array(readFileSync(resolve(FIXTURES, rel)));
const pkg = (id: string) => JSON.parse(readFileSync(resolve(FIXTURES, `terrain/${id}/terrain.json`), "utf8")) as TerrainPackage;

describe("decodeHeightmap", () => {
  it("keeps 16-bit precision and the min/max from the package", () => {
    const t = pkg("terr_mock_hills");
    const hm = decodeHeightmap(read("terrain/terr_mock_hills/heightmap.png"), t.elevation.min_m, t.elevation.max_m);
    expect(hm.width).toBe(t.grid.width);
    expect(hm.height).toBe(t.grid.height);
    const values = Array.from(hm.elevations);
    expect(Math.min(...values)).toBeCloseTo(t.elevation.min_m, 3);
    expect(Math.max(...values)).toBeCloseTo(t.elevation.max_m, 3);
    expect(new Set(values).size).toBeGreaterThan(1000); // would collapse to <=256 if decoded as 8-bit
  });

  it("decodes the tilted plane as a plane", () => {
    const t = pkg("terr_mock_tilted");
    const { width, height, elevations } = decodeHeightmap(read("terrain/terr_mock_tilted/heightmap.png"), t.elevation.min_m, t.elevation.max_m);
    const cell = t.grid.cell_size_m;
    const z = (row: number, col: number) => elevations[row * width + col];
    // Row 0 is north: moving east raises z by 0.05 m/m, moving north by 0.02 m/m.
    const dEast = (z(0, width - 1) - z(0, 0)) / ((width - 1) * cell);
    const dNorth = (z(0, 0) - z(height - 1, 0)) / ((height - 1) * cell);
    expect(dEast).toBeCloseTo(0.05, 4);
    expect(dNorth).toBeCloseTo(0.02, 4);
    let maxResidual = 0;
    for (let r = 0; r < height; r += 7) {
      for (let c = 0; c < width; c += 7) {
        const planeZ = z(height - 1, 0) + dEast * c * cell + dNorth * (height - 1 - r) * cell;
        maxResidual = Math.max(maxResidual, Math.abs(z(r, c) - planeZ));
      }
    }
    expect(maxResidual).toBeLessThan(0.01);
  });

  it("rejects an 8-bit PNG", () => {
    expect(() => decodeHeightmap(read("terrain/terr_mock_hills/layers/slope.png"), 0, 1)).toThrow(/16-bit/);
  });
});

describe("parseFtw1", () => {
  it("parses the fixture header exactly", () => {
    const bytes = read("simulations/sim_mock_001/frames/rot_existing.bin");
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("FTW1");
    const f = parseFtw1(bytes);
    expect(f.width).toBe(view.getUint16(4, true));
    expect(f.width).toBe(256);
    expect(f.height).toBe(256);
    expect(f.frameCount).toBe(60);
    expect(bytes[10]).toBe(1);
    expect(f.maxDepthMm).toBe(view.getFloat32(12, true));
    expect(f.frames.byteLength).toBe(bytes.byteLength - FTW1_HEADER_BYTES);
    expect(byteToDepthMm(f, 255)).toBeCloseTo(f.maxDepthMm, 5);
    expect(frameAt(f, 59).byteLength).toBe(256 * 256);
  });

  it("rejects bad magic and wrong length", () => {
    const bytes = read("simulations/sim_mock_001/frames/rot_cover.bin").slice();
    expect(() => parseFtw1(bytes.subarray(0, 100))).toThrow(/expected/);
    bytes[0] = 0x58;
    expect(() => parseFtw1(bytes)).toThrow(/magic/);
  });
});
