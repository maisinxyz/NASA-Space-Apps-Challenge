import { describe, expect, it } from "vitest";

import { postRotationAnalysis } from "./api";
import { MOCK_ROTATIONS } from "./draft-fixtures";
import { CRITERIA } from "./draft-types";
import { normalizeWeights, rerank } from "./rank";
import { buildAnalysisRequest, initialRotationState, setScenarioPreset, setScenarioValues, useRotationStore } from "./store";

const all = [...CRITERIA];
const even = Object.fromEntries(all.map((c) => [c, 1]));

describe("rerank", () => {
  it("weights change order but never per-criterion scores", () => {
    const before = JSON.stringify(MOCK_ROTATIONS.map((r) => r.scorecard));
    const water = rerank(MOCK_ROTATIONS, { ...even, water_use: 50 }, all)!;
    const erosion = rerank(MOCK_ROTATIONS, { ...even, erosion_risk: 50 }, all)!;
    expect(water.find((r) => r.rank === 1)!.rotation_id).not.toBe(erosion.find((r) => r.rank === 1)!.rotation_id);
    for (const ranked of [water, erosion]) expect(JSON.stringify(ranked.map((r) => r.scorecard))).toBe(before);
    expect(JSON.stringify(MOCK_ROTATIONS.map((r) => r.scorecard))).toBe(before);
  });

  it("all-zero weights are invalid", () => {
    expect(normalizeWeights({}, all)).toBeNull();
    expect(rerank(MOCK_ROTATIONS, { water_use: 0 }, all)).toBeNull();
  });

  it("ignores weights outside the selected criteria", () => {
    const w = normalizeWeights({ water_use: 2, erosion_risk: 2, forage_potential: 9 }, ["water_use", "erosion_risk"])!;
    expect(w).toEqual({ water_use: 0.5, erosion_risk: 0.5 });
  });

  it("ranks are 1..n", () => {
    expect(rerank(MOCK_ROTATIONS, even, all)!.map((r) => r.rank).sort()).toEqual([1, 2, 3]);
  });
});

describe("mock postRotationAnalysis", () => {
  const req = buildAnalysisRequest(initialRotationState);

  it("is deterministic and keeps the disclaimer", async () => {
    const a = await postRotationAnalysis("cornell", req);
    const b = await postRotationAnalysis("cornell", req);
    expect(a).toEqual(b);
    expect(a.disclaimer).toBe("This tool supports, and does not replace, local agronomic expertise.");
    expect(a.data_mode).toBe("mock");
  });

  it("warns when allowed crops leave fewer than two alternatives", async () => {
    const res = await postRotationAnalysis("cornell", { ...req, allowed_crops: ["crop_corn_silage"] });
    expect(res.rotations).toHaveLength(1);
    expect(res.warnings[0].code).toBe("NO_FEASIBLE_ALTERNATIVES");
  });

  it("ranges only on water use and erosion", () => {
    for (const r of MOCK_ROTATIONS) for (const s of r.scorecard) expect(Boolean(s.range)).toBe(s.criterion === "water_use" || s.criterion === "erosion_risk");
  });
});

describe("rotation store", () => {
  it("preset sets values; custom values override and keep the preset name", () => {
    setScenarioPreset("wetter_winters");
    setScenarioValues({ rain_scale_pct: 30 });
    expect(useRotationStore.getState().rotScenario).toMatchObject({ preset: "wetter_winters", rain_scale_pct: 30 });
    useRotationStore.getState().reset();
    expect(useRotationStore.getState().rotScenario.preset).toBe("baseline");
  });
});
