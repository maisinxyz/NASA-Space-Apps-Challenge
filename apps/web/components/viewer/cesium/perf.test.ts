import { describe, expect, it } from "vitest";
import { createFrameStats, createMotionTracker, createThrottle, MOTION_IDLE_MS, needsContinuousRender, qualityFor } from "./perf";

describe("qualityFor", () => {
  it("maps detail to SSE and capped resolution scale", () => {
    expect(qualityFor("high", 2)).toEqual({ sse: 12, resolutionScale: 1.5 });
    expect(qualityFor("medium", 2)).toEqual({ sse: 16, resolutionScale: 1.25 });
    expect(qualityFor("low", 2)).toEqual({ sse: 24, resolutionScale: 1 });
    expect(qualityFor("medium", 1)).toEqual({ sse: 16, resolutionScale: 1 });
  });
  it("coarsens while moving and pauses refinement for low + scenario", () => {
    expect(qualityFor("high", 2, { moving: true })).toEqual({ sse: 32, resolutionScale: 1 });
    expect(qualityFor("low", 1, { scenario: true }).sse).toBe(64);
    expect(qualityFor("medium", 1, { scenario: true }).sse).toBe(16);
  });
});

describe("helpers", () => {
  it("needsContinuousRender", () => {
    expect(needsContinuousRender(null, undefined)).toBe(false);
    expect(needsContinuousRender({ active: false }, { active: true })).toBe(true);
  });
  it("motion tracker debounces", () => {
    const m = createMotionTracker();
    expect(m.moving(0)).toBe(false);
    m.touch(100);
    expect(m.moving(100 + MOTION_IDLE_MS - 1)).toBe(true);
    expect(m.moving(100 + MOTION_IDLE_MS)).toBe(false);
  });
  it("throttle ~5 Hz", () => {
    const t = createThrottle(200);
    expect([t(0), t(100), t(200), t(399), t(400)]).toEqual([true, false, true, false, true]);
  });
  it("frame stats", () => {
    const s = createFrameStats();
    for (let i = 1; i <= 100; i++) s.push(i);
    const r = s.read();
    expect(r.avgMs).toBeCloseTo(50.5);
    expect(r.p95Ms).toBe(96);
  });
});
