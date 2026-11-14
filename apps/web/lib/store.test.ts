import { describe, expect, it } from "vitest";

import { initialState, useAppStore } from "./store";

describe("app store", () => {
  it("reset() restores the initial state", () => {
    useAppStore.setState({ farmId: "agassiz", globeView: "farm", twinMode: "compare", twinFieldId: "f1", compareA: "rot_cover", compareB: "rot_forage", divider: 0.1, look: "night", panelsHidden: true, leftOpen: false, twinYear: 1, twinMonth: 0, priorities: { water: 3, erosion: 0, soilCover: 0, income: 0 }, exaggeration: 2, twinSurface: "terrain" });
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
});
