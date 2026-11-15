import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { bindCopilotFarm, resetCopilot, errorText, requestOf, snapshotOf, termsIn, useCopilot, type ScreenState } from "./copilot";

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_MODE = "mock"; });

const FIXTURES = resolve(__dirname, "../../../../packages/contracts/fixtures");
const screen: ScreenState = { farmId: "ubc-farm", siteId: "site_ubc_farm", fieldId: "d3-brassicas", horizon: "years", timeIndex: 5, rainPct: -10, tempC: 1.5, strategyId: "rot_alt_1", selected: { kind: "flag", id: "f1" } };

beforeEach(() => resetCopilot());
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
    expect(errorText(new ApiError({ code: "DATA_SOURCE_UNAVAILABLE", message: "", retryable: true }, 503))).toMatch(/Gus is unavailable.*credentials/);
  });

  it("shows context errors as Gus unavailable", () =>
    expect(errorText(new ApiError({ code: "INVALID_INPUT", message: "The co-pilot cannot read this year.", retryable: false }, 422))).toBe("Gus is unavailable for this view. Gus cannot read this year."));

  it("finds terms to explain", () => expect(termsIn("NDVI and evapotranspiration")).toEqual(["evapotranspiration", "NDVI"]));

  it("ask opens prefilled; send appends the reply (mock fixture)", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(readFileSync(resolve(FIXTURES, url.replace(/^\/mock\//, "")))));
    useCopilot.getState().ask({ question: "Why?", kind: "strategy", id: "rot_alt_1" });
    expect(useCopilot.getState()).toMatchObject({ open: true, draft: "Why?" });
    await useCopilot.getState().send("Why?", screen);
    const m = useCopilot.getState().messages;
    expect(m.map((x) => x.role)).toEqual(["user", "assistant"]);
    expect(m[1].tips?.length).toBeGreaterThan(0);
    expect(m[1].placeholder).toBe(true);
  });
});


describe("Gus recovery and farm ownership", () => {
  const reply = { reply: "A forecast explanation", referenced_layers: [], local_validation_tips: ["Check locally"] };

  it("restores a failed draft and retries without duplicating conversation history", async () => {
    const bodies: string[] = [];
    let fails = true;
    vi.stubGlobal("fetch", async () => {
      if (fails) return new Response(JSON.stringify({ error: { code: "DATA_SOURCE_UNAVAILABLE", message: "Unavailable", retryable: true } }), { status: 503 });
      return Response.json(reply);
    });
    await useCopilot.getState().send("Why this field?", screen);
    expect(useCopilot.getState()).toMatchObject({ draft: "Why this field?", status: "error", messages: [] });
    expect(useCopilot.getState().error).toContain("Gus");
    fails = false;
    bodies.push(useCopilot.getState().draft);
    await useCopilot.getState().send(bodies[0], screen);
    expect(useCopilot.getState().messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(useCopilot.getState().draft).toBe("");
  });

  it("keeps edits typed while a failed request is pending", async () => {
    let reject!: (e: Error) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((_, r) => { reject = r; }));
    const pending = useCopilot.getState().send("First question", screen);
    useCopilot.setState({ draft: "Next question" });
    reject(new Error("network"));
    await pending;
    expect(useCopilot.getState().draft).toBe("Next question");
  });

  it("clears old farm context and rejects a late success after switching away and back", async () => {
    bindCopilotFarm("ubc-farm");
    useCopilot.getState().ask({ question: "Why?", kind: "field", id: "d3-brassicas", fieldId: "d3-brassicas" });
    let resolve!: (r: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((r) => { resolve = r; }));
    const pending = useCopilot.getState().send("Why?", screen);
    bindCopilotFarm("kpu-langley");
    bindCopilotFarm("ubc-farm");
    expect(useCopilot.getState()).toMatchObject({ open: false, draft: "", messages: [], selected: null, fieldId: null, strategyId: null, status: "idle", error: null });
    resolve(Response.json(reply));
    await pending;
    expect(useCopilot.getState().messages).toEqual([]);
  });

  it("ignores an old failure without overwriting the new farm draft", async () => {
    let reject!: (e: Error) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((_, r) => { reject = r; }));
    const pending = useCopilot.getState().send("Why?", screen);
    bindCopilotFarm("kpu-langley");
    useCopilot.setState({ draft: "KPU question" });
    reject(new Error("offline"));
    await pending;
    expect(useCopilot.getState()).toMatchObject({ draft: "KPU question", status: "idle", error: null });
  });

  it("preserves a conversation when the same farm is rebound", async () => {
    vi.stubGlobal("fetch", async () => Response.json(reply));
    await useCopilot.getState().send("Why?", screen);
    bindCopilotFarm("ubc-farm");
    expect(useCopilot.getState().messages).toHaveLength(2);
  });
});


it("keeps an initial contextual selection when first send binds the farm", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ reply: "Answer", referenced_layers: [], local_validation_tips: [] }));
  useCopilot.getState().ask({ question: "Why this strategy?", kind: "strategy", id: "rot_alt_1", strategyId: "rot_alt_1" });
  await useCopilot.getState().send("Why this strategy?", screen);
  expect(useCopilot.getState()).toMatchObject({ open: true, selected: { kind: "strategy", id: "rot_alt_1" }, strategyId: "rot_alt_1" });
});
