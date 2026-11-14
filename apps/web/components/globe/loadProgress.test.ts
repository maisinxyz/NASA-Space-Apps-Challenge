import { describe, expect, it } from "vitest";

import { LOAD_CAP, LOAD_SETTLE_MS, startLoad, stepLoad, type LoadInputs } from "./loadProgress";

const none: LoadInputs = { surfaceReady: false, groundKnown: false, firstView: false, pending: 0, tilesLoaded: true };

describe("farm load progress", () => {
  it("stays at 0 before anything has loaded, even after a long wait", () => {
    const t = startLoad("f", 0);
    for (let ms = 0; ms < 5000; ms += 16) stepLoad(t, none, ms, 0.016);
    expect(t.value).toBe(0);
    expect(t.done).toBe(false);
  });

  it("follows the stages, is monotonic, and is capped until truly done", () => {
    const t = startLoad("f", 0);
    let last = 0;
    let ms = 0;
    const run = (i: LoadInputs, frames: number) => {
      for (let k = 0; k < frames; k++, ms += 16) {
        stepLoad(t, i, ms, 0.016);
        expect(t.value).toBeGreaterThanOrEqual(last);
        last = t.value;
      }
    };
    run({ ...none, surfaceReady: true, pending: 40, tilesLoaded: false }, 30);
    expect(t.value).toBeGreaterThan(0.1);
    expect(t.value).toBeLessThan(0.2);
    run({ surfaceReady: true, groundKnown: true, firstView: true, pending: 10, tilesLoaded: false }, 60);
    expect(t.value).toBeGreaterThan(0.8);
    // A later burst of requests never moves the bar back.
    run({ surfaceReady: true, groundKnown: true, firstView: true, pending: 80, tilesLoaded: false }, 30);
    // Nothing pending but Cesium not yet reporting loaded: capped, not done.
    run({ surfaceReady: true, groundKnown: true, firstView: true, pending: 0, tilesLoaded: false }, 120);
    expect(t.done).toBe(false);
    expect(t.value).toBeLessThanOrEqual(LOAD_CAP);
    run({ surfaceReady: true, groundKnown: true, firstView: true, pending: 0, tilesLoaded: true }, 1);
    expect(t.done).toBe(true);
    expect(t.value).toBe(1);
  });

  it("is not done before the settle time even when everything reports loaded", () => {
    const t = startLoad("f", 0);
    const all: LoadInputs = { surfaceReady: true, groundKnown: true, firstView: true, pending: 0, tilesLoaded: true };
    stepLoad(t, all, LOAD_SETTLE_MS - 1, 0.016);
    expect(t.done).toBe(false);
    stepLoad(t, all, LOAD_SETTLE_MS + 1, 0.016);
    expect(t.done).toBe(true);
  });

  it("keeps a stage once seen (ground known stays known)", () => {
    const t = startLoad("f", 0);
    stepLoad(t, { ...none, groundKnown: true }, 16, 0.016);
    stepLoad(t, none, 32, 0.016);
    expect(t.groundKnown).toBe(true);
  });
});
