import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";

import { buildFutureData, CURRENT_ROTATION, cropName, engineSeries, forecastYear, pointAt, rotationText } from "./data";

const ubc = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;

describe("buildFutureData", () => {
  it("falls back to the synthetic fixtures without a forecast", () => {
    const d = buildFutureData(null);
    expect(d.source).toBe("synthetic");
    expect(d.strategies.map((s) => s.id)).toEqual(["current", "a", "b"]);
    expect(d.flags.current.length).toBeGreaterThan(0);
  });

  it("maps the engine strategies in order, existing first, named Current rotation", () => {
    const d = buildFutureData(ubc);
    expect(d.source).toBe("engine");
    expect(d.strategies.map((s) => s.engineId)).toEqual(["rot_existing", "rot_alt_1", "rot_alt_2"]);
    expect(d.strategies[0].name).toBe(CURRENT_ROTATION);
    expect(d.strategies[1].name).toBe(ubc.fields[0].strategies[1].label);
    expect(d.strategies[0].rotation).toBe("barley · pea (field) · wheat (winter)");
  });

  it("merges flags repeated per field and keeps the field list", () => {
    const d = buildFutureData(ubc);
    const texts = d.flags.current.map((f) => f.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(d.flags.current[0].fieldIds.length).toBe(ubc.fields.length);
    expect(["verify", "caution", "info"]).toContain(d.flags.current[0].severity);
  });

  it("is deterministic", () => expect(buildFutureData(ubc)).toEqual(buildFutureData(ubc)));
});

describe("series helpers", () => {
  it("reads farm and field trajectories with unit and range", () => {
    const farm = engineSeries(ubc, "rot_existing", "soil_organic_index")!;
    const field = engineSeries(ubc, "rot_existing", "soil_organic_index", "d3-brassicas")!;
    expect(farm.points.length).toBe(11);
    expect(field).not.toBeNull();
    const p = pointAt(farm, 5);
    expect(p.unit).toBeTruthy();
    expect(p.p10).not.toBeNull();
    expect(engineSeries(ubc, "rot_nope", "soil_organic_index")).toBeNull();
  });

  it("clamps the clock to forecast years 1..horizon", () => {
    expect(forecastYear(0)).toBe(1);
    expect(forecastYear(4.5)).toBe(5);
    expect(forecastYear(9.99)).toBe(10);
  });

  it("names crops and rotations", () => {
    expect(cropName("crop_rye_cover")).toBe("rye (cover)");
    expect(cropName("fallow")).toBe("fallow");
    expect(rotationText([{ year_index: 1, season: "spring", crop_id: "crop_barley" }, { year_index: 2, season: "spring", crop_id: "crop_barley" }], 2)).toBe("barley");
  });
});
