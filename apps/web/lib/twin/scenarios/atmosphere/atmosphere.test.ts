import { describe, expect, it } from "vitest";

import { CLEAR_SKY, type AtmosphereState } from "@/components/globe/types";

import type { ScenarioId, ScenarioRun } from "../../scenario";
import { scenarioById, SCENARIO_DEFS } from "../registry";
import { resolveInputs } from "../clock";
import { ATMOSPHERE } from ".";
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
  it("day 1 builds from few clouds; rainy days rain under a full deck; dry days do not", () => {
    expect(at("wet-spell", 0).cloudCover).toBeLessThan(0.3);
    expect(at("wet-spell", 0).rainRateMmH).toBe(0);
    const s = at("wet-spell", 0.5);
    expect(s.fog).toBeGreaterThan(0.3);
    expect(s.timeOfDayHours).toBeLessThan(10);
    for (let d = 1; d < 28; d++) {
      const x = at("wet-spell", (d + 0.3) / 28);
      if (x.rainRateMmH > 0) expect(x.cloudCover).toBeGreaterThan(0.9);
      else expect(x.cloudCover).toBeGreaterThanOrEqual(0.5);
    }
    const rainyDays = (n: number) => Array.from({ length: 28 }, (_, d) => at("wet-spell", (d + 0.3) / 28, { rain_days_per_week: n }).rainRateMmH > 0).filter(Boolean).length;
    expect(rainyDays(7)).toBe(27); // day 1 is still building its cloud deck at 0.3
    expect(rainyDays(4)).toBe(16);
    expect(rainyDays(1)).toBe(4);
    const total = (n: number) => Array.from({ length: 28 }, (_, d) => at("wet-spell", (d + 0.5) / 28, { rain_days_per_week: n }).drizzle).reduce((x, y) => x + y);
    expect(total(7)).toBeGreaterThan(total(4));
    expect(total(4)).toBeGreaterThan(total(1));
  });
});

describe("dry and hot", () => {
  it("drought: dusty haze rises, low sun, little shimmer, light grade, sky clear", () => {
    const xs = [0, 0.5, 1].map((p) => at("drought", p));
    expect(xs[1].haze).toBeGreaterThan(xs[0].haze);
    expect(xs[2].haze).toBeGreaterThan(xs[1].haze);
    expect(xs[2].heatShimmer).toBeLessThanOrEqual(0.15);
    expect(xs[2].tint[3]).toBeLessThanOrEqual(0.25);
    expect(xs[2].timeOfDayHours).toBeGreaterThanOrEqual(15);
    expect(xs[2].heatShimmer).toBeLessThan(at("heat-wave", 0.65).heatShimmer);
    expect(xs[2].cloudCover).toBe(0);
    expect(xs[2].rainRateMmH).toBe(0);
  });
  it("heat wave: builds to the peak day, hotter input = stronger", () => {
    const [a, b, c] = [0, 0.4, 0.65].map((p) => at("heat-wave", p));
    expect(b.heatShimmer).toBeGreaterThan(a.heatShimmer);
    expect(c.heatShimmer).toBeGreaterThan(b.heatShimmer);
    expect(c.tint[3]).toBeGreaterThan(a.tint[3]);
    expect(c.tint[3]).toBeLessThanOrEqual(0.3); // field key stays bold
    expect(at("heat-wave", 0.65, { temp_anomaly_c: 12 }).heatShimmer).toBeGreaterThan(0.9);
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
    expect(at("frost", 15 / 48).frostSparkle).toBe(0); // 09:00, thawed
    // No jumps: sparkle and tint change by < 0.1 per 0.1 h step across both dawns.
    for (let h = 0; h < 48; h += 0.1) {
      const [x, y] = [at("frost", h / 48), at("frost", (h + 0.1) / 48)];
      expect(Math.abs(y.frostSparkle - x.frostSparkle)).toBeLessThan(0.1);
      expect(Math.abs(y.tint[3] - x.tint[3])).toBeLessThan(0.05);
    }
    expect(at("frost", 11.5 / 48, { min_temp_c: -10 }).frostSparkle).toBeGreaterThan(at("frost", 11.5 / 48, { min_temp_c: -1 }).frostSparkle);
  });
});
