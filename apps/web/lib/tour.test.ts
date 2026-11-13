import { describe, expect, it } from "vitest";

import { initialState } from "./store";
import { TOUR, tourDurationMs } from "./tour";

describe("guided tour", () => {
  it("covers the 8 hero beats in order", () => {
    expect(TOUR.map((s) => s.beat)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("totals under 90 s", () => {
    expect(tourDurationMs()).toBeLessThan(90_000);
  });

  it("only patches known store keys and visits real routes", () => {
    for (const s of TOUR) {
      for (const k of Object.keys(s.patch)) expect(k in initialState).toBe(true);
      expect(["/explore", "/viewer", "/simulate", "/lab", "/methods"]).toContain(s.route);
      expect(s.caption.length).toBeGreaterThan(0);
    }
  });
});
