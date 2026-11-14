import { describe, expect, it } from "vitest";

import { initialState, selectFarm, useAppStore } from "./store";

describe("app store", () => {
  it("reset() restores the initial state", () => {
    useAppStore.setState({ farmId: "cornell-ruminant", globeView: "farm", twinMode: "compare", twinFieldId: "f1", compareA: "rot_cover", compareB: "rot_forage", divider: 0.1, look: "night", panelsHidden: true, leftOpen: false, twinYear: 1, twinMonth: 0, priorities: { water: 3, erosion: 0, soilCover: 0, income: 0 }, exaggeration: 2, twinSurface: "terrain", showCropFills: true });
    useAppStore.getState().reset();
    const { reset, ...state } = useAppStore.getState();
    expect(typeof reset).toBe("function");
    expect(state).toEqual(initialState);
    expect(state.farmId).toBeNull();
    expect(state.globeView).toBe("globe");
    expect(state.exaggeration).toBe(1);
    expect(state.twinSurface).toBe("google");
    expect(state.compareA).toBe("rot_existing");
    expect(state.priorities).toEqual({ water: 3, erosion: 3, soilCover: 3, income: 3 });
  });

  it("selectFarm resets per-farm twin state when the farm changes, keeps it otherwise", () => {
    useAppStore.getState().reset();
    selectFarm("cornell-ruminant");
    useAppStore.setState({ globeView: "farm", compareB: "rot_forage", twinFieldId: "x", showCropFills: true, priorities: { water: 5, erosion: 0, soilCover: 0, income: 0 } });
    selectFarm("cornell-ruminant");
    expect(useAppStore.getState().compareB).toBe("rot_forage");
    selectFarm("usda-barc");
    const s = useAppStore.getState();
    expect([s.farmId, s.compareB, s.twinFieldId, s.showCropFills]).toEqual(["usda-barc", "rot_cover", null, false]);
    expect(s.priorities.water).toBe(5); // the user's priorities are not per farm
    selectFarm(null);
    expect(useAppStore.getState().globeView).toBe("globe");
  });
});
