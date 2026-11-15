import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseRequest } from "./sites";
vi.mock("@/lib/api/client", () => ({ apiMode: "live", getForecast: vi.fn(), getPrebuiltForecast: vi.fn(), ApiError: class extends Error {} }));
import { getForecast } from "@/lib/api/client";
import { useForecastStore } from "./store";
const site = "site_ubc_farm";
const request = baseRequest(site)!;
const result = { site_id: site } as never;
beforeEach(() => { useForecastStore.getState().reset(); vi.resetAllMocks(); });
describe("accepted forecast runs", () => {
  it("preserves accepted inputs on failure and retries the failed inputs", async () => {
    vi.mocked(getForecast).mockResolvedValueOnce(result).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(result);
    await useForecastStore.getState().run(site, request);
    const edited = { ...request, farm_water_quota_mm_per_season: 42 };
    await useForecastStore.getState().run(site, edited);
    expect(useForecastStore.getState().request).toEqual(request);
    expect(useForecastStore.getState().forecast).toBe(result);
    await useForecastStore.getState().retry();
    expect(vi.mocked(getForecast).mock.calls[2][1]).toEqual(edited);
    expect(useForecastStore.getState().request).toEqual(edited);
  });
  it("ignores a superseded result", async () => {
    let resolve!: (v: never) => void;
    vi.mocked(getForecast).mockImplementationOnce(() => new Promise((r) => { resolve = r; })).mockResolvedValueOnce(result);
    const first = useForecastStore.getState().run(site, request);
    const edited = { ...request, farm_water_quota_mm_per_season: 10 };
    await useForecastStore.getState().run(site, edited);
    resolve(result); await first;
    expect(useForecastStore.getState().request).toEqual(edited);
  });
  it("keeps the accepted result visible while another request is pending and invalidates it on reset", async () => {
    let resolve!: (v: never) => void;
    vi.mocked(getForecast).mockResolvedValueOnce(result).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await useForecastStore.getState().run(site, request);
    const pending = useForecastStore.getState().run(site, { ...request, farm_water_quota_mm_per_season: 4 });
    expect(useForecastStore.getState().status).toBe("loading");
    expect(useForecastStore.getState().forecast).toBe(result);
    expect(useForecastStore.getState().request).toEqual(request);
    useForecastStore.getState().reset();
    resolve(result);
    await pending;
    expect(useForecastStore.getState().forecast).toBeNull();
    expect(useForecastStore.getState().status).toBe("idle");
  });
});
