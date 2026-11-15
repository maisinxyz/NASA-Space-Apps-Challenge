import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Forecast } from "@/lib/api/types";

import { useForecastStore } from "./store";

const getForecast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (original) => ({ ...await original<Record<string, unknown>>(), apiMode: "live", getForecast }));

const base = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;
const withHorizon = (n: number) => ({ ...structuredClone(base), horizon_years: n });
const state = () => useForecastStore.getState();

afterEach(() => { state().reset(); getForecast.mockReset(); });

describe("forecast request lifecycle (live)", () => {
  it("ignores an older response that arrives after a newer load", async () => {
    const done: ((f: Forecast) => void)[] = [];
    getForecast.mockImplementation(() => new Promise<Forecast>((r) => { done.push(r); }));
    const first = state().load("site_ubc_farm");
    const second = state().load("site_ubc_farm");
    done[1](withHorizon(7)); await second;
    done[0](withHorizon(3)); await first;
    expect(state().forecast?.horizon_years).toBe(7);
    expect(state().source).toBe("live");
  });

  it("keeps results through a failed refresh, then a retry succeeds", async () => {
    getForecast.mockResolvedValueOnce(withHorizon(4));
    await state().load("site_ubc_farm");
    getForecast.mockRejectedValueOnce(new Error("Network failed"));
    await state().load("site_ubc_farm", { rainPct: 5, tempC: 1 });
    expect(state().status).toBe("error");
    expect(state().error).toBe("Network failed");
    expect(state().forecast?.horizon_years).toBe(4); // retained, shown as stale by the UI
    getForecast.mockResolvedValueOnce(withHorizon(5));
    await state().load("site_ubc_farm", { rainPct: 5, tempC: 1 });
    expect(state().status).toBe("ready");
    expect(state().error).toBeNull();
    expect(state().forecast?.horizon_years).toBe(5);
  });

  it("a late response after reset cannot repopulate", async () => {
    let done!: (f: Forecast) => void;
    getForecast.mockImplementation(() => new Promise<Forecast>((r) => { done = r; }));
    const p = state().load("site_ubc_farm");
    state().reset();
    done(withHorizon(9)); await p;
    expect(state().forecast).toBeNull();
    expect(state().status).toBe("idle");
  });
});
