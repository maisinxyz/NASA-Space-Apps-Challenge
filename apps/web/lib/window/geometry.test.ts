import { describe, expect, it } from "vitest";

import { boundedRecoilRect, clampRect, dragRect, easeOutBack, fromFrac, lerpRect, resizeRect, rubber, toFrac, type Limits, type Rect } from "./geometry";

const region: Rect = { x: 0, y: 48, w: 1440, h: 852 };
const lim: Limits = { minW: 220, minH: 260, maxW: 1424, maxH: 844 };
const start: Rect = { x: 100, y: 100, w: 300, h: 300 };

describe("rubber", () => {
  it("returns 0 for 0", () => {
    expect(rubber(0)).toBe(0);
  });

  it("preserves sign", () => {
    expect(rubber(50)).toBeGreaterThan(0);
    expect(rubber(-50)).toBeLessThan(0);
    expect(rubber(-50)).toBeCloseTo(-rubber(50), 9);
  });

  it("increases monotonically in |overshoot|", () => {
    const xs = [1, 10, 50, 100, 300, 1000, 1e4];
    for (let i = 1; i < xs.length; i++) {
      expect(rubber(xs[i])).toBeGreaterThan(rubber(xs[i - 1]));
    }
  });

  it("is always less than |overshoot| for a positive overshoot", () => {
    for (const x of [0.5, 1, 10, 100, 1000, 1e6]) {
      expect(rubber(x)).toBeLessThan(x);
    }
  });

  it("never exceeds dim (default 180), even for 1e6", () => {
    expect(rubber(1e6)).toBeLessThanOrEqual(180);
    expect(rubber(-1e6)).toBeGreaterThanOrEqual(-180);
    expect(rubber(1e6, 100)).toBeLessThanOrEqual(100);
  });
});

describe("clampRect", () => {
  it("shrinks a window larger than the limits to maxW/maxH", () => {
    const r = clampRect({ x: 0, y: 48, w: 2000, h: 2000 }, region, { minW: 220, minH: 260, maxW: 600, maxH: 500 });
    expect(r.w).toBe(600);
    expect(r.h).toBe(500);
  });

  it("grows a window smaller than the minimum to min", () => {
    const r = clampRect({ x: 10, y: 60, w: 50, h: 40 }, region, lim);
    expect(r.w).toBe(220);
    expect(r.h).toBe(260);
  });

  it("keeps the whole rect inside the region", () => {
    const r = clampRect({ x: 1300, y: 900, w: 200, h: 100 }, region, lim);
    // w 200 grows to minW 220, so the right edge sits on the region edge at x = 1440 - 220.
    expect(r.w).toBe(220);
    expect(r.x).toBe(region.x + region.w - 220);
    expect(r.y).toBe(region.y + region.h - r.h);
    expect(r.x + r.w).toBeLessThanOrEqual(region.x + region.w);
    expect(r.y + r.h).toBeLessThanOrEqual(region.y + region.h);
  });

  it("clamps a negative position to the region origin", () => {
    const r = clampRect({ x: -500, y: -500, w: 300, h: 300 }, region, lim);
    expect(r.x).toBe(0);
    expect(r.y).toBe(48);
  });

  it("when the region is smaller than min, uses min size pinned to the region origin", () => {
    const small: Rect = { x: 20, y: 70, w: 100, h: 100 };
    const r = clampRect({ x: 500, y: 500, w: 900, h: 900 }, small, lim);
    expect(r.w).toBe(220);
    expect(r.h).toBe(260);
    expect(r.x).toBe(small.x);
    expect(r.y).toBe(small.y);
  });
});

describe("dragRect", () => {
  it("inside the region: show === target === raw", () => {
    const { show, target } = dragRect(start, 50, 50, region, lim);
    const raw = { x: 150, y: 150, w: 300, h: 300 };
    expect(target).toEqual(raw);
    expect(show).toEqual(raw);
  });

  it("dragged 300px past the right edge: target snaps to the edge, show is rubber-banded", () => {
    // Left edge is driven to x = 1440, i.e. 300px past the target x (1440 - 300 = 1140).
    const { show, target } = dragRect(start, 1340, 0, region, lim);
    expect(target.x).toBe(region.x + region.w - start.w);
    expect(show.x).toBeGreaterThan(target.x);
    expect(show.x).toBeLessThan(1440);
    expect(show.x - target.x).toBeLessThan(180);
  });
});

describe("resizeRect", () => {
  it("east handle grows width and keeps x", () => {
    const { target, show } = resizeRect(start, { x: 1, y: 0 }, 50, 0, region, lim);
    expect(target.x).toBe(start.x);
    expect(target.w).toBe(350);
    expect(show.x).toBe(start.x);
    expect(show.w).toBe(350);
  });

  it("west handle moves x and keeps the right edge fixed", () => {
    const { target } = resizeRect(start, { x: -1, y: 0 }, -50, 0, region, lim);
    expect(target.x).toBe(50);
    expect(target.w).toBe(350);
    expect(target.x + target.w).toBe(start.x + start.w);
  });

  it("shrinking below minW stops target at minW; show is between raw and target", () => {
    const { target, show } = resizeRect(start, { x: 1, y: 0 }, -200, 0, region, lim);
    const raw = start.w - 200;
    expect(target.w).toBe(lim.minW);
    expect(show.w).toBeLessThan(target.w);
    expect(show.w).toBeGreaterThan(raw);
  });

  it("growing beyond maxW clamps target.w to maxW", () => {
    const smallLim: Limits = { ...lim, maxW: 500 };
    const { target } = resizeRect(start, { x: 1, y: 0 }, 2000, 0, region, smallLim);
    expect(target.w).toBe(500);
  });

  it("dir {0,0} returns the start rect", () => {
    const { show, target } = resizeRect(start, { x: 0, y: 0 }, 77, -33, region, lim);
    expect(target).toEqual(start);
    expect(show).toEqual(start);
  });
});

describe("toFrac / fromFrac", () => {
  it("round-trips a rect within 1e-9", () => {
    const b = { w: 1440, h: 900 };
    const r: Rect = { x: 123.456, y: 78.9, w: 543.21, h: 432.1 };
    const back = fromFrac(toFrac(r, b), b);
    expect(back.x).toBeCloseTo(r.x, 9);
    expect(back.y).toBeCloseTo(r.y, 9);
    expect(back.w).toBeCloseTo(r.w, 9);
    expect(back.h).toBeCloseTo(r.h, 9);
  });
});

describe("easeOutBack", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 9);
    expect(easeOutBack(1)).toBe(1);
  });

  it("overshoots above 1 somewhere in (0, 1)", () => {
    let max = 0;
    for (let k = 0.01; k < 1; k += 0.01) max = Math.max(max, easeOutBack(k));
    expect(max).toBeGreaterThan(1);
  });
});

describe("lerpRect", () => {
  it("interpolates each field", () => {
    expect(lerpRect(start, { x: 200, y: 200, w: 400, h: 400 }, 0.5)).toEqual({ x: 150, y: 150, w: 350, h: 350 });
  });
});

describe("bounded recoil", () => {
  it("clamps overshooting animation frames to the content region", () => {
    const content: Rect = { x: 288, y: 48, w: 1152, h: 812 };
    const from: Rect = { x: 488, y: 64, w: 380, h: 500 };
    const to: Rect = { ...from, x: 288 };
    for (let k = 0; k <= 1; k += 0.01) {
      const frame = boundedRecoilRect(from, to, k, content, lim);
      expect(frame.x).toBeGreaterThanOrEqual(content.x);
      expect(frame.x + frame.w).toBeLessThanOrEqual(content.x + content.w);
    }
  });
});
