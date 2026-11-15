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

it("maps a reopened mode-bearing section to its active mode", async () => {
  const { modeForSimulationSection } = await import("./simulation-tabs");
  expect(modeForSimulationSection("scenarios")).toBe("simulate");
  expect(modeForSimulationSection("compare")).toBe("compare");
  expect(modeForSimulationSection("evidence")).toBe("evidence");
  expect(modeForSimulationSection("field")).toBeUndefined();
  expect(modeForSimulationSection("map")).toBeUndefined();
});

it("restores fallback panel state only for the requested farm", async () => {
  const { fallbackPanelState } = await import("./simulation-tabs");
  expect(fallbackPanelState("#farm=cornell-ruminant&po=0&ps=compare", "cornell-ruminant")).toEqual({ open: false, section: "compare" });
  expect(fallbackPanelState("#farm=cornell-ruminant&ps=compare", "cornell-ruminant")).toEqual({ open: true, section: "compare" });
  expect(fallbackPanelState("#farm=cornell-ruminant&po=0&ps=compare", "usda-barc")).toEqual({ open: true, section: "scenarios" });
});

it("opens the section implied by a legacy share mode in the fallback", async () => {
  const { fallbackPanelState } = await import("./simulation-tabs");
  expect(fallbackPanelState("#farm=cornell-ruminant&m=compare&sc=storm", "cornell-ruminant")).toEqual({ open: true, section: "compare" });
  expect(fallbackPanelState("#farm=cornell-ruminant&m=evidence", "cornell-ruminant")).toEqual({ open: true, section: "evidence" });
  expect(fallbackPanelState("#farm=cornell-ruminant&m=compare&ps=map", "cornell-ruminant")).toEqual({ open: true, section: "map" });
});
