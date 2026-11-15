import { describe, expect, it } from "vitest";

import type { Zone } from "@/lib/rotation/draft-types";

import { buildZoneOverlay, inPolygon, rasteriseZones, zonesBbox } from "./zones";

const zone = (id: string, x0: number, y0: number, x1: number, y1: number, tf: number): Zone => ({
  id,
  outline: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
  icon_point: [x0, y0],
  area_ha: 1,
  terrain_factor: tf,
  field_id: null,
  crop: null,
  winter_exposure: null,
  summer_exposure: null,
  basis: "derived",
});

describe("zones rasteriser", () => {
  it("is a no-op for empty or missing zones", () => {
    expect(buildZoneOverlay([])).toBeNull();
    expect(buildZoneOverlay(undefined)).toBeNull();
    expect(buildZoneOverlay(null)).toBeNull();
    expect(zonesBbox([])).toBeNull();
  });
  it("returns null without a DOM even for real zones (no throw)", () => {
    expect(buildZoneOverlay([zone("a", 0, 0, 1, 1, 1)])).toBeNull();
  });
  it("computes the union bbox", () => {
    expect(zonesBbox([zone("a", 0, 0, 1, 1, 1), zone("b", 2, -1, 3, 0.5, 2)])).toEqual([0, -1, 3, 1]);
  });
  it("point in polygon, with a hole", () => {
    const ring: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
    const hole: [number, number][] = [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]];
    expect(inPolygon(0.5, 0.5, [ring, hole])).toBe(true);
    expect(inPolygon(2, 2, [ring, hole])).toBe(false);
    expect(inPolygon(5, 5, [ring])).toBe(false);
  });
  it("paints only inside the polygon, north-up, coloured by relative terrain factor", () => {
    // Left half low factor, right half high factor; a 4x2 grid over [0,0,4,2].
    const zs = [zone("lo", 0, 0, 2, 2, 1), zone("hi", 2, 0, 4, 2, 5)];
    const px = rasteriseZones(zs, [0, 0, 4, 2], 4, 2);
    expect([px[3], px[4 * 4 - 1]]).toEqual([200, 200]);
    expect(px[0]).toBeLessThan(px[3 * 4]); // red channel rises low to high
    const half = rasteriseZones([zone("lo", 0, 0, 2, 2, 1)], [0, 0, 4, 2], 4, 2);
    expect(half[3 * 4 + 3]).toBe(0); // outside = transparent
  });
});
