import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, assetUrl, debounce, getClimateOutlook, getCropCatalog, getForecast, getOutlook, getSensitivity, getSite, getSites, isMock, parseSse, postCopilotChat, postFieldAnalyze, runSimulation, subscribeScanEvents } from "./client";
import type { ForecastRequest, ProgressEvent } from "./types";

const FIXTURES = resolve(__dirname, "../../../../packages/contracts/fixtures");

// Serve /mock/* from the fixtures folder, like public/mock does in the browser.
function mockFetch() {
  vi.stubGlobal("fetch", async (url: string) => {
    const rel = url.replace(/^\/mock\//, "");
    try {
      return new Response(readFileSync(resolve(FIXTURES, rel)));
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("mock mode", () => {
  it("is the default", () => expect(isMock).toBe(true));

  it("maps API asset paths to /mock", () => {
    expect(assetUrl("/api/v1/terrain/terr_mock_hills/heightmap.png")).toBe("/mock/terrain/terr_mock_hills/heightmap.png");
  });

  it("reads sites and 404s unknown ids as ApiError", async () => {
    mockFetch();
    expect((await getSites()).length).toBe(2);
    await expect(getSite("site_nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getSite("site_nope")).rejects.toBeInstanceOf(ApiError);
  });

  it("filters simulation results to the requested rotations", async () => {
    mockFetch();
    const s = await runSimulation({ terrain_id: "terr_mock_hills", storm_id: "storm_mock_1", rotation_ids: ["rot_cover"] });
    expect(Object.keys(s.results)).toEqual(["rot_cover"]);
  });

  it("replays the SSE fixture in order, and the failure stream on request", async () => {
    mockFetch();
    const run = async (mockScenario: "success" | "fail") => {
      const seen: ProgressEvent[] = [];
      subscribeScanEvents("scan_mock_001", { onEvent: (e) => seen.push(e) }, { mockScenario, intervalMs: 2 });
      await vi.waitFor(
        () => {
          const finalStage = mockScenario === "success" ? "ready" : "failed";
          expect(seen.at(-1)?.stage).toBe(finalStage);
        },
        { timeout: 3000, interval: 10 },
      );
      return seen;
    };
    const ok = await run("success");
    expect(ok.at(-1)?.stage).toBe("ready");
    expect(ok.at(-1)?.terrain_id).toBe("terr_mock_hills");
    const fail = await run("fail");
    expect(fail.at(-1)?.stage).toBe("failed");
    expect(fail.at(-1)?.error?.code).toBe("TERRAIN_COVERAGE_MISSING");
  });
});

describe("parseSse", () => {
  it("parses event blocks", () => {
    const text = 'event: progress\ndata: {"scan_id":"scan_a","stage":"queued","pct":0,"message":"m","ts":"2026-11-14T18:00:00Z"}\n\n';
    expect(parseSse(text)).toEqual([{ scan_id: "scan_a", stage: "queued", pct: 0, message: "m", ts: "2026-11-14T18:00:00Z" }]);
  });
});

describe("offline mode", () => {
  it("uses only local files even when live mode is requested", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_OFFLINE", "1");
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response("[]");
    });
    try {
      const c = await import("./client");
      expect(c.offline).toBe(true);
      expect(c.apiMode).toBe("mock");
      await c.getSites();
      expect(urls).toEqual(["/mock/sites.json"]);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe("forecast (v1.2)", () => {
  const body = { selection: { crops: ["a", "b"] }, strategy_count: 3, constraints: {}, scenario: "baseline", horizon_years: 10, climate_source: "history_resample" } as unknown as ForecastRequest;

  it("reads the forecast fixtures and the crop catalog", async () => {
    mockFetch();
    expect((await getForecast("site_usda_barc", body)).horizon_years).toBe(10);
    expect((await getSensitivity("site_usda_barc", body)).cells.length).toBeGreaterThan(0);
    expect((await getClimateOutlook("site_usda_barc")).site_id).toBe("site_usda_barc");
    expect((await getCropCatalog()).crops.length).toBeGreaterThan(0);
  });

  it("reuses an identical request and 404s unknown sites", async () => {
    const f = vi.fn(async () => new Response(readFileSync(resolve(FIXTURES, "forecast/site_usda_barc_forecast.json"))));
    vi.stubGlobal("fetch", f);
    const req = { ...body, strategy_count: 2 } as ForecastRequest;
    await getForecast("site_usda_barc", req);
    await getForecast("site_usda_barc", req);
    expect(f).toHaveBeenCalledTimes(1);
    mockFetch();
    await expect(getForecast("site_nope", body)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("debounce", () => {
  it("fires once with the last arguments", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(2);
  });
});

describe("v1.3 mock calls", () => {
  it("reads the outlook, a co-pilot reply and a field analysis", async () => {
    mockFetch();
    const outlook = await getOutlook("site_ubc_farm");
    expect(outlook.months).toHaveLength(12);
    expect(["climatology", "seasonal_forecast"]).toContain(outlook.kind);
    await expect(getOutlook("site_nope")).rejects.toMatchObject({ code: "NOT_FOUND" });

    const reply = await postCopilotChat({
      message: "Why is this field flagged?",
      snapshot: {
        farm_id: "ubc-farm", site_id: "site_ubc_farm", field_id: null, horizon: "years", time_index: 5,
        scenario: { preset: "baseline" }, strategy_id: null, selected: null,
      },
    });
    expect(typeof reply.reply).toBe("string");

    const ring: [number, number][] = [[-123.2375, 49.2498], [-123.2368, 49.2498], [-123.2368, 49.2503], [-123.2375, 49.2498]];
    const field = await postFieldAnalyze({ polygon: { type: "Polygon", coordinates: [ring] }, rotation: "preset", scenario: "baseline" });
    expect(field.forecast.fields).toHaveLength(1);
    expect(field.forecast.fields[0].strategies[0].rotation_explanation?.rules.length).toBeGreaterThan(0);
  });
});
