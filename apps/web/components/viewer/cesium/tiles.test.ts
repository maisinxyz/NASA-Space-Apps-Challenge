import { describe, expect, it } from "vitest";
import { selectTierOrder } from "./tiles";

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
