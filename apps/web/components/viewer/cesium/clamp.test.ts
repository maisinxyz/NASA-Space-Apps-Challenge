import { describe, expect, it } from "vitest";
import {
  boxOfBbox,
  boxOfRadius,
  cameraFromOrbit,
  clampOrbit,
  clampTarget,
  fromOffsetM,
  localMorningUtcMs,
  MAX_PITCH_RAD,
  MAX_RANGE_M,
  MIN_PITCH_RAD,
  MIN_RANGE_M,
  offsetM,
  orbitFromCamera,
} from "./clamp";

const bbox: [number, number, number, number] = [-121.765, 49.238, -121.755, 49.246];

describe("camera pose <-> orbit", () => {
  const target = { lon: -121.76, lat: 49.24 };
  it("puts the camera behind and above the target (Cesium lookAt convention)", () => {
    const c = cameraFromOrbit(target, 10, { heading: 0, pitch: -Math.PI / 4, range: 1000 });
    expect(c.height).toBeCloseTo(10 + 1000 * Math.SQRT1_2, 6);
    expect(c.lat).toBeLessThan(target.lat); // heading north: camera south of the target
    expect(c.lon).toBeCloseTo(target.lon, 9);
    expect(c.heading).toBeCloseTo(0, 9);
    expect(c.pitch).toBeCloseTo(-45, 9);
  });
  it("round-trips orbit -> camera -> orbit", () => {
    const o = { heading: 2.1, pitch: -0.6, range: 1400 };
    const back = orbitFromCamera(cameraFromOrbit(target, 12, o), 12);
    expect(back.o.heading).toBeCloseTo(o.heading, 9);
    expect(back.o.pitch).toBeCloseTo(o.pitch, 9);
    expect(back.o.range).toBeCloseTo(o.range, 3);
    expect(offsetM(back.target, target).x).toBeCloseTo(0, 2);
    expect(offsetM(back.target, target).y).toBeCloseTo(0, 2);
  });
  it("limits the pitch of a pose that looks at the horizon", () => {
    expect(orbitFromCamera({ ...target, height: 500, heading: 0, pitch: 0 }, 0).o.pitch).toBe(MAX_PITCH_RAD);
  });
});

describe("box + offsets", () => {
  it("round-trips lon/lat through metres", () => {
    const c = { lon: -121.76, lat: 49.24 };
    const back = fromOffsetM(c, offsetM({ lon: -121.75, lat: 49.25 }, c));
    expect(back.lon).toBeCloseTo(-121.75, 9);
    expect(back.lat).toBeCloseTo(49.25, 9);
  });
  it("builds a centred box from a bbox", () => {
    const b = boxOfBbox(bbox);
    expect(b.lon).toBeCloseTo(-121.76, 9);
    expect(b.halfY).toBeCloseTo(0.004 * (Math.PI / 180) * 6378137, 3);
    expect(b.halfX).toBeGreaterThan(300);
  });
  it("antimeridian offsets stay small", () => {
    expect(Math.abs(offsetM({ lon: -179.999, lat: 0 }, { lon: 179.999, lat: 0 }).x)).toBeLessThan(300);
  });
  it("radius fallback is inscribed in the circle", () => {
    const b = boxOfRadius({ lon: 0, lat: 0 }, 1000);
    expect(Math.hypot(b.halfX, b.halfY)).toBeCloseTo(1000, 6);
  });
});

describe("clampTarget (hard stop)", () => {
  const box = { halfX: 300, halfY: 200 };
  it("leaves inside points alone and clips outside ones", () => {
    expect(clampTarget({ x: 10, y: -20 }, box)).toEqual({ x: 10, y: -20 });
    expect(clampTarget({ x: 999, y: -999 }, box)).toEqual({ x: 300, y: -200 });
  });
});

describe("clampOrbit", () => {
  it("limits range, pitch and wraps heading", () => {
    expect(clampOrbit({ heading: 0, pitch: -0.5, range: 10 }).range).toBe(MIN_RANGE_M);
    expect(clampOrbit({ heading: 0, pitch: -0.5, range: 1e6 }).range).toBe(MAX_RANGE_M);
    expect(clampOrbit({ heading: 0, pitch: 0, range: 500 }).pitch).toBe(MAX_PITCH_RAD);
    expect(clampOrbit({ heading: 0, pitch: -3, range: 500 }).pitch).toBe(MIN_PITCH_RAD);
    expect(clampOrbit({ heading: -Math.PI / 2, pitch: -0.5, range: 500 }).heading).toBeCloseTo(1.5 * Math.PI, 9);
  });
  it("leaves a valid orbit untouched", () => {
    const o = { heading: 1, pitch: -0.7, range: 800 };
    expect(clampOrbit(o)).toEqual(o);
  });
  it("tilts down to keep the camera above the ground floor", () => {
    const o = clampOrbit({ heading: 0, pitch: MAX_PITCH_RAD, range: 200 }, 100);
    expect(200 * Math.sin(-o.pitch)).toBeGreaterThanOrEqual(100 - 1e-9);
  });
});

describe("localMorningUtcMs", () => {
  it("is 10:00 local solar time, deterministic", () => {
    expect(new Date(localMorningUtcMs(0)).toISOString()).toBe("2026-06-21T10:00:00.000Z");
    expect(new Date(localMorningUtcMs(-120)).toISOString()).toBe("2026-06-21T18:00:00.000Z");
    expect(localMorningUtcMs(15)).toBe(localMorningUtcMs(15));
  });
});
