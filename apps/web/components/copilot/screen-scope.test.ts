import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ focus: null as string | null, chosen: null as string | null }));
vi.mock("@/lib/store", () => ({ useAppStore: (selector: (s: unknown) => unknown) => selector({ farmId: "ubc-farm", twinFieldId: "old-field" }) }));
vi.mock("@/lib/farm-future/store", () => ({ useFutureStore: () => ({ t: 0, whatIf: { rainPct: 0, tempC: 0 }, strategyId: "a", focusFieldId: state.focus, horizon: "years", monthIndex: 0 }) }));
vi.mock("@/lib/farm-future/useFutureData", () => ({ useFutureData: () => ({ data: { source: "fixture" } }) }));
vi.mock("@/lib/forecast/store", () => ({ useForecastStore: (selector: (s: unknown) => unknown) => selector({ siteId: null, source: null, request: null }) }));
vi.mock("@/lib/copilot/copilot", () => ({ useCopilot: () => ({ fieldId: state.chosen, strategyId: null, selected: null }), MAX_MESSAGE: 1000, TERMS: {}, termsIn: () => [] }));
import { useScreenState } from "./CopilotPanel";
it("uses whole farm after clearing the selected area, even if an old twin field exists", () => {
  state.focus = null; state.chosen = null;
  expect(useScreenState()?.fieldId).toBeNull();
  state.focus = "new-field";
  expect(useScreenState()?.fieldId).toBe("new-field");
});
