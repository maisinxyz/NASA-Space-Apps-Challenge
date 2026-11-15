import { describe, expect, it, vi } from "vitest";
const effects = vi.hoisted(() => [] as (() => void)[]);
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useEffect: (fn: () => void) => effects.push(fn), useState: (v: unknown) => [v, vi.fn()] }));
vi.mock("@/lib/rotation/store", () => ({ useRotationStore: (selector: (s: unknown) => unknown) => selector({ rotScenario: { preset: "baseline" } }) }));
vi.mock("@/lib/api/client", () => ({ isMock: false }));
vi.mock("@/lib/rotation/api", () => ({ getFeatures: vi.fn().mockResolvedValue({}), getHazardCalendar: vi.fn().mockResolvedValue({}), getHazards: vi.fn().mockResolvedValue({}) }));
vi.mock("./FeatureCharts", () => ({ FeatureCharts: () => null }));
vi.mock("./HazardTimeline", () => ({ HazardTimeline: () => null }));
vi.mock("./ScenarioControls", () => ({ ScenarioControls: () => null }));
import { getFeatures, getHazardCalendar, getHazards } from "@/lib/rotation/api";
import { ClimatePanel } from "./ClimatePanel";
describe.each(["site_ubc_farm", "site_kpu_langley"])("climate for %s", (site) => {
  it("uses the site for all three endpoint calls", () => {
    effects.length = 0; vi.clearAllMocks();
    ClimatePanel({ siteId: site });
    effects.forEach((fn) => fn());
    expect(getFeatures).toHaveBeenCalledWith(site, expect.anything());
    expect(getHazardCalendar).toHaveBeenCalledWith(site, expect.anything());
    expect(getHazards).toHaveBeenCalledWith(site);
  });
});
