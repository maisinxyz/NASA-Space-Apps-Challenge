import { describe, expect, it } from "vitest";
import {
  boxOfBbox,
  boxOfRadius,
  cameraFromOrbit,
  clampOrbit,
  clampTarget,
  fromOffsetM,
  groundHit,
  localMorningUtcMs,
  MAX_PITCH_RAD,
  MAX_RANGE_M,
  MIN_PITCH_RAD,
  MIN_RANGE_M,
  offsetM,
  orbitFromCamera,
  PAN_MARGIN_M,
  PAN_MARGIN_PRIVATE_M,
  panMarginFor,
  panTarget,
  startFraming,
  zoomTarget,
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
  it("grows the box by the margin", () => {
    expect(clampTarget({ x: 999, y: -999 }, box, 300)).toEqual({ x: 600, y: -500 });
  });
});

describe("panTarget (soft stop)", () => {
  const box = { halfX: 300, halfY: 200 };
  it("moves freely inside the square and inward from outside", () => {
    expect(panTarget({ x: 0, y: 0 }, { x: 50, y: -40 }, box, 300)).toEqual({ x: 50, y: -40 });
    expect(panTarget({ x: 500, y: 0 }, { x: -50, y: 0 }, box, 300)).toEqual({ x: 450, y: 0 });
  });
  it("slows outward movement beyond the edge and stops at square + margin", () => {
    const near = panTarget({ x: 310, y: 0 }, { x: 10, y: 0 }, box, 300).x - 310;
    const far = panTarget({ x: 550, y: 0 }, { x: 10, y: 0 }, box, 300).x - 550;
    expect(near).toBeLessThan(10);
    expect(far).toBeLessThan(near);
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 2000; i++) p = panTarget(p, { x: 20, y: 20 }, box, 300);
    expect(p.x).toBeLessThanOrEqual(600);
    expect(p.x).toBeGreaterThan(590);
    expect(p.y).toBeLessThanOrEqual(500);
    expect(panTarget({ x: 600, y: 0 }, { x: 50, y: 0 }, box, 300).x).toBe(600);
  });
  it("uses the small private-farmland margin", () => {
    expect(panMarginFor(250)).toBe(PAN_MARGIN_PRIVATE_M);
    expect(panMarginFor(undefined)).toBe(PAN_MARGIN_M);
    expect(panTarget({ x: 0, y: 0 }, { x: 999, y: 0 }, box, PAN_MARGIN_PRIVATE_M).x).toBe(350);
  });
});

describe("zoomTarget", () => {
  const box = { halfX: 300, halfY: 200 };
  it("keeps the ground point under the cursor when zooming in", () => {
    // cursor point at target + 100 east; halving the range: new offset 50 -> target moves 50 east.
    expect(zoomTarget({ x: 0, y: 0 }, { x: 100, y: 0 }, 800, 400, box, 300)).toEqual({ x: 50, y: 0 });
    const t = zoomTarget({ x: 10, y: 20 }, { x: -60, y: 80 }, 600, 300, box, 300);
    expect(t.x + -60 * 0.5).toBeCloseTo(10 - 60, 9);
    expect(t.y + 80 * 0.5).toBeCloseTo(20 + 80, 9);
  });
  it("drifts back to the centre when zooming out, fully at max range", () => {
    const t = zoomTarget({ x: 200, y: 0 }, { x: 0, y: 0 }, 500, 1000, box, 300);
    expect(t.x).toBeGreaterThan(0);
    expect(t.x).toBeLessThan(200);
    expect(zoomTarget({ x: 200, y: 100 }, { x: 50, y: 50 }, 500, MAX_RANGE_M, box, 300)).toEqual({ x: 0, y: 0 });
  });
  it("hard-stops at square + margin", () => {
    expect(zoomTarget({ x: 0, y: 0 }, { x: 5000, y: 0 }, 1000, 200, box, 300).x).toBe(600);
  });
});

describe("groundHit", () => {
  it("intersects the ground plane, rejects rays that miss or hit too far", () => {
    expect(groundHit({ x: 0, y: 0, z: 100 }, { x: 0, y: 1, z: -1 }, 3000)).toEqual({ x: 0, y: 100 });
    expect(groundHit({ x: 0, y: 0, z: 100 }, { x: 0, y: 1, z: 0.1 }, 3000)).toBeNull();
    expect(groundHit({ x: 0, y: 0, z: 100 }, { x: 0, y: 1, z: -0.01 }, 3000)).toBeNull();
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

describe("startFraming", () => {
  const box = boxOfBbox(bbox); // ~730 x 890 m
  it("defaults to the box centre, -30 deg, 0.45 x side within 400-600 m", () => {
    const f = startFraming(box);
    expect(f.target).toEqual({ lon: box.lon, lat: box.lat });
    expect(f.o.pitch).toBeCloseTo(-Math.PI / 6, 9);
    expect(f.o.range).toBeCloseTo(Math.max(400, Math.min(600, 0.9 * Math.max(box.halfX, box.halfY))), 6);
  });
  it("honours Farm.framing (degrees -> radians) and keeps the target inside the box", () => {
    const f = startFraming(box, { lon: -121.761, lat: 49.241, rangeM: 400, pitchDeg: -30, headingDeg: 90 });
    expect(f.target).toEqual({ lon: expect.closeTo(-121.761, 9), lat: expect.closeTo(49.241, 9) });
    expect(f.o).toEqual({ heading: expect.closeTo(Math.PI / 2, 9), pitch: expect.closeTo(-Math.PI / 6, 9), range: 400 });
    const out = startFraming(box, { lon: -120, lat: 49.241, rangeM: 400, pitchDeg: -30 });
    expect(offsetM(out.target, box).x).toBeCloseTo(box.halfX, 6);
  });
  it("applies minRangeM to the framing and to clampOrbit", () => {
    expect(startFraming(box, { lon: box.lon, lat: box.lat, rangeM: 200, pitchDeg: -30 }, 250).o.range).toBe(250);
    expect(clampOrbit({ heading: 0, pitch: -0.5, range: 180 }, 0, 250).range).toBe(250);
    expect(clampOrbit({ heading: 0, pitch: -0.5, range: 180 }).range).toBe(180);
    expect(clampOrbit({ heading: 0, pitch: -0.5, range: 100 }, 0, 1e5).range).toBe(MAX_RANGE_M);
  });
});

describe("localMorningUtcMs", () => {
  it("is 10:00 local solar time, deterministic", () => {
    expect(new Date(localMorningUtcMs(0)).toISOString()).toBe("2026-06-21T10:00:00.000Z");
    expect(new Date(localMorningUtcMs(-120)).toISOString()).toBe("2026-06-21T18:00:00.000Z");
    expect(localMorningUtcMs(15)).toBe(localMorningUtcMs(15));
  });
});
