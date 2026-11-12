import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, assetUrl, getSite, getSites, isMock, parseSse, runSimulation, subscribeScanEvents } from "./client";
import type { ProgressEvent } from "./types";

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
    expect((await getSites()).length).toBe(3);
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
    vi.useFakeTimers();
    const run = async (mockScenario: "success" | "fail") => {
      const seen: ProgressEvent[] = [];
      subscribeScanEvents("scan_mock_001", { onEvent: (e) => seen.push(e) }, { mockScenario, intervalMs: 10 });
      await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
      await vi.runAllTimersAsync();
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
