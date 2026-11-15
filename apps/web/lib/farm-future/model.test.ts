import { describe, expect, it } from "vitest";

import { STRATEGIES } from "./fixtures";
import {
  conditionsAt, dateAt, leaderboard, moistureBand, NO_WHAT_IF, scoreWithWhatIf, seriesAt, soilHealthAt, strategyById,
  tOf, waterBalanceAt, waterQuotaAt, whatIfActive,
} from "./model";
import { INITIAL_T, useFutureStore } from "./store";

describe("clock", () => {
  it("maps t to a calendar date", () => {
    expect(dateAt(INITIAL_T)).toMatchObject({ year: 2034, yearIndex: 8, monthName: "July", day: 14 });
    expect(dateAt(0)).toMatchObject({ year: 2026, monthName: "January", day: 1 });
    expect(dateAt(99).year).toBe(2035);
    expect(dateAt(-3).year).toBe(2026);
  });
  it("interpolates yearly series between year midpoints", () => {
    expect(seriesAt([0, 10], 0.5)).toBe(0);
    expect(seriesAt([0, 10], 1.5)).toBe(10);
    expect(seriesAt([0, 10], 1.0)).toBe(5);
  });
});

describe("what-if", () => {
  it("is deterministic and neutral at zero", () => {
    expect(conditionsAt(INITIAL_T, NO_WHAT_IF)).toEqual(conditionsAt(INITIAL_T, NO_WHAT_IF));
    expect(whatIfActive(NO_WHAT_IF)).toBe(false);
    for (const s of STRATEGIES) expect(scoreWithWhatIf(s, NO_WHAT_IF)).toBe(s.score2035);
  });
  it("drier and hotter moves every headline the expected way", () => {
    const base = conditionsAt(INITIAL_T, NO_WHAT_IF);
    const w = { rainPct: -10, tempC: 1.5 };
    const c = conditionsAt(INITIAL_T, w);
    expect(c.rainMm).toBeLessThan(base.rainMm);
    expect(c.heatDays).toBeGreaterThan(base.heatDays);
    expect(c.moisturePct).toBeLessThan(base.moisturePct);
    expect(waterBalanceAt(INITIAL_T, w).net).toBeLessThan(waterBalanceAt(INITIAL_T, NO_WHAT_IF).net);
  });
  it("matches the design's sensitivity strip for rain −10 %, +1.5 °C", () => {
    const w = { rainPct: -10, tempC: 1.5 };
    expect(scoreWithWhatIf(strategyById("current"), w)).toBe(52);
    expect(scoreWithWhatIf(strategyById("a"), w)).toBe(74);
    expect(scoreWithWhatIf(strategyById("b"), w)).toBe(66);
  });
});

describe("derived views", () => {
  it("uncertainty widens with years out", () => {
    const near = moistureBand(0.5, NO_WHAT_IF);
    const far = moistureBand(9.5, NO_WHAT_IF);
    expect(far.p90 - far.p10).toBeGreaterThan(near.p90 - near.p10);
    expect(far.p10).toBeLessThan(far.p50);
  });
  it("leaderboard is sorted and covers all strategies", () => {
    const lb = leaderboard(9.9, NO_WHAT_IF);
    expect(lb.map((r) => r.s.id)).toEqual(["a", "b", "current"]);
  });
  it("current rotation goes over quota by 2035; strategy A does not", () => {
    expect(waterQuotaAt(strategyById("current"), 9.99, NO_WHAT_IF)).toBeGreaterThan(100);
    expect(waterQuotaAt(strategyById("a"), 9.99, NO_WHAT_IF)).toBeLessThan(100);
  });
  it("soil organic matter builds under strategy A", () => {
    const a = soilHealthAt(strategyById("a"), tOf(9, 0));
    expect(a.omPct).toBeGreaterThan(2.5);
    expect(a.profileNow[0].v).toBeGreaterThan(a.profile2026[0].v);
  });
});

describe("store: one lens, one panel", () => {
  it("lens and panels exclude each other; Now clears the lens", () => {
    const s = useFutureStore.getState();
    s.setMode("future");
    s.setLens("water");
    expect(useFutureStore.getState().panel).toBe("lens");
    s.openPanel("whatif");
    expect(useFutureStore.getState().panel).toBe("whatif");
    s.setLens("erosion");
    expect(useFutureStore.getState()).toMatchObject({ lens: "erosion", panel: "lens", zoom: "1y" });
    s.setMode("now");
    expect(useFutureStore.getState().lens).toBeNull();
  });
  it("goTo deep-links into future mode at a date", () => {
    useFutureStore.getState().goTo(5, 196, "main-block");
    const st = useFutureStore.getState();
    expect(st.mode).toBe("future");
    expect(dateAt(st.t).year).toBe(2031);
    expect(st.focusFieldId).toBe("main-block");
  });
});
