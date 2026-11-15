import { describe, expect, it } from "vitest";
import { farmById } from "@/lib/farms";
import { runSourceFor } from "./runSource";

describe("runSourceFor", () => {
  it("no farm uses made-up fixture runs", () => {
    expect(runSourceFor(farmById("cornell-ruminant"))).toBe("none");
    expect(runSourceFor(farmById("usda-barc"))).toBe("none");
  });
  it("explore-only farms and no farm use none", () => {
    expect(runSourceFor(farmById("ucdavis-oakville"))).toBe("none");
    expect(runSourceFor(null)).toBe("none");
  });
  it("override wins", () => {
    expect(runSourceFor(farmById("cornell-ruminant"), "none")).toBe("none");
    expect(runSourceFor(null, "fixture")).toBe("fixture");
  });
});
