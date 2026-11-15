import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { errorText, requestOf, snapshotOf, termsIn, useCopilot, type ScreenState } from "./copilot";

const FIXTURES = resolve(__dirname, "../../../../packages/contracts/fixtures");
const screen: ScreenState = { farmId: "ubc-farm", siteId: "site_ubc_farm", fieldId: "d3-brassicas", horizon: "years", timeIndex: 5, rainPct: -10, tempC: 1.5, strategyId: "rot_alt_1", selected: { kind: "flag", id: "f1" } };

afterEach(() => vi.unstubAllGlobals());

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

  it("ask opens prefilled; send appends the reply (mock fixture)", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(readFileSync(resolve(FIXTURES, url.replace(/^\/mock\//, "")))));
    useCopilot.getState().ask({ question: "Why?", kind: "strategy", id: "rot_alt_1" });
    expect(useCopilot.getState()).toMatchObject({ open: true, draft: "Why?" });
    await useCopilot.getState().send("Why?", screen);
    const m = useCopilot.getState().messages;
    expect(m.map((x) => x.role)).toEqual(["user", "assistant"]);
    expect(m[1].tips?.length).toBeGreaterThan(0);
  });
});
