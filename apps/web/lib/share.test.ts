import { describe, expect, it } from "vitest";

import { decodeShare, encodeShare, type ShareState } from "./share";

const full: ShareState = {
  farm: "agassiz",
  mode: "compare",
  field: "f4",
  a: "rot_existing",
  b: "rot_forage",
  divider: 0.35,
  surface: "terrain",
  look: "vegetation",
  camera: { lon: -121.7658123456, lat: 49.2509123456, height: 812.345, heading: 12.3456, pitch: -35.678 },
};

describe("share link", () => {
  it("round-trips the view (camera rounded)", () => {
    const back = decodeShare(encodeShare(full));
    expect(back).toEqual({ ...full, camera: { lon: -121.765812, lat: 49.250912, height: 812.3, heading: 12.35, pitch: -35.68 } });
  });

  it("omits field and camera when not set", () => {
    const h = encodeShare({ ...full, field: null, camera: null });
    expect(h).not.toMatch(/[&#]f=|cam=/);
    expect(decodeShare(h)).not.toHaveProperty("camera");
  });

  it("rejects unknown farms and drops invalid values", () => {
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("#farm=nowhere&m=compare")).toBeNull();
    const d = decodeShare("#farm=agassiz&m=hack&f=zz&a=rot_x&b=rot_cover&d=7&s=moon&l=xray&cam=1,2,3");
    expect(d).toEqual({ farm: "agassiz", b: "rot_cover", divider: 1 });
  });

  it("rejects a camera below ground or off the globe", () => {
    expect(decodeShare("#farm=agassiz&cam=-121,49,-5,0,0")).not.toHaveProperty("camera");
    expect(decodeShare("#farm=agassiz&cam=-200,49,100,0,0")).not.toHaveProperty("camera");
  });
});
