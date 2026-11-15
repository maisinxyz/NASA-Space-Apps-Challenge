import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import { errorText, requestOf, snapshotOf, termsIn, useCopilot, type ScreenState } from "./copilot";

const screen: ScreenState = { farmId: "ubc-farm", siteId: "site_ubc_farm", fieldId: "d3-brassicas", horizon: "years", timeIndex: 5, rainPct: -10, tempC: 1.5, strategyId: "rot_alt_1", selected: { kind: "flag", id: "f1" } };

describe("co-pilot", () => {
  it("sends screen state only, never forecast numbers", () => {
    const s = snapshotOf(screen);
    expect(Object.keys(s).sort()).toEqual(["farm_id", "field_id", "horizon", "scenario", "selected", "site_id", "strategy_id", "time_index"]);
    expect(s.scenario).toEqual({ preset: "baseline", rain_scale_pct: -10, temp_offset_c: 1.5 });
    expect(snapshotOf({ ...screen, strategyId: "a" }).strategy_id).toBeNull();
  });

  it("keeps to the contract limits", () => {
    const history = Array.from({ length: 9 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `m${i}` }));
    const r = requestOf("x".repeat(1500), screen, history);
    expect(r.message).toHaveLength(1000);
    expect(r.history).toHaveLength(6);
  });

  it("explains errors plainly", () => {
    expect(errorText(new ApiError({ code: "RATE_LIMITED", message: "", retryable: true }, 429))).toMatch(/busy/);
    expect(errorText(new ApiError({ code: "DATA_SOURCE_UNAVAILABLE", message: "", retryable: true }, 503))).toMatch(/cannot be reached/);
  });

  it("finds terms to explain", () => expect(termsIn("NDVI and evapotranspiration")).toEqual(["evapotranspiration", "NDVI"]));

  it("opens a prefilled question and explains that fixture mode cannot answer it", async () => {
    useCopilot.getState().ask({ question: "Why?", kind: "strategy", id: "rot_alt_1" });
    expect(useCopilot.getState()).toMatchObject({ open: true, draft: "Why?" });
    await useCopilot.getState().send("Why?", screen);
    expect(useCopilot.getState()).toMatchObject({ messages: [], status: "error", error: expect.stringContaining("live forecast API") });
  });

  it("carries a question to the chosen farm without carrying unrelated field context", () => {
    useCopilot.getState().ask({ question: "Why?", kind: "field", id: "d3-brassicas", fieldId: "d3-brassicas" });
    useCopilot.getState().startFarm("kpu-langley", "What can I plant at KPU?");
    expect(useCopilot.getState()).toMatchObject({
      draft: "What can I plant at KPU?", pendingFarm: "kpu-langley", fieldId: null, selected: null, messages: [],
    });
  });
});
