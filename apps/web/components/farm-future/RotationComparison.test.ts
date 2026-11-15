import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Forecast } from "@/lib/api/types";

import { heroNumbers, HIDDEN_EVIDENCE } from "./RotationComparison";

const ubc = JSON.parse(readFileSync(resolve(__dirname, "../../public/prebuilt/site_ubc_farm_forecast.json"), "utf-8")) as Forecast;

describe("rotation comparison", () => {
  it("hero numbers: soil, water vs quota, frost-free and heat-stress days, each with a unit", () => {
    const s = ubc.fields[0].strategies[1];
    const farm = heroNumbers(ubc, s, null, 10);
    expect(farm.map((h) => h.label)).toEqual([
      "Soil health (organic matter index, year 0 = 100)",
      "Irrigation need against the quota",
      "Frost-free days (whole farm)",
      expect.stringMatching(/^Heat-stress days for /),
    ]);
    expect(farm[1].value).toMatch(/mm/);
    expect(farm[2].value).toMatch(/days/);
    const field = heroNumbers(ubc, s, s.id && ubc.fields[0].field_id, 10);
    expect(field[0].value).not.toBe("");
  });

  it("hides money and fertilizer evidence (D3)", () => {
    expect(HIDDEN_EVIDENCE.test("Income estimate CAD")).toBe(true);
    expect(HIDDEN_EVIDENCE.test("Fertilizer saved kg N/ha")).toBe(true);
    expect(HIDDEN_EVIDENCE.test("Year 10 soil organic matter")).toBe(false);
  });
});
