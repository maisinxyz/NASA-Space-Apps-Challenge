import { describe, expect, it } from "vitest";

import { WINDOW_IDS, limitsFor, type WindowId } from "./config";
import { defaultWins, LAYOUT_KEY, maxRect, parseLayout, regionFor, serializeLayout, useWindowManager } from "./store";
import type { Bounds, Rect } from "./geometry";

const BIG: Bounds = { w: 1440, h: 900 };
const SMALL: Bounds = { w: 1024, h: 700 };
const ORDER: WindowId[] = ["copilot", "nav", "time", "inspector", "future", "planner", "simulation"];

const inside = (r: Rect, b: Bounds) => {
  const reg = regionFor(b);
  return r.x >= reg.x - 0.5 && r.y >= reg.y - 0.5 && r.x + r.w <= reg.x + reg.w + 0.5 && r.y + r.h <= reg.y + reg.h + 0.5;
};

/** Loose shape of a parsed saved layout, for corrupting entries in tests. */
type SavedEdit = { wins: Record<string, { r: unknown; p?: unknown; max?: unknown }>; order?: unknown };

/** A saved layout JSON for `b`, with optional edits applied to the parsed object. */
function savedJson(b: Bounds, edit?: (d: SavedEdit) => void, order: WindowId[] = ORDER) {
  const base = JSON.parse(serializeLayout({ wins: defaultWins(b), order }, b));
  edit?.(base);
  return JSON.stringify(base);
}

describe("LAYOUT_KEY", () => {
  it("is app.windowLayout.v1", () => {
    expect(LAYOUT_KEY).toBe("app.windowLayout.v1");
  });
});

describe("serialize / parse round-trip", () => {
  it("gives rects within 1px of the originals and the same order", () => {
    const wins = defaultWins(BIG);
    const parsed = parseLayout(serializeLayout({ wins, order: ORDER }, BIG), BIG);
    expect(parsed).not.toBeNull();
    for (const id of WINDOW_IDS) {
      const a = wins[id].rect;
      const b = parsed!.wins[id].rect;
      expect(Math.abs(a.x - b.x)).toBeLessThan(1);
      expect(Math.abs(a.y - b.y)).toBeLessThan(1);
      expect(Math.abs(a.w - b.w)).toBeLessThan(1);
      expect(Math.abs(a.h - b.h)).toBeLessThan(1);
    }
    expect(parsed!.order).toEqual(ORDER);
  });
});

describe("parseLayout rejects bad envelopes", () => {
  it.each([
    ["null", null],
    ["empty string", ""],
    ["not json", "not json"],
    ["{}", "{}"],
    ["v:2", JSON.stringify({ v: 2, order: ORDER, wins: {} })],
    ["wins missing", JSON.stringify({ v: 1, order: ORDER })],
  ])("returns null for %s", (_name, raw) => {
    expect(parseLayout(raw, BIG)).toBeNull();
  });
});

describe("parseLayout per-window corruption", () => {
  const custom: Rect = { x: 400, y: 150, w: 400, h: 300 };

  it.each([
    ["non-number entry", (d: SavedEdit) => (d.wins.nav.r = ["a", 1, 2, 3])],
    ["three numbers", (d: SavedEdit) => (d.wins.nav.r = [0.1, 0.1, 0.2])],
    ["negative width", (d: SavedEdit) => (d.wins.nav.r = [0.1, 0.1, -0.2, 0.3])],
  ])("%s falls back to default for that window only", (_name, edit) => {
    const raw = savedJson(BIG, (d) => {
      d.wins.inspector.r = [custom.x / BIG.w, custom.y / BIG.h, custom.w / BIG.w, custom.h / BIG.h];
      edit(d);
    });
    const parsed = parseLayout(raw, BIG)!;
    expect(parsed).not.toBeNull();
    const def = defaultWins(BIG);
    expect(parsed.wins.nav.rect.x).toBeCloseTo(def.nav.rect.x, 6);
    expect(parsed.wins.nav.rect.y).toBeCloseTo(def.nav.rect.y, 6);
    expect(parsed.wins.nav.rect.w).toBeCloseTo(def.nav.rect.w, 6);
    expect(parsed.wins.nav.rect.h).toBeCloseTo(def.nav.rect.h, 6);
    expect(parsed.wins.inspector.rect.x).toBeCloseTo(custom.x, 6);
    expect(parsed.wins.inspector.rect.w).toBeCloseTo(custom.w, 6);
  });
});

describe("parseLayout across screen sizes", () => {
  it("a layout saved on 2560x1440 parsed on 1024x700 stays inside the region and within limits", () => {
    const huge = { w: 2560, h: 1440 };
    const wins = defaultWins(huge);
    // Push some windows to the far edges and make them large on the big screen.
    wins.copilot = { ...wins.copilot, rect: { x: 2200, y: 300, w: 900, h: 1200 } };
    wins.planner = { ...wins.planner, rect: { x: 1500, y: 100, w: 1000, h: 1000 } };
    wins.nav = { ...wins.nav, rect: { x: 2400, y: 900, w: 400, h: 500 } };
    const parsed = parseLayout(serializeLayout({ wins, order: ORDER }, huge), SMALL)!;
    expect(parsed).not.toBeNull();
    for (const id of WINDOW_IDS) {
      const w = parsed.wins[id];
      expect(inside(w.rect, SMALL)).toBe(true);
      if (!w.maximized) {
        const lim = limitsFor(id, SMALL);
        expect(w.rect.w).toBeGreaterThanOrEqual(lim.minW - 0.5);
        expect(w.rect.w).toBeLessThanOrEqual(lim.maxW + 0.5);
        expect(w.rect.h).toBeGreaterThanOrEqual(lim.minH - 0.5);
        expect(w.rect.h).toBeLessThanOrEqual(lim.maxH + 0.5);
      }
    }
  });
});

describe("parseLayout order", () => {
  it("drops unknown and duplicate ids and appends missing ones, each id exactly once", () => {
    const raw = savedJson(BIG, undefined, ["nav", "bogus", "nav", "copilot", "nav"] as WindowId[]);
    const order = parseLayout(raw, BIG)!.order;
    expect(order.slice(0, 2)).toEqual(["nav", "copilot"]);
    expect(order).toHaveLength(WINDOW_IDS.length);
    expect([...order].sort()).toEqual([...WINDOW_IDS].sort());
  });

  it("order contains every WINDOW_ID exactly once when the saved order is empty", () => {
    const order = parseLayout(savedJson(BIG, undefined, []), BIG)!.order;
    expect([...order].sort()).toEqual([...WINDOW_IDS].sort());
  });
});

describe("parseLayout maximised windows", () => {
  it("a maximised window parses to maxRect(id, bounds)", () => {
    const raw = savedJson(BIG, (d) => {
      d.wins.time.max = true;
    });
    const parsed = parseLayout(raw, BIG)!;
    expect(parsed.wins.time.maximized).toBe(true);
    const expected = maxRect("time", BIG);
    expect(parsed.wins.time.rect.x).toBeCloseTo(expected.x, 6);
    expect(parsed.wins.time.rect.y).toBeCloseTo(expected.y, 6);
    expect(parsed.wins.time.rect.w).toBeCloseTo(expected.w, 6);
    expect(parsed.wins.time.rect.h).toBeCloseTo(expected.h, 6);
  });
});

describe("desktop workspace visibility", () => {
  it("starts simulation beside navigation and migrates old layouts", () => {
    const raw = savedJson(BIG, (data) => { delete data.wins.simulation; data.order = ORDER.filter((id) => id !== "simulation"); });
    const parsed = parseLayout(raw, BIG)!;
    expect(parsed.wins.simulation.rect).toEqual({ x: 288, y: 64, w: 420, h: 720 });
    expect(parsed.order).toContain("simulation");
  });

  it("reserves the bottom strip for dragged and maximized windows", () => {
    expect(regionFor(BIG).y + regionFor(BIG).h).toBe(860);
    for (const id of WINDOW_IDS) {
      const max = maxRect(id, BIG);
      expect(max.y + max.h).toBeLessThanOrEqual(860);
      expect(limitsFor(id, BIG).maxH).toBeLessThanOrEqual(812);
    }
  });

  it("allows enough timeline height for compact controls", () => {
    expect(limitsFor("time", BIG).minH).toBeGreaterThanOrEqual(260);
    expect(defaultWins(BIG).time.rect.h).toBeGreaterThanOrEqual(260);
  });
});

describe("dashboard-safe content", () => {
  it("keeps moved, maximized, restored and migrated content to the right of navigation", () => {
    const manager = useWindowManager.getState();
    manager.init(BIG);
    const navRight = () => useWindowManager.getState().wins.nav.rect.x + useWindowManager.getState().wins.nav.rect.w;
    manager.setRect("copilot", { x: 0, y: 60, w: 400, h: 400 });
    expect(useWindowManager.getState().wins.copilot.rect.x).toBeGreaterThanOrEqual(navRight());
    manager.toggleMaximize("copilot");
    expect(useWindowManager.getState().wins.copilot.rect.x).toBeGreaterThanOrEqual(navRight());
    manager.toggleMaximize("copilot");
    expect(useWindowManager.getState().wins.copilot.rect.x).toBeGreaterThanOrEqual(navRight());
    const raw = savedJson(BIG, (d) => { d.wins.copilot.r = [0, 0.1, 0.3, 0.5]; });
    const parsed = parseLayout(raw, BIG)!;
    expect(parsed.wins.copilot.rect.x).toBeGreaterThanOrEqual(parsed.wins.nav.rect.x + parsed.wins.nav.rect.w);
  });
  it("keeps navigation and content apart through resizing and saved maximized layouts", () => {
    const manager = useWindowManager.getState();
    manager.init(BIG);
    manager.setRect("nav", { x: 900, y: 60, w: 1000, h: 400 });
    manager.setRect("inspector", { x: 0, y: 60, w: 1200, h: 400 });
    let wins = useWindowManager.getState().wins;
    expect(wins.inspector.rect.x).toBeGreaterThanOrEqual(wins.nav.rect.x + wins.nav.rect.w);
    const raw = savedJson(BIG, (d) => { d.wins.copilot.max = true; d.wins.copilot.p = [0, 0.1, 0.3, 0.5]; });
    wins = parseLayout(raw, BIG)!.wins;
    expect(wins.copilot.rect.x).toBeGreaterThanOrEqual(wins.nav.rect.x + wins.nav.rect.w);
    expect(wins.copilot.prev!.x).toBeGreaterThanOrEqual(wins.nav.rect.x + wins.nav.rect.w);
  });

});
