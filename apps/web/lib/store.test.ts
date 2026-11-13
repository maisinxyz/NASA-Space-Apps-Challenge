import { describe, expect, it } from "vitest";

import { initialState, useAppStore } from "./store";

describe("app store", () => {
  it("reset() restores the initial state", () => {
    useAppStore.setState({ farmId: "agassiz", globeView: "farm", twinMode: "compare", twinFieldId: "f1", twinRotationId: "rot_cover", twinYear: 1, twinMonth: 0, priorities: { water: 3, erosion: 0, soilCover: 0, income: 0 }, exaggeration: 2, twinSurface: "terrain" });
    useAppStore.getState().reset();
    const { reset, ...state } = useAppStore.getState();
    expect(typeof reset).toBe("function");
    expect(state).toEqual(initialState);
    expect(state.farmId).toBeNull();
    expect(state.globeView).toBe("globe");
    expect(state.exaggeration).toBe(1);
    expect(state.twinSurface).toBe("google");
  });
});
