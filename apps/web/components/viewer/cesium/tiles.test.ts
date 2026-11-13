import { describe, expect, it } from "vitest";
import { googleTilesRoute, pickSurface, selectTierOrder, type Surface } from "./tiles";

describe("selectTierOrder", () => {
  it("uses only the keyless tier when there is no token", () => {
    expect(selectTierOrder({ token: "" })).toEqual(["C"]);
    expect(selectTierOrder({ token: undefined, override: "A" })).toEqual(["C"]);
    expect(selectTierOrder({ token: "   " })).toEqual(["C"]);
  });
  it("defaults to A then B then C", () => {
    expect(selectTierOrder({ token: "t" })).toEqual(["A", "B", "C"]);
  });
  it("honours a valid override (B or C = no Google) and ignores an invalid one", () => {
    expect(selectTierOrder({ token: "t", override: " c " })).toEqual(["C"]);
    expect(selectTierOrder({ token: "t", override: "b" })).toEqual(["B", "C"]);
    expect(selectTierOrder({ token: "t", override: "Z" })).toEqual(["A", "B", "C"]);
  });
});

describe("googleTilesRoute", () => {
  it("uses ion unless a Google Maps key is set", () => {
    expect(googleTilesRoute(undefined)).toBe("ion");
    expect(googleTilesRoute("  ")).toBe("ion");
    expect(googleTilesRoute("k")).toBe("google-key");
  });
});

describe("pickSurface", () => {
  const none = new Set<Surface>();
  const farm = { view: "farm" as const, want: "google" as const, failed: none };
  it("shows Google only in farm view, tier A, when asked for", () => {
    expect(pickSurface({ ...farm, tier: "A" })).toBe("google");
    expect(pickSurface({ ...farm, tier: "A", view: "globe" })).toBe("terrain");
    expect(pickSurface({ ...farm, tier: "A", want: "terrain" })).toBe("terrain");
    expect(pickSurface({ ...farm, tier: "B" })).toBe("terrain");
  });
  it("tier C never uses ion", () => {
    expect(pickSurface({ ...farm, tier: "C" })).toBe("base");
    expect(pickSurface({ ...farm, tier: "C", view: "globe" })).toBe("base");
  });
  it("falls back google -> terrain -> base", () => {
    expect(pickSurface({ ...farm, tier: "A", failed: new Set<Surface>(["google"]) })).toBe("terrain");
    expect(pickSurface({ ...farm, tier: "A", failed: new Set<Surface>(["google", "terrain"]) })).toBe("base");
    expect(pickSurface({ ...farm, tier: "B", want: "terrain", failed: new Set<Surface>(["terrain"]) })).toBe("base");
  });
});
