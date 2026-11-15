import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ farmId: "ubc-farm", effects: [] as (() => void)[] }));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useEffect: (fn: () => void) => state.effects.push(fn), useState: (v: unknown) => [v, vi.fn()] }));
vi.mock("@/lib/store", () => ({ useAppStore: (selector: (s: unknown) => unknown) => selector({ farmId: state.farmId }) }));
vi.mock("@/lib/rotation/store", () => ({ useRotationStore: (selector: (s: unknown) => unknown) => selector({ rotScenario: {}, farmerRequest: { constraints: {}, allowed_crops: [], criteria_selected: [], weights: {} } }), buildAnalysisRequest: () => ({}) }));
vi.mock("@/lib/api/client", () => ({ isMock: false, getCrops: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/rotation/api", () => ({ postRotationAnalysis: vi.fn().mockResolvedValue({}), getFeatures: vi.fn().mockResolvedValue({}), getHazardCalendar: vi.fn().mockResolvedValue({}), getHazards: vi.fn().mockResolvedValue({}) }));
vi.mock("@/components/rotation/fe2/ClimatePanel", () => ({ ClimatePanel: () => null }));
vi.mock("./PrioritiesForm", () => ({ PrioritiesForm: () => null }));
vi.mock("./ConstraintsForm", () => ({ ConstraintsForm: () => null }));
vi.mock("./RotationResults", () => ({ RotationResults: () => null }));
import { postRotationAnalysis } from "@/lib/rotation/api";
import { useRotationAnalysis } from "./useRotationAnalysis";
import { Fe1Panel } from "./Fe1Panel";
import { ClimatePanel } from "@/components/rotation/fe2/ClimatePanel";

beforeEach(() => { state.effects = []; vi.clearAllMocks(); });
describe.each([["ubc-farm", "site_ubc_farm"], ["kpu-langley", "site_kpu_langley"]])("%s site mapping", (farm, site) => {
  it("uses the engine site for rotation analysis and the climate panel", () => {
    state.farmId = farm;
    useRotationAnalysis();
    state.effects.forEach((fn) => fn());
    expect(postRotationAnalysis).toHaveBeenCalledWith(site, expect.anything());
    const tree = Fe1Panel();
    const children = tree.props.children as Array<{ type?: unknown; props?: { siteId?: string } }>;
    expect(children.find((child) => child?.type === ClimatePanel)?.props?.siteId).toBe(site);
  });
});
