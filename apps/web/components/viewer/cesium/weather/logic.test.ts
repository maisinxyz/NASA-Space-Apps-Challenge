import { describe, expect, it } from "vitest";

import { cloudProfile, createAutoTier, createLightning, rainDensity, rainFall, rainSpeed, stepDown, sunFor, tierSettings, windDir } from "./logic";

describe("rain mapping", () => {
  it("is 0 without rain, rises monotonically and saturates below 1", () => {
    expect(rainDensity(0)).toBe(0);
    expect(rainDensity(-5)).toBe(0);
    expect(rainDensity(Number.NaN)).toBe(0);
    let prev = 0;
    for (const mm of [1, 2.5, 5, 10, 20, 40, 70, 100]) {
      const d = rainDensity(mm);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThan(1);
      prev = d;
    }
    expect(rainDensity(10)).toBeCloseTo(0.39, 2);
    expect(rainDensity(40)).toBeCloseTo(0.86, 2);
  });
  it("falls faster in heavier rain, capped", () => {
    expect(rainSpeed(0)).toBe(1);
    expect(rainSpeed(50)).toBeCloseTo(1.6);
    expect(rainSpeed(100)).toBeCloseTo(1.6);
  });
});

describe("lightning limiter", () => {
  const run = (reduced: boolean, rand: () => number) => {
    const l = createLightning(rand);
    const starts: number[] = [];
    let prevStart = -Infinity;
    let maxFlash = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      const f = l.update(1, t, reduced);
      maxFlash = Math.max(maxFlash, f);
      if (l.lastStart !== prevStart && Number.isFinite(l.lastStart)) starts.push(l.lastStart);
      prevStart = l.lastStart;
    }
    return { starts, maxFlash };
  };
  it("never starts two flashes within 3 s, even when every roll succeeds", () => {
    const { starts, maxFlash } = run(false, () => 0);
    expect(starts.length).toBeGreaterThan(5);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(maxFlash).toBeLessThanOrEqual(1);
  });
  it("shows nothing under reduced motion", () => {
    const { starts, maxFlash } = run(true, () => 0);
    expect(starts).toEqual([]);
    expect(maxFlash).toBe(0);
  });
  it("shows nothing at weight 0", () => {
    const l = createLightning(() => 0);
    for (let t = 0; t < 10; t += 0.1) expect(l.update(0, t, false)).toBe(0);
  });
});

describe("detail tiers", () => {
  it("scale cost down from high to low", () => {
    const [h, m, l] = (["high", "medium", "low"] as const).map(tierSettings);
    expect(h.cloudSteps).toBeGreaterThan(m.cloudSteps);
    expect(m.cloudSteps).toBeGreaterThan(l.cloudSteps);
    expect(h.rainLayers).toBe(3);
    expect(m.rainLayers).toBe(2);
    expect(l.rainLayers).toBe(1);
    expect(l.shimmer).toBe(false);
    expect(stepDown("high")).toBe("medium");
    expect(stepDown("medium")).toBe("low");
    expect(stepDown("low")).toBe("low");
  });
});

describe("auto step-down", () => {
  const feed = (a: ReturnType<typeof createAutoTier>, req: "high" | "medium" | "low", fps: number, seconds: number) => {
    let tier = req;
    for (let t = 0; t < seconds; t += 1 / fps) tier = a.update(req, 1 / fps);
    return tier;
  };
  it("holds the tier at good fps", () => {
    expect(feed(createAutoTier(), "high", 60, 10)).toBe("high");
  });
  it("ignores dips shorter than 2 s", () => {
    const a = createAutoTier();
    feed(a, "high", 60, 2);
    feed(a, "high", 30, 1.5);
    expect(feed(a, "high", 60, 3)).toBe("high");
  });
  it("steps down one tier after 2 s below 45 fps (plus the grace period), then again if still slow", () => {
    const a = createAutoTier();
    expect(feed(a, "high", 30, 2.5)).toBe("high"); // 1 s grace + ~1.5 s low
    expect(feed(a, "high", 30, 1)).toBe("medium");
    expect(a.steps).toBe(1);
    expect(feed(a, "high", 30, 4)).toBe("low");
    expect(feed(a, "high", 30, 10)).toBe("low");
  });
  it("ignores capped gaps (throttled or stalled window), which are not slow renders", () => {
    const a = createAutoTier();
    for (let t = 0; t < 20; t += 0.1) a.update("high", 0.1);
    expect(a.update("high", 0.1)).toBe("high");
  });
  it("a new requested detail resets the cap", () => {
    const a = createAutoTier();
    feed(a, "high", 20, 6);
    expect(feed(a, "medium", 60, 1)).toBe("medium");
    expect(a.steps).toBe(0);
  });
});

describe("cloud profile", () => {
  it("is 0 at base and top, 1 mid-slab, with a short base fade and a longer top fade", () => {
    expect(cloudProfile(0)).toBe(0);
    expect(cloudProfile(1)).toBe(0);
    for (const h of [0.2, 0.35, 0.5, 0.55]) expect(cloudProfile(h)).toBeCloseTo(1);
    expect(cloudProfile(0.1)).toBeCloseTo(0.5);
    expect(cloudProfile(0.9)).toBeLessThan(cloudProfile(0.1)); // rounded top: thinner near the top than the base
    for (let h = 0; h <= 1; h += 0.05) expect(cloudProfile(h)).toBeGreaterThanOrEqual(0);
  });
});

describe("wind and rain fall", () => {
  it("wind is a unit horizontal direction (the cloud drift: west-south-west)", () => {
    for (const deg of [0, 6, 18]) {
      const w = windDir((deg * Math.PI) / 180);
      expect(Math.hypot(...w)).toBeCloseTo(1);
      expect(w[0]).toBeLessThan(0);
      expect(w[1]).toBeLessThan(0);
    }
  });
  it("falls straight down without slant and leans downwind by the slant angle", () => {
    expect(rainFall([1, 0], 0)).toEqual([0, 0, -1]);
    const w = windDir(0.3);
    const f = rainFall(w, 0.3);
    expect(Math.hypot(...f)).toBeCloseTo(1);
    expect(f[2]).toBeCloseTo(-Math.cos(0.3)); // angle from vertical = slant
    expect(f[0] * w[0] + f[1] * w[1]).toBeCloseTo(Math.sin(0.3)); // leans along the wind
    expect(rainFall(w, -1)[2]).toBe(-1); // negative slant clamps to vertical
    expect(rainFall(w, 10)[2]).toBeLessThan(-0.3); // huge slant stays well below horizontal
  });
});

describe("sun", () => {
  it("is up at noon, low at dawn, dim at night", () => {
    const noon = sunFor(12, 1.4);
    const dawn = sunFor(6.5, 1);
    const night = sunFor(1, 1);
    expect(noon.dir[2]).toBeGreaterThan(0.75);
    expect(noon.exposure).toBeCloseTo(1.16);
    expect(dawn.dir[2]).toBeLessThan(0.3);
    expect(dawn.dir[0]).toBeGreaterThan(0.9); // east
    expect(dawn.color[2]).toBeLessThan(0.9); // warm
    expect(night.exposure).toBeCloseTo(0.35);
    for (const s of [noon, dawn, night]) expect(Math.hypot(...s.dir)).toBeCloseTo(1);
  });
});
