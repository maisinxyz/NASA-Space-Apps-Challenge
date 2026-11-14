import { describe, expect, it } from "vitest";

import { CLEAR_SKY, type AtmosphereState } from "@/components/globe/types";

import type { ScenarioId, ScenarioRun } from "../../scenario";
import { scenarioById, SCENARIO_DEFS } from "../registry";
import { resolveInputs } from "../clock";
import { ATMOSPHERE, type AtmosphereWithBaseline } from ".";
import { stormCurve } from "./evaluators";

const runOf = (id: ScenarioId, progress: number, inputs: Record<string, number> = {}): ScenarioRun => {
  const def = scenarioById(id)!;
  return { scenarioId: id, farmId: "f", progress, inputs: { ...resolveInputs(def, undefined), ...inputs }, rotationId: null, timeS: 0 };
};
const at = (id: ScenarioId, p: number, inputs?: Record<string, number>) => ATMOSPHERE[id](runOf(id, p, inputs));
const UNIT: (keyof AtmosphereState)[] = ["cloudCover", "cloudDarkness", "drizzle", "lightning", "fog", "haze", "heatShimmer", "frostSparkle"];

describe("every evaluator", () => {
  it("returns valid ranges at progress 0 / 0.5 / 1 for every scenario, deterministically", () => {
    for (const def of SCENARIO_DEFS) {
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const s = at(def.id, p);
        expect(at(def.id, p)).toEqual(s);
        for (const k of UNIT) {
          expect(s[k], `${def.id} ${k} @${p}`).toBeGreaterThanOrEqual(0);
          expect(s[k], `${def.id} ${k} @${p}`).toBeLessThanOrEqual(1);
        }
        expect(s.rainRateMmH).toBeGreaterThanOrEqual(0);
        expect(s.sunIntensity).toBeGreaterThanOrEqual(0);
        expect(s.sunIntensity).toBeLessThanOrEqual(1.5);
        expect(s.timeOfDayHours).toBeGreaterThanOrEqual(0);
        expect(s.timeOfDayHours).toBeLessThan(24);
        for (const c of s.tint) expect(c).toBeGreaterThanOrEqual(0);
        for (const c of s.tint) expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
  it("keeps ground-only scenarios calm", () => {
    for (const id of ["flood-zones", "bare-soil", "veg-stress", "multi-year", "trends"] as const) expect(at(id, 0.5)).toEqual(CLEAR_SKY);
  });
});

describe("storm", () => {
  it("peaks at the peak rain rate input and is dry at both ends", () => {
    expect(at("storm", 0).rainRateMmH).toBe(0);
    expect(at("storm", 1).rainRateMmH).toBe(0);
    let max = 0;
    for (let p = 0; p <= 1; p += 0.005) max = Math.max(max, at("storm", p, { peak_rain_mm_h: 60 }).rainRateMmH);
    expect(max).toBeGreaterThan(59);
    expect(max).toBeLessThanOrEqual(60);
  });
  it("builds clouds and rain to the peak, lightning only near it, then eases", () => {
    const [a, b, c] = [0.1, 0.3, 0.45].map((p) => at("storm", p));
    expect(b.cloudCover).toBeGreaterThan(a.cloudCover);
    expect(c.rainRateMmH).toBeGreaterThan(b.rainRateMmH);
    expect(c.cloudDarkness).toBeGreaterThan(0.8);
    expect(a.lightning).toBe(0);
    expect(c.lightning).toBeGreaterThan(0.5);
    expect(at("storm", 0.85).rainRateMmH).toBeLessThan(c.rainRateMmH);
  });
  it("storm curve is 0..1 and peaks once", () => {
    let peaks = 0;
    let prev = stormCurve(0);
    let rising = true;
    for (let p = 0.01; p <= 1; p += 0.01) {
      const v = stormCurve(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (rising && v < prev) {
        peaks++;
        rising = false;
      }
      prev = v;
    }
    expect(peaks).toBe(1);
  });
});

describe("wet spell", () => {
  it("is grey with drizzle, fog and a low sun; more rainy days = more drizzle overall", () => {
    const s = at("wet-spell", 0.5);
    expect(s.cloudCover).toBeGreaterThanOrEqual(0.7);
    expect(s.fog).toBeGreaterThan(0.3);
    expect(s.timeOfDayHours).toBeLessThan(10);
    expect(s.rainRateMmH).toBe(0); // drizzle is mood; no rain rate is implied
    const total = (n: number) => Array.from({ length: 28 }, (_, d) => at("wet-spell", (d + 0.5) / 28, { rain_days_per_week: n }).drizzle).reduce((x, y) => x + y);
    expect(total(7)).toBeGreaterThan(total(4));
    expect(total(4)).toBeGreaterThan(total(1));
  });
});

describe("dry and hot", () => {
  it("drought: haze and shimmer rise monotonically, sun hard, sky clear", () => {
    const xs = [0, 0.5, 1].map((p) => at("drought", p));
    expect(xs[1].haze).toBeGreaterThan(xs[0].haze);
    expect(xs[2].haze).toBeGreaterThan(xs[1].haze);
    expect(xs[2].heatShimmer).toBeGreaterThan(xs[1].heatShimmer);
    expect(xs[2].sunIntensity).toBeGreaterThan(1.3);
    expect(xs[2].cloudCover).toBe(0);
    expect(xs[2].rainRateMmH).toBe(0);
  });
  it("heat wave: builds to the peak day, hotter input = stronger", () => {
    const [a, b, c] = [0, 0.4, 0.65].map((p) => at("heat-wave", p));
    expect(b.heatShimmer).toBeGreaterThan(a.heatShimmer);
    expect(c.heatShimmer).toBeGreaterThan(b.heatShimmer);
    expect(c.tint[3]).toBeGreaterThan(a.tint[3]);
    expect(at("heat-wave", 0.65, { temp_anomaly_c: 12 }).haze).toBeGreaterThan(at("heat-wave", 0.65, { temp_anomaly_c: 2 }).haze);
  });
});

describe("frost", () => {
  it("starts at night, sparkles before dawn, thaws after sunrise", () => {
    const start = at("frost", 0); // 18:00
    expect(start.timeOfDayHours).toBe(18);
    expect(start.frostSparkle).toBe(0);
    const preDawn = at("frost", 11.5 / 48); // 05:30
    expect(preDawn.frostSparkle).toBeGreaterThan(0.5);
    expect(preDawn.tint[2]).toBeGreaterThan(preDawn.tint[0]); // cold blue
    expect(at("frost", 14 / 48).frostSparkle).toBe(0); // 08:00, thawed
    expect(at("frost", 11.5 / 48, { min_temp_c: -10 }).frostSparkle).toBeGreaterThan(at("frost", 11.5 / 48, { min_temp_c: -1 }).frostSparkle);
  });
});

describe("climate shift", () => {
  it("responds live to the sliders and carries a today baseline", () => {
    const s = at("climate-shift", 0.45) as AtmosphereWithBaseline;
    expect(s.baseline).toBeDefined();
    const harder = at("climate-shift", 0.45, { rain_change_pct: 50 });
    const lighter = at("climate-shift", 0.45, { rain_change_pct: -30 });
    expect(harder.rainRateMmH).toBeGreaterThan(s.baseline!.rainRateMmH);
    expect(lighter.rainRateMmH).toBeLessThan(s.baseline!.rainRateMmH);
    const warm = at("climate-shift", 0.05, { temp_shift_c: 6 });
    const today = at("climate-shift", 0.05, { temp_shift_c: 0, dry_spell_change_pct: 0, rain_change_pct: 0 });
    expect(warm.heatShimmer).toBeGreaterThan(today.heatShimmer);
    expect(at("climate-shift", 0.05, { dry_spell_change_pct: 50 }).haze).toBeGreaterThan(today.haze);
    const { baseline, ...rest } = today as AtmosphereWithBaseline;
    expect(rest).toEqual(baseline); // all sliders at 0 = today
  });
});

describe("compound", () => {
  it("dry first, a visible hand-off, then a hard storm", () => {
    const h = 14 / 17;
    const dry = at("compound", h * 0.8);
    expect(dry.rainRateMmH).toBe(0);
    expect(dry.haze).toBeGreaterThan(0.3);
    const mid = at("compound", h);
    expect(mid.cloudCover).toBeGreaterThan(0.4);
    expect(mid.cloudCover).toBeLessThan(1);
    let max = 0;
    for (let p = h; p <= 1; p += 0.002) max = Math.max(max, at("compound", p).rainRateMmH);
    expect(max).toBeGreaterThan(45);
    expect(at("compound", h + (1 - h) * 0.4).cloudDarkness).toBeGreaterThan(0.8);
  });
});
