import { describe, expect, it } from "vitest";
import { clampCamera, easeToward, horizontalDistanceM, MAX_HEIGHT_ABOVE_GROUND_M, MIN_HEIGHT_ABOVE_GROUND_M } from "./clamp";

const farm = { lon: -121.76, lat: 49.24, radiusM: 1000 };

describe("clampCamera", () => {
  it("leaves a camera inside the area untouched", () => {
    const pos = { lon: -121.757, lat: 49.242, height: 600 };
    expect(clampCamera(pos, farm, 100)).toEqual(pos);
  });

  it("pulls a camera outside the radius back onto the circle on the same bearing", () => {
    const pos = { lon: -121.70, lat: 49.27, height: 500 };
    const before = horizontalDistanceM(pos, farm);
    expect(before).toBeGreaterThan(farm.radiusM);
    const out = clampCamera(pos, farm);
    expect(horizontalDistanceM(out, farm)).toBeCloseTo(farm.radiusM, 3);
    const bearing = (p: { lon: number; lat: number }) => Math.atan2(p.lat - farm.lat, p.lon - farm.lon);
    expect(bearing(out)).toBeCloseTo(bearing(pos), 9);
    expect(out.height).toBe(500);
  });

  it("limits height relative to the ground under the camera", () => {
    expect(clampCamera({ ...farm, height: 105 }, farm, 100).height).toBe(100 + MIN_HEIGHT_ABOVE_GROUND_M);
    expect(clampCamera({ ...farm, height: -50 }, farm, 0).height).toBe(MIN_HEIGHT_ABOVE_GROUND_M);
    expect(clampCamera({ ...farm, height: 9000 }, farm, 100).height).toBe(100 + MAX_HEIGHT_ABOVE_GROUND_M);
  });

  it("handles the antimeridian", () => {
    const area = { lon: 179.999, lat: 0, radiusM: 500 };
    const out = clampCamera({ lon: -179.99, lat: 0, height: 100 }, area);
    expect(horizontalDistanceM(out, area)).toBeCloseTo(500, 3);
  });
});

describe("easeToward", () => {
  const a = { lon: 0, lat: 0, height: 0 };
  const b = { lon: 1, lat: 2, height: 100 };
  it("does not move at dt 0 and converges for large dt", () => {
    expect(easeToward(a, b, 0)).toEqual(a);
    const far = easeToward(a, b, 10);
    expect(far.height).toBeCloseTo(100, 6);
    expect(far.lat).toBeCloseTo(2, 6);
  });
  it("moves part of the way in one frame (eases, no hard stop)", () => {
    const h = easeToward(a, b, 1 / 60).height;
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(50);
  });
});
