import { describe, expect, it } from "vitest";

import type { CropLook } from "@/components/globe/types";

import { CROP_COLORS, fieldIdFromPick, fieldStyle, lonLatToPx, planOverlays } from "./twin";

describe("fieldStyle", () => {
  it("gives every crop look its own colour", () => {
    const looks = Object.keys(CROP_COLORS) as CropLook[];
    expect(new Set(looks.map((l) => fieldStyle(l, false).fill)).size).toBe(looks.length);
  });
  it("highlights the selected field", () => {
    const a = fieldStyle("corn", false);
    const b = fieldStyle("corn", true);
    expect(b.fill).toBe(a.fill);
    expect(b.fillAlpha).toBeGreaterThan(a.fillAlpha);
    expect(b.outline).not.toBe(a.outline);
    expect(a.fillAlpha).toBeLessThan(1); // semi-transparent: the imagery shows through
  });
});

describe("fieldIdFromPick", () => {
  it("reads field instance ids and ignores pins and empty picks", () => {
    expect(fieldIdFromPick({ id: "field:f1" })).toBe("f1");
    expect(fieldIdFromPick({ id: { id: "agassiz" } })).toBeNull();
    expect(fieldIdFromPick({ id: "agassiz" })).toBeNull();
    expect(fieldIdFromPick(undefined)).toBeNull();
  });
});

describe("planOverlays", () => {
  const o = (id: string, version: number, bbox: [number, number, number, number] = [0, 0, 1, 1]) => ({ id, version, bbox });
  it("does nothing when nothing changed", () => {
    expect(planOverlays([o("a", 1), o("b", 2)], [o("a", 1), o("b", 2)], false)).toEqual({ rebuild: false, upload: [] });
  });
  it("re-uploads only overlays whose version changed", () => {
    expect(planOverlays([o("a", 1), o("b", 2)], [o("a", 1), o("b", 3)], false)).toEqual({ rebuild: false, upload: ["b"] });
  });
  it("rebuilds everything on reorder, add/remove, bbox or classification change", () => {
    const all = { rebuild: true, upload: ["b", "a"] };
    expect(planOverlays([o("a", 1), o("b", 1)], [o("b", 1), o("a", 1)], false)).toEqual(all);
    expect(planOverlays([o("a", 1)], [o("a", 1), o("b", 1)], false)).toEqual({ rebuild: true, upload: ["a", "b"] });
    expect(planOverlays([o("a", 1)], [o("a", 1, [0, 0, 2, 1])], false)).toEqual({ rebuild: true, upload: ["a"] });
    expect(planOverlays([o("a", 1)], [o("a", 1)], true)).toEqual({ rebuild: true, upload: ["a"] });
  });
});

describe("lonLatToPx", () => {
  const bbox: [number, number, number, number] = [-122, 49, -121, 50];
  it("maps the bbox corners and centre to a north-up canvas", () => {
    expect(lonLatToPx(bbox, 200, 100, -122, 50)).toEqual([0, 0]); // north-west = top-left
    expect(lonLatToPx(bbox, 200, 100, -121, 49)).toEqual([200, 100]); // south-east = bottom-right
    expect(lonLatToPx(bbox, 200, 100, -121.5, 49.5)).toEqual([100, 50]);
  });
  it("puts points outside the bbox outside the canvas", () => {
    const [x, y] = lonLatToPx(bbox, 200, 100, -123, 51);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });
});
