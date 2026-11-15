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

  it("ignores a removed scenario id", () => {
    expect(decodeShare("#farm=cornell-ruminant&m=simulate&sc=compound")).not.toHaveProperty("scenario");
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
    expect(decodeShare("#farm=ucdavis-oakville&a=rot_cover&f=f1&m=compare")).toEqual({ farm: "ucdavis-oakville", mode: "compare" });
  });

  it("rejects a camera below ground or off the globe", () => {
    expect(decodeShare("#farm=usda-barc&cam=-76,39,-5,0,0")).not.toHaveProperty("camera");
    expect(decodeShare("#farm=usda-barc&cam=-200,39,100,0,0")).not.toHaveProperty("camera");
  });
});

it("round-trips simulation and panel state", () => {
  const state = { ...full(), scenario: "storm" as const, scenarioRotation: "rot_forage", scenarioProgress: 0.42, twinYear: 1, twinMonth: 2, showCropFills: true, panelsHidden: true, leftOpen: false, rightOpen: true, panelOpen: true, panelSection: "compare" as const };
  expect(decodeShare(encodeShare(state))).toMatchObject({ ...state, camera: { lon: -76.254112, lat: 42.440912, height: 812.3, heading: 12.35, pitch: -35.68 } });
});

it("validates and clamps extended share state", () => {
  const d = decodeShare("#farm=cornell-ruminant&a=rot_existing&b=rot_forage&sc=storm&sr=rot_wheat&sp=5&y=999&mo=-3&fills=2&ph=1&lo=0&ro=bad&po=1&ps=field");
  expect(d).toMatchObject({ scenarioProgress: 1, twinMonth: 0, panelsHidden: true, leftOpen: false, panelOpen: true });
  expect(d?.twinYear).toBeLessThan(999);
  expect(d).not.toHaveProperty("scenarioRotation");
  expect(d).not.toHaveProperty("showCropFills");
  expect(d).not.toHaveProperty("rightOpen");
  expect(d).not.toHaveProperty("panelSection");
  expect(decodeShare("#farm=ucdavis-oakville&sc=storm&sp=.5&sr=rot_existing&y=1&mo=1&fills=1")).toEqual({ farm: "ucdavis-oakville" });
});

it("preserves the scenario rotation even when no scenario is open", () => {
  expect(decodeShare(encodeShare({ ...full(), scenarioRotation: "rot_forage" }))).toMatchObject({ scenarioRotation: "rot_forage" });
});

it("derives panel defaults for legacy and invalid links", async () => {
  const { sharePanelState } = await import("./share");
  expect(sharePanelState("#farm=cornell-ruminant")).toEqual({ open: false, section: "scenarios" });
  expect(sharePanelState("#farm=cornell-ruminant&po=1&ps=map")).toEqual({ open: true, section: "map" });
});
