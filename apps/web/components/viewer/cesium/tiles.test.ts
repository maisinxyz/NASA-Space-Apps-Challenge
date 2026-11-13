import { describe, expect, it } from "vitest";
import { pickSurface, selectTierOrder, type Surface } from "./tiles";

describe("selectTierOrder", () => {
  it("uses only the keyless tier when there is no token", () => {
    expect(selectTierOrder({ token: "" })).toEqual(["C"]);
    expect(selectTierOrder({ token: undefined, override: "B" })).toEqual(["C"]);
    expect(selectTierOrder({ token: "   " })).toEqual(["C"]);
  });
  it("defaults to B then C", () => {
    expect(selectTierOrder({ token: "t" })).toEqual(["B", "C"]);
  });
  it("honours a valid override and ignores an invalid one (A no longer exists)", () => {
    expect(selectTierOrder({ token: "t", override: " c " })).toEqual(["C"]);
    expect(selectTierOrder({ token: "t", override: "b" })).toEqual(["B", "C"]);
    expect(selectTierOrder({ token: "t", override: "A" })).toEqual(["B", "C"]);
  });
});

describe("pickSurface", () => {
  const none = new Set<Surface>();
  it("tier B shows terrain, tier C never uses ion", () => {
    expect(pickSurface({ tier: "B", failed: none })).toBe("terrain");
    expect(pickSurface({ tier: "C", failed: none })).toBe("base");
  });
  it("falls back to base when terrain failed", () => {
    expect(pickSurface({ tier: "B", failed: new Set<Surface>(["terrain"]) })).toBe("base");
  });
});
