import { describe, expect, it } from "vitest";
import { pickSurface, selectTierOrder } from "./tiles";

describe("selectTierOrder", () => {
  it("uses only the keyless tier when there is no token", () => {
    expect(selectTierOrder({ token: "", production: true })).toEqual(["C"]);
    expect(selectTierOrder({ token: undefined, override: "A", production: false })).toEqual(["C"]);
    expect(selectTierOrder({ token: "   ", production: true })).toEqual(["C"]);
  });
  it("defaults to B in development and A in production, falling back downward", () => {
    expect(selectTierOrder({ token: "t", production: false })).toEqual(["B", "C"]);
    expect(selectTierOrder({ token: "t", production: true })).toEqual(["A", "B", "C"]);
  });
  it("honours a valid override and ignores an invalid one", () => {
    expect(selectTierOrder({ token: "t", override: "A", production: false })).toEqual(["A", "B", "C"]);
    expect(selectTierOrder({ token: "t", override: " c ", production: true })).toEqual(["C"]);
    expect(selectTierOrder({ token: "t", override: "b", production: true })).toEqual(["B", "C"]);
    expect(selectTierOrder({ token: "t", override: "Z", production: false })).toEqual(["B", "C"]);
  });
});

describe("pickSurface", () => {
  const none = new Set<"google" | "terrain" | "base">();
  it("keeps the tier's look in globe view", () => {
    expect(pickSurface({ tier: "A", view: "globe", photoreal: false, failed: none })).toBe("google");
    expect(pickSurface({ tier: "B", view: "globe", photoreal: true, failed: none })).toBe("terrain");
  });
  it("farm view: terrain by default, Google only when photoreal is asked for", () => {
    expect(pickSurface({ tier: "A", view: "farm", photoreal: false, failed: none })).toBe("terrain");
    expect(pickSurface({ tier: "B", view: "farm", photoreal: true, failed: none })).toBe("google");
  });
  it("falls back when a source failed, and tier C never uses ion", () => {
    expect(pickSurface({ tier: "B", view: "farm", photoreal: true, failed: new Set(["google"]) })).toBe("terrain");
    expect(pickSurface({ tier: "A", view: "farm", photoreal: false, failed: new Set(["terrain"]) })).toBe("google");
    expect(pickSurface({ tier: "A", view: "farm", photoreal: false, failed: new Set(["terrain", "google"]) })).toBe("base");
    expect(pickSurface({ tier: "C", view: "farm", photoreal: true, failed: none })).toBe("base");
  });
});
