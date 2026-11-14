import { describe, expect, it } from "vitest";
import { farmById } from "@/lib/farms";
import { runSourceFor } from "./runSource";

describe("runSourceFor", () => {
  it("full-twin farms use fixture, labelled synthetic", () => {
    expect(runSourceFor(farmById("cornell-ruminant"))).toBe("fixture");
    expect(runSourceFor(farmById("usda-barc"))).toBe("fixture");
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
