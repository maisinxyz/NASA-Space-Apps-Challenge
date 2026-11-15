import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useAppStore } from "@/lib/store";
import { useForecastStore } from "@/lib/forecast/store";
import { describe, expect, it, vi } from "vitest";

import type { Forecast } from "@/lib/api/types";

import { RotationComparison, heroNumbers, HIDDEN_EVIDENCE } from "./RotationComparison";

vi.mock("@/lib/farm-future/useFutureData", async () => {
  const { useForecastStore } = await import("@/lib/forecast/store");
  return { useFutureData: () => ({ forecast: useForecastStore.getState().forecast }) };
});
vi.mock("@/lib/forecast/store", async (original) => {
  const actual = await original<typeof import("@/lib/forecast/store")>();
  const hook = Object.assign(() => actual.useForecastStore.getState(), actual.useForecastStore);
  return { ...actual, useForecastStore: hook };
});

const ubc = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;

describe("rotation comparison", () => {
  it("hero numbers: soil, water vs quota, frost-free and heat-stress days, each with a unit", () => {
    const s = ubc.fields[0].strategies[1];
    const farm = heroNumbers(ubc, s, null, 10);
    expect(farm.map((h) => h.label)).toEqual([
      "Soil richness (organic matter; 100 = today)",
      "Extra watering needed, against your water allowance",
      "Weeks the ground is bare",
      "Days without frost (whole farm)",
      expect.stringMatching(/^Very hot days for /),
    ]);
    expect(farm[1].value).toMatch(/mm/);
    expect(farm[2].value).toMatch(/weeks/);
    expect(farm[3].value).toMatch(/days/);
    const field = heroNumbers(ubc, s, s.id && ubc.fields[0].field_id, 10);
    expect(field[0].value).not.toBe("");
  });

  it("hides money and fertilizer evidence (D3)", () => {
    expect(HIDDEN_EVIDENCE.test("Income estimate CAD")).toBe(true);
    expect(HIDDEN_EVIDENCE.test("Fertilizer saved kg N/ha")).toBe(true);
    expect(HIDDEN_EVIDENCE.test("Year 10 soil organic matter")).toBe(false);
  });
});

  it("never substitutes field metrics for a missing whole-farm rollup", () => {
    const f = structuredClone(ubc);
    f.farm_rollup.strategies = [];
    const values = heroNumbers(f, f.fields[0].strategies[0], null, 10);
    expect(values[0].value).toBe("Unavailable");
    expect(values[1].value).toBe("Unavailable");
  });

  it("keeps provenance, whole-farm flag scope and first-year planting entry", () => {
    useAppStore.setState({ farmId: "ubc-farm" });
    const f = structuredClone(ubc);
    f.fields[1].strategies[0].review_flags[0].text = "Concern in another field";
    useForecastStore.setState({ siteId: f.site_id, forecast: f, source: "live", status: "ready", error: null });
    const html = renderToStaticMarkup(createElement(RotationComparison));
    expect(html).toContain("Live engine run");
    expect(html).toContain("NASA POWER daily point");
    expect(html).toContain("The crop order shown is for D3-1 Brassicas");
    expect(html).toContain("the numbers cover the whole farm");
    expect(html).toContain("What if I plant a different crop this year?");
    useForecastStore.getState().reset();
  });
  it("shows a recoverable API error instead of treating it as missing farm data", () => {
    useAppStore.setState({ farmId: "ubc-farm" });
    useForecastStore.setState({ siteId: "site_ubc_farm", forecast: null, source: null, status: "error", error: "Test API failure" });
    const html = renderToStaticMarkup(createElement(RotationComparison));
    expect(html).toContain("Test API failure");
    expect(html).toContain("Retry forecast");
    useForecastStore.getState().reset();
  });

describe("scope separation", () => {
  const scoped = () => {
    const f = structuredClone(ubc);
    const id = f.fields[0].strategies[0].id;
    f.fields[0].strategies[0].trajectories.bare_weeks = { ...f.fields[0].strategies[0].trajectories.bare_weeks, points: [{ year: 10, p50: 11 }] } as never;
    f.farm_rollup.strategies.find((s) => s.id === id)!.trajectories.bare_weeks = { ...f.farm_rollup.strategies[0].trajectories.bare_weeks, points: [{ year: 10, p50: 22 }] } as never;
    return { f, id };
  };
  it("whole farm shows rollup numbers, a field shows its own", () => {
    const { f, id } = scoped();
    const s = f.fields[0].strategies[0];
    expect(heroNumbers(f, s, null, 10).find((h) => h.label === "Weeks the ground is bare")!.value).toMatch(/^22/);
    expect(heroNumbers(f, s, f.fields[0].field_id, 10).find((h) => h.label === "Weeks the ground is bare")!.value).toMatch(/^11/);
    expect(id).toBe(s.id);
  });
  it("missing rollup bare weeks stays Unavailable, distinct from zero", () => {
    const { f } = scoped();
    f.farm_rollup.strategies.forEach((x) => { delete (x.trajectories as Record<string, unknown>).bare_weeks; });
    const s = f.fields[0].strategies[0];
    expect(heroNumbers(f, s, null, 10).find((h) => h.label === "Weeks the ground is bare")!.value).toBe("Unavailable");
    s.trajectories.bare_weeks = { ...s.trajectories.bare_weeks, points: [{ year: 10, p50: 0 }] } as never;
    expect(heroNumbers(f, s, s.id && f.fields[0].field_id, 10).find((h) => h.label === "Weeks the ground is bare")!.value).toMatch(/^0/);
  });
  it("groups whole-farm flags by field", () => {
    const f = structuredClone(ubc);
    f.fields[1].strategies[0].review_flags[0].text = "Concern in another field";
    useAppStore.setState({ farmId: "ubc-farm" });
    useForecastStore.setState({ siteId: f.site_id, forecast: f, source: "prebuilt", status: "ready", error: null });
    const html = renderToStaticMarkup(createElement(RotationComparison));
    expect(html).toContain("comparison-flag-group");
    expect(html).toContain(f.fields[1].name);
    useForecastStore.getState().reset();
  });
});

it("shows an accepted custom strategy after the generated alternatives", () => {
  const f = structuredClone(ubc);
  const original = f.fields[0].strategies[0];
  f.fields[0].strategies = [0, 1, 2, 3, 4].map((i) => ({ ...original, id: `rot_test_${i}`, label: i === 4 ? "My custom rotation" : `Option ${i}`, role: i === 4 ? "custom" : "alternative" })) as Forecast["fields"][number]["strategies"];
  useForecastStore.setState({ siteId: f.site_id, forecast: f, source: "live", status: "ready", error: null });
  expect(renderToStaticMarkup(createElement(RotationComparison))).toContain("My custom rotation");
  useForecastStore.getState().reset();
});

describe("baseline labels", () => {
  const render = (roles: string[]) => {
    const f = structuredClone(ubc);
    const base = f.fields[0].strategies[0];
    f.fields[0].strategies = roles.map((role, i) => ({ ...base, id: `rot_lbl_${i}`, role })) as Forecast["fields"][number]["strategies"];
    useForecastStore.setState({ siteId: f.site_id, forecast: f, source: "live", status: "ready", error: null });
    const html = renderToStaticMarkup(createElement(RotationComparison));
    useForecastStore.getState().reset();
    return html;
  };
  it("marks the preset current rotation as an illustrative baseline needing local confirmation", () => {
    const html = render(["existing", "alternative"]);
    expect(html).toContain("Illustrative baseline");
    expect(html).toContain("confirm locally");
    expect(html).not.toContain("Farmer-entered plan");
  });
  it("distinguishes a farmer-entered custom plan", () => {
    const html = render(["existing", "custom"]);
    expect(html).toContain("Farmer-entered plan");
    expect(html.match(/Illustrative baseline/g)).toHaveLength(1);
  });
});
