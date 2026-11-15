import { describe, expect, it } from "vitest";
import {
  DAYS, LAST_DAY, MONTH_STARTS, TimelineEngine, crossings, dateOf, dayToX, hapticFor, keyToDay,
  magnetX, nearestWeekDay, strongest, vibrate, xToDay, type TickEvent,
} from "./timeline";

describe("dates", () => {
  it("14 July = day 194, week 28, Summer", () => {
    const d = dateOf(MONTH_STARTS[6] + 13);
    expect(d.label).toBe("14 July");
    expect(d.week).toBe(28);
    expect(d.season).toBe("Summer");
    expect(d.monthName).toBe("July");
  });
  it("covers the year", () => {
    expect(DAYS).toBe(365);
    expect(dateOf(0).label).toBe("1 January");
    expect(dateOf(LAST_DAY).label).toBe("31 December");
    expect(dateOf(LAST_DAY).season).toBe("Winter");
  });
  it("maps x <-> day", () => {
    expect(dayToX(0, 1000)).toBe(0);
    expect(dayToX(LAST_DAY, 1000)).toBe(1000);
    expect(xToDay(500, 1000)).toBeCloseTo(LAST_DAY / 2);
    expect(xToDay(-50, 1000)).toBe(0);
  });
});

describe("ticks", () => {
  it("week boundary every 7 days", () => {
    expect(crossings(6.5, 7.2)).toEqual([{ kind: "week", day: 7 }]);
    expect(crossings(7.2, 6.5)).toEqual([{ kind: "week", day: 7 }]);
    expect(crossings(1, 6)).toEqual([]);
  });
  it("month boundary and season change", () => {
    expect(crossings(MONTH_STARTS[6] - 0.5, MONTH_STARTS[6] + 0.1)).toEqual([{ kind: "month", day: MONTH_STARTS[6] }]);
    expect(crossings(MONTH_STARTS[5] - 0.5, MONTH_STARTS[5] + 0.5)[0].kind).toBe("season"); // 1 Jun
    expect(crossings(MONTH_STARTS[11] - 0.5, MONTH_STARTS[11] + 0.5)[0].kind).toBe("season"); // 1 Dec
  });
  it("returns events in travel order and picks the strongest", () => {
    const evs = crossings(0, 40);
    expect(evs.map((e) => e.day)).toEqual([...evs.map((e) => e.day)].sort((a, b) => a - b));
    expect(crossings(40, 0)[0].day).toBeGreaterThan(crossings(40, 0).at(-1)!.day);
    expect(strongest(evs)?.kind).toBe("month");
    expect(strongest([])).toBeNull();
  });
  it("haptic patterns", () => {
    expect(hapticFor("week")).toBe(8);
    expect(hapticFor("month")).toBe(16);
    expect(hapticFor("season")).toEqual([10, 30, 10]);
  });
  it("vibrate feature-detects", () => {
    const calls: unknown[] = [];
    vibrate("month", { vibrate: (p) => (calls.push(p), true) });
    expect(calls).toEqual([16]);
    expect(() => vibrate("week", {})).not.toThrow();
    expect(() => vibrate("week", undefined)).not.toThrow();
  });
});

describe("magnet", () => {
  it("pulls within 6 px of a month line, not beyond", () => {
    const w = 1000;
    const line = dayToX(MONTH_STARTS[6], w);
    expect(magnetX(line + 5, w)).toBe(line);
    expect(magnetX(line - 6, w)).toBe(line);
    expect(magnetX(line + 7, w)).toBe(line + 7);
  });
});

describe("keyboard", () => {
  it("steps", () => {
    expect(keyToDay(100, "ArrowRight")).toBe(101);
    expect(keyToDay(100, "ArrowLeft")).toBe(99);
    expect(keyToDay(100, "ArrowRight", true)).toBe(107);
    expect(keyToDay(100, "ArrowLeft", true)).toBe(93);
    expect(keyToDay(0, "ArrowLeft")).toBe(0);
    expect(keyToDay(LAST_DAY, "ArrowRight", true)).toBe(LAST_DAY);
    expect(keyToDay(5, "Home")).toBe(0);
    expect(keyToDay(5, "End")).toBe(LAST_DAY);
    expect(keyToDay(5, "x")).toBeNull();
  });
  it("PageUp/PageDown move one month, clamping day-of-month", () => {
    const jan31 = 30;
    expect(dateOf(keyToDay(jan31, "PageDown")!).label).toBe("28 February");
    const jul14 = MONTH_STARTS[6] + 13;
    expect(dateOf(keyToDay(jul14, "PageDown")!).label).toBe("14 August");
    expect(dateOf(keyToDay(jul14, "PageUp")!).label).toBe("14 June");
    expect(keyToDay(3, "PageUp")).toBe(0);
    expect(keyToDay(LAST_DAY, "PageDown")).toBe(LAST_DAY);
  });
});

function make(opts: { reducedMotion?: boolean; initialDay?: number } = {}) {
  const ticks: TickEvent[] = [];
  const days: [number, boolean][] = [];
  const e = new TimelineEngine({ width: 1000, onTick: (t) => ticks.push(t), onDay: (d, g) => days.push([d, g]), ...opts });
  const run = (from: number, ms = 3000) => { for (let t = from; t <= from + ms; t += 16) { if (!e.animating) return t; e.step(t); } return from + ms; };
  return { e, ticks, days, run };
}

describe("engine", () => {
  it("drag follows the pointer 1:1 and reports dragging", () => {
    const { e, days } = make();
    e.pointerDown(500, 0);
    expect(e.dragging).toBe(true);
    e.pointerMove(300, 100);
    expect(e.day).toBeCloseTo(xToDay(300, 1000));
    expect(days.at(-1)![1]).toBe(true);
  });
  it("slow release springs to the nearest whole day", () => {
    const { e, run } = make();
    e.pointerDown(500, 0);
    e.pointerMove(503, 500); // slow
    e.pointerUp(900);
    expect(e.mode).toBe("spring");
    run(900);
    expect(Number.isInteger(e.day)).toBe(true);
    expect(e.mode).toBe("idle");
  });
  it("fast flick coasts, then ends on a week start", () => {
    const { e, run } = make();
    e.pointerDown(200, 0);
    e.pointerMove(260, 30);
    e.pointerMove(320, 60);
    e.pointerUp(62);
    expect(e.mode).toBe("coast");
    const before = e.day;
    run(62);
    expect(e.day).toBeGreaterThan(before);
    expect(e.day % 7).toBe(0);
    expect(e.mode).toBe("idle");
  });
  it("resting before release is not a flick", () => {
    const { e } = make();
    e.pointerDown(200, 0);
    e.pointerMove(300, 20);
    e.pointerUp(400);
    expect(e.mode).toBe("spring");
  });
  it("ticks on week crossings while dragging; month ticks are stronger", () => {
    const { e, ticks } = make();
    e.pointerDown(0, 0);
    e.pointerMove(1000, 1000);
    expect(ticks.filter((t) => t.kind === "week").length).toBeGreaterThan(40);
    expect(ticks.some((t) => t.kind === "month")).toBe(true);
    expect(ticks.some((t) => t.kind === "season")).toBe(true);
  });
  it("track click glides in 250 ms with ticks, ends exactly on the target", () => {
    const { e, ticks } = make();
    e.clickTrack(dayToX(100, 1000), 0);
    expect(e.mode).toBe("glide");
    e.step(125);
    expect(e.day).toBeGreaterThan(50); // ease-out: past halfway at half time
    e.step(250);
    expect(e.day).toBe(100);
    expect(e.mode).toBe("idle");
    expect(ticks.length).toBeGreaterThan(10);
  });
  it("keyboard steps tick and cancel animation", () => {
    const { e, ticks } = make({ initialDay: 6 });
    expect(e.key("ArrowRight")).toBe(true);
    expect(e.day).toBe(7);
    expect(ticks).toEqual([{ kind: "week", day: 7 }]);
    expect(e.key("a")).toBe(false);
  });
  it("reduced motion: snaps instantly, no flick or glide", () => {
    const { e } = make({ reducedMotion: true });
    e.pointerDown(500, 0);
    e.pointerMove(503, 10);
    e.pointerUp(12);
    expect(e.mode).toBe("idle");
    expect(Number.isInteger(e.day)).toBe(true);
    e.clickTrack(dayToX(200, 1000), 100);
    expect(e.day).toBe(200);
  });
  it("coast stops at the edge and snaps", () => {
    const { e, run } = make({ initialDay: 340 });
    e.pointerDown(930, 0);
    e.pointerMove(990, 20);
    e.pointerMove(1040, 40);
    e.pointerUp(41);
    run(41);
    expect(e.day).toBeLessThanOrEqual(LAST_DAY);
    expect(e.mode).toBe("idle");
  });
});

it("nearestWeekDay clamps", () => {
  expect(nearestWeekDay(363)).toBe(LAST_DAY - 0 === 364 ? 364 : 364);
  expect(nearestWeekDay(10)).toBe(7);
});
