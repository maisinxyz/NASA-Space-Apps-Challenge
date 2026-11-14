import { describe, expect, it } from "vitest";

import { CLEAR_SKY } from "@/components/globe/types";
import { decodeShare, encodeShare } from "@/lib/share";
import { initialState, selectFarm, useAppStore } from "@/lib/store";

import { clampInput, clockLabel, clockSpec, currentStep, resolveInputs, stepProgress } from "./clock";
import { composeFrame, FAMILY_ORDER, SCENARIO_DEFS } from "./registry";

describe("scenario registry", () => {
  it("has exactly 12 unique scenarios covering the 5 families", () => {
    expect(SCENARIO_DEFS).toHaveLength(12);
    expect(new Set(SCENARIO_DEFS.map((d) => d.id)).size).toBe(12);
    expect(new Set(SCENARIO_DEFS.map((d) => d.family))).toEqual(new Set(FAMILY_ORDER));
  });

  it.each(SCENARIO_DEFS)("$id has valid inputs, copy and legend", (d) => {
    expect(d.summary && d.plainMeaning && d.durationLabel && d.effectCaption).toBeTruthy();
    expect(d.dataNeeds.length).toBeGreaterThan(0);
    expect(d.legend.length).toBeGreaterThanOrEqual(2);
    expect(d.timeKind === "static" ? d.secondsAtOneX === 0 : d.secondsAtOneX > 0).toBe(true);
    expect(new Set(d.inputs.map((i) => i.id)).size).toBe(d.inputs.length);
    for (const i of d.inputs) {
      expect(i.step).toBeGreaterThan(0);
      expect(i.min).toBeLessThanOrEqual(i.default);
      expect(i.default).toBeLessThanOrEqual(i.max);
      expect(clampInput(i, i.default)).toBe(i.default);
    }
    // Honest wording: no yield or profit claims; ground layers wait for data.
    expect(`${d.summary} ${d.plainMeaning}`).not.toMatch(/yield|profit|revenue/i);
    expect(d.effectCaption).toContain("Ground layers wait for backend data");
  });

  it("sky effect captions say Illustrative weather effect", () => {
    for (const d of SCENARIO_DEFS.filter((x) => !/^No weather effect/.test(x.effectCaption))) expect(d.effectCaption).toContain("Illustrative weather effect");
  });

  it.each(SCENARIO_DEFS)("composeFrame($id) is a clear sky with no ground layers until the owners fill it in", (d) => {
    const run = { scenarioId: d.id, farmId: "cornell-ruminant", progress: 0.5, inputs: resolveInputs(d, undefined), rotationId: null, timeS: 3 };
    const f = composeFrame(run);
    if (/^No weather effect/.test(d.effectCaption)) expect(f.atmosphere).toEqual(CLEAR_SKY); // sky owner fills the rest (S2-W)
    expect(f.ground).toEqual([]);
    expect(f.readouts).toHaveLength(d.inputs.length);
    expect(composeFrame(run)).toEqual(f);
  });
});

describe("scenario clock helpers", () => {
  const storm = SCENARIO_DEFS.find((d) => d.id === "storm")!;
  it("clamps and snaps inputs, falls back to the default for junk", () => {
    const i = storm.inputs[0]; // 5..100 step 5, default 40
    expect(clampInput(i, 1000)).toBe(100);
    expect(clampInput(i, -3)).toBe(5);
    expect(clampInput(i, 42)).toBe(40);
    expect(clampInput(i, Number.NaN)).toBe(40);
    expect(resolveInputs(storm, { peak_rain_mm_h: 999, nope: 1 })).toEqual({ peak_rain_mm_h: 100, duration_h: 24, antecedent_wetness: 50 });
  });
  it("labels the clock and steps on whole steps", () => {
    const c = clockSpec(storm, resolveInputs(storm, { duration_h: 72 }));
    expect(c).toEqual({ unit: "Hour", steps: 72 });
    expect(clockLabel(c, 0)).toBe("Hour 1 of 72");
    expect(clockLabel(c, 1)).toBe("Hour 72 of 72");
    expect(currentStep(c, stepProgress(c, 0, 13))).toBe(14);
    expect(clockLabel(c, stepProgress(c, 1, 5))).toBe("Hour 72 of 72");
    const flood = SCENARIO_DEFS.find((d) => d.id === "flood-zones")!;
    expect(clockLabel(clockSpec(flood, resolveInputs(flood, undefined)), 0.3)).toBe("Static map");
    const trends = SCENARIO_DEFS.find((d) => d.id === "trends")!;
    expect(clockLabel(clockSpec(trends, resolveInputs(trends, undefined)), 0)).toBe("Year 1991 (1 of 30)");
  });
});

describe("scenario store and share link", () => {
  it("reset() restores the scenario keys; a new farm clears the open scenario but keeps inputs and detail", () => {
    useAppStore.setState({ scenarioId: "storm", scenarioInputs: { storm: { duration_h: 12 } }, scenarioProgress: 0.4, scenarioPlaying: true, scenarioSpeed: 4, scenarioRotation: "rot_cover", detail: "low" });
    selectFarm("cornell-ruminant");
    selectFarm("usda-barc");
    const s = useAppStore.getState();
    expect([s.scenarioId, s.scenarioProgress, s.scenarioPlaying, s.scenarioRotation]).toEqual([null, 0, false, "rot_existing"]);
    expect([s.scenarioInputs, s.scenarioSpeed, s.detail]).toEqual([{ storm: { duration_h: 12 } }, 4, "low"]);
    useAppStore.getState().reset();
    const state: Record<string, unknown> = { ...useAppStore.getState() };
    delete state.reset;
    expect(state).toEqual(initialState);
    expect([state.scenarioId, state.scenarioSpeed, state.detail]).toEqual([null, 1, "medium"]);
  });

  const base = { farm: "cornell-ruminant", mode: "simulate" as const, field: null, a: "rot_existing", b: "rot_cover", divider: 0.5, surface: "google" as const, look: "none" as const, camera: null };
  it("round-trips scenario, inputs and detail", () => {
    const h = encodeShare({ ...base, scenario: "storm", inputs: { peak_rain_mm_h: 60, duration_h: 12 }, detail: "low" });
    expect(decodeShare(h)).toMatchObject({ scenario: "storm", inputs: { peak_rain_mm_h: 60, duration_h: 12 }, detail: "low" });
    expect(decodeShare(encodeShare(base))).not.toHaveProperty("scenario");
  });
  it("validates: unknown ids, junk inputs and explore farms are dropped; values are clamped", () => {
    expect(decodeShare("#farm=cornell-ruminant&sc=hack&si=a:1&dt=ultra")).toEqual({ farm: "cornell-ruminant" });
    const d = decodeShare("#farm=cornell-ruminant&sc=storm&si=peak_rain_mm_h:9999,bogus:3,duration_h:abc,antecedent_wetness:&dt=high");
    expect(d).toEqual({ farm: "cornell-ruminant", detail: "high", scenario: "storm", inputs: { peak_rain_mm_h: 100 } });
    expect(decodeShare("#farm=ucdavis-oakville&sc=storm")).toEqual({ farm: "ucdavis-oakville" });
  });
});
