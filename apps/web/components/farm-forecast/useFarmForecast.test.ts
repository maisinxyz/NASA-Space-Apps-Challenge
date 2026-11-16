import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { baseRequest } from "@/lib/forecast/sites";
const mock = vi.hoisted(() => ({ effects: [] as (() => void)[], rain: 15, status: "loading", request: null as unknown, run: vi.fn(), load: vi.fn() }));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useEffect: (fn: () => void) => mock.effects.push(fn) }));
vi.mock("@/lib/store", () => ({ useAppStore: (selector: (s: unknown) => unknown) => selector({ farmId: "ubc-farm" }) }));
vi.mock("@/lib/farm-future/store", () => ({ useFutureStore: (selector: (s: unknown) => unknown) => selector({ whatIf: { rainPct: mock.rain, tempC: 0 } }) }));
vi.mock("@/lib/forecast/store", () => {
  const getState = () => ({ siteId: "site_ubc_farm", status: mock.status, request: mock.request, forecast: mock.request, run: mock.run, load: mock.load });
  return { useForecastStore: Object.assign((selector: (s: unknown) => unknown) => selector(getState()), { getState }) };
});
import { useFarmForecast } from "./ForecastPanel";
beforeEach(() => { vi.useFakeTimers(); mock.effects = []; mock.rain = 15; mock.status = "loading"; mock.request = null; mock.run.mockReset(); mock.load.mockReset(); });
afterEach(() => vi.useRealTimers());
// eslint-disable-next-line react-hooks/rules-of-hooks -- calls the hook directly against the mocked React above
const renderEffects = () => { mock.effects = []; useFarmForecast(); return mock.effects.map((effect) => effect()); };
it("loads the current scenario on entry and applies slider edits after a pending run completes", () => {
  // A different site causes the initial effect to load the selected slider values.
  mock.status = "idle";
  renderEffects();
  expect(mock.load).toHaveBeenCalledWith("site_ubc_farm", { rainPct: 15, tempC: 0 });
  mock.status = "loading"; mock.request = baseRequest("site_ubc_farm");
  renderEffects(); vi.advanceTimersByTime(350);
  expect(mock.run).not.toHaveBeenCalled();
  mock.status = "ready";
  renderEffects(); vi.advanceTimersByTime(350);
  expect(mock.run).toHaveBeenCalledWith("site_ubc_farm", expect.objectContaining({ scenario: { preset: "baseline", rain_scale_pct: 15, temp_offset_c: 0 } }));
});
it("does not automatically retry a failed request", () => {
  mock.request = baseRequest("site_ubc_farm"); mock.status = "error";
  renderEffects(); vi.advanceTimersByTime(1000);
  expect(mock.run).not.toHaveBeenCalled();
});
it("does not let a queued slider update overwrite a newly accepted planner run", () => {
  const original = baseRequest("site_ubc_farm")!;
  mock.request = original; mock.status = "ready";
  renderEffects();
  mock.request = { ...original, farm_water_quota_mm_per_season: 40 };
  vi.advanceTimersByTime(350);
  expect(mock.run).not.toHaveBeenCalled();
});
