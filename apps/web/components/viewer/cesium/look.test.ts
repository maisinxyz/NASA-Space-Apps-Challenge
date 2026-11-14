import { describe, expect, it } from "vitest";

import { activeLook, LOOK_SHADERS } from "./look";

describe("activeLook", () => {
  it("is on only in farm view and never for none", () => {
    expect(activeLook("thermal", true)).toBe("thermal");
    expect(activeLook("thermal", false)).toBeNull();
    expect(activeLook("none", true)).toBeNull();
    expect(activeLook(undefined, true)).toBeNull();
  });
  it("has a shader for every non-none look", () => {
    for (const l of ["thermal", "vegetation", "night"] as const) expect(LOOK_SHADERS[l]).toContain("out_FragColor");
  });
});
