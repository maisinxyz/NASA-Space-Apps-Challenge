import { describe, expect, it } from "vitest";
import { nextSimulationTab } from "./simulation-tabs";

describe("simulation tab keyboard navigation", () => {
  const tabs = ["scenarios", "compare", "evidence", "map"] as const;
  it("wraps arrow navigation and supports Home and End", () => {
    expect(nextSimulationTab(tabs, "map", "ArrowRight")).toBe("scenarios");
    expect(nextSimulationTab(tabs, "scenarios", "ArrowLeft")).toBe("map");
    expect(nextSimulationTab(tabs, "compare", "Home")).toBe("scenarios");
    expect(nextSimulationTab(tabs, "compare", "End")).toBe("map");
    expect(nextSimulationTab(tabs, "compare", "Tab")).toBeNull();
  });
});
