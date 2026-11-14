import { describe, expect, it } from "vitest";

import { twinConfig } from "./farms";
import { decodeShare, encodeShare, type ShareState } from "./share";

// Built lazily: the twin's field ids come from the traced data.
const full = (): ShareState => ({
  farm: "cornell-ruminant",
  mode: "compare",
  field: twinConfig("cornell-ruminant")!.fields[0].id,
  a: "rot_existing",
  b: "rot_forage",
  divider: 0.35,
  surface: "terrain",
  look: "vegetation",
  camera: { lon: -76.2541123456, lat: 42.4409123456, height: 812.345, heading: 12.3456, pitch: -35.678 },
});

describe("share link", () => {
  it("round-trips the view (camera rounded)", () => {
    const back = decodeShare(encodeShare(full()));
    expect(back).toEqual({ ...full(), camera: { lon: -76.254112, lat: 42.440912, height: 812.3, heading: 12.35, pitch: -35.68 } });
  });

  it("omits field and camera when not set", () => {
    const h = encodeShare({ ...full(), field: null, camera: null });
    expect(h).not.toMatch(/[&#]f=|cam=/);
    expect(decodeShare(h)).not.toHaveProperty("camera");
  });

  it("rejects unknown farms and drops invalid values", () => {
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("#farm=nowhere&m=compare")).toBeNull();
    expect(decodeShare("#farm=agassiz")).toBeNull();
    const d = decodeShare("#farm=cornell-ruminant&m=hack&f=zz&a=rot_x&b=rot_cover&d=7&s=moon&l=xray&cam=1,2,3");
    expect(d).toEqual({ farm: "cornell-ruminant", b: "rot_cover", divider: 1 });
  });

  it("checks rotations and fields against that farm's own twin", () => {
    // rot_forage is a New York rotation, rot_wheat a Maryland one.
    expect(decodeShare("#farm=usda-barc&a=rot_forage&b=rot_wheat")).toEqual({ farm: "usda-barc", b: "rot_wheat" });
    // Explore farms have no twin: only the farm (and view settings) survive.
    expect(decodeShare("#farm=unl-mead&a=rot_cover&f=f1&m=compare")).toEqual({ farm: "unl-mead", mode: "compare" });
  });

  it("rejects a camera below ground or off the globe", () => {
    expect(decodeShare("#farm=usda-barc&cam=-76,39,-5,0,0")).not.toHaveProperty("camera");
    expect(decodeShare("#farm=usda-barc&cam=-200,39,100,0,0")).not.toHaveProperty("camera");
  });
});
