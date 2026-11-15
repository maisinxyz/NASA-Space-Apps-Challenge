import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";
import { firstYearSlots, PLANTING_STRATEGY_ID, plantingPair, plantingRequest } from "./planting";
import { baseRequest } from "./sites";

const forecast = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;
const base = baseRequest(forecast.site_id)!;
const field = forecast.fields[0];
const original = field.strategies.find((strategy) => strategy.role === "existing")!;
const slot = firstYearSlots(original.plan)[0];

describe("first-year planting comparison", () => {
  it("sends only the chosen field and matches the same planting across both weather runs", () => {
    const input = base.fields!.find((item) => item.field_id === field.field_id)!;
    const historical = plantingRequest(base, input, slot, "crop_pea_field", "baseline");
    const dry = plantingRequest(base, input, slot, "crop_pea_field", "drier_summers");
    expect(historical.fields).toEqual([{ ...input, first_year_planting: { season: slot.season, crop_id: "crop_pea_field" } }]);
    expect(dry).toEqual({ ...historical, scenario: "drier_summers" });
    expect(dry.climate_source).toBe("cmip6_delta");
    expect(input).not.toHaveProperty("first_year_planting");
  });

  it("excludes ambiguous first-year seasons and every later planting", () => {
    expect(firstYearSlots([slot, { ...slot, crop_id: "crop_pea_field" }, { ...slot, year_index: 2 }])).toEqual([]);
  });

  it("rejects stale or mock responses and locates the actual matched strategies", () => {
    const crop = "crop_pea_field";
    expect(() => plantingPair(forecast, field.field_id, slot, crop)).toThrow(/did not return/);
    const changed = {
      ...original, id: PLANTING_STRATEGY_ID,
      plan: original.plan.map((item) => item === slot ? { ...item, crop_id: crop } : item),
    };
    const live = { ...forecast, fields: [{ ...field, strategies: [original, changed] }] };
    expect(plantingPair(live, field.field_id, slot, crop)).toEqual({ baseline: original, changed });
  });
});
