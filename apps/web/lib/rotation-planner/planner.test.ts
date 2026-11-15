import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";
import { baseRequest } from "@/lib/forecast/sites";

import { buildRequest, calendarOf, cropColour, inputFrom, plainSource, roleLabel, ruleStatus, setCell, strategiesFor, validate } from "./planner";

const base = baseRequest("site_ubc_farm")!;
const ubc = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;

describe("rotation planner", () => {
  it("starts from the farm's request and round-trips it", () => {
    const i = inputFrom(base);
    const body = buildRequest(base, i);
    expect(body.selection.crops).toEqual(base.selection.crops);
    expect(body.strategy_count).toBe(3);
    expect(body.custom_strategies).toBeUndefined();
  });

  it("sends pins, exclusions, quota, count and the custom rotation", () => {
    const i = { ...inputFrom(base), pinned: ["crop_red_clover"], excluded: ["crop_soybean"], waterQuotaMm: 120, strategyCount: 4 };
    const custom = setCell(setCell([], 1, "spring", "crop_barley"), 1, "fall", "crop_rye_cover");
    const body = buildRequest(base, { ...i, custom });
    expect(body.selection.pinned).toEqual(["crop_red_clover"]);
    expect(body.selection.excluded).toEqual(["crop_soybean"]);
    expect(body.farm_water_quota_mm_per_season).toBe(120);
    expect(body.strategy_count).toBe(4);
    expect(body.custom_strategies).toEqual([[{ year_index: 1, season: "spring", crop_id: "crop_barley" }, { year_index: 1, season: "fall", crop_id: "crop_rye_cover" }]]);
  });

  it("explains what blocks a run", () => {
    expect(validate({ ...inputFrom(base), pool: ["crop_barley"] })).toHaveLength(1);
    expect(validate({ ...inputFrom(base), pinned: ["crop_barley"], excluded: ["crop_barley"] })[0]).toMatch(/pinned and excluded/);
    expect(validate(inputFrom(base))).toEqual([]);
  });

  it("lays out a plan by season and month", () => {
    const { strategies } = strategiesFor(ubc, null);
    expect(strategies[0].role).toBe("existing");
    const cal = calendarOf(strategies[0].plan, 1);
    expect(cal).toHaveLength(12);
    expect(cal[3]).toBe("crop_barley"); // April = spring of year 1
  });

  it("renders unknown enum values neutrally and hides TODO tags", () => {
    expect(ruleStatus("met").tone).toBe("good");
    expect(ruleStatus("someday").tone).toBe("neutral");
    expect(roleLabel("nitrogen_fixing")).toBe("Nitrogen-fixing");
    expect(roleLabel("new_role")).toBe("new role");
    expect(plainSource("Team value TODO(verify) with an agronomist")).not.toContain("TODO");
    expect(cropColour("crop_barley")).toBe(cropColour("crop_barley"));
  });
});
