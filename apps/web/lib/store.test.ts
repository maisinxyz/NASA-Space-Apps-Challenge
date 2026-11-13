import { describe, expect, it } from "vitest";

import { initialState, useAppStore } from "./store";

describe("app store", () => {
  it("reset() restores the initial state", () => {
    useAppStore.setState({ siteId: "s", terrainId: "t", rotationIds: ["a", "b"], simRotationIds: ["a", "b", "c"], mode: "split", layers: ["slope"], timeMin: 42, playing: true, tourStep: 3, showDiff: true, simId: "x", divider: 0.2, farmId: "agassiz", globeView: "farm", twinMode: "compare", twinFieldId: "f1", twinRotationId: "rot_cover", twinYear: 1, twinMonth: 0, priorities: { water: 3, erosion: 0, soilCover: 0, income: 0 }, photoreal: true, exaggeration: 2 });
    useAppStore.getState().reset();
    const { reset, ...state } = useAppStore.getState();
    expect(typeof reset).toBe("function");
    expect(state).toEqual(initialState);
    expect(state.farmId).toBeNull();
    expect(state.globeView).toBe("globe");
  });
});
