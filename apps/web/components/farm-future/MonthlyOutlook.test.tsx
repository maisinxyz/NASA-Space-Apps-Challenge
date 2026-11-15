import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { kindLabel, monthLabel } from "./MonthlyOutlook";

const outlook = JSON.parse(readFileSync(resolve(__dirname, "../../../../packages/contracts/fixtures/outlook/site_ubc_farm_outlook.json"), "utf-8"));

describe("monthly outlook", () => {
  it("labels the source and the months", () => {
    expect(kindLabel("climatology")).toBe("Typical year");
    expect(kindLabel("seasonal_forecast")).toBe("Seasonal forecast");
    expect(kindLabel("ensemble_blend")).toBe("ensemble blend");
    expect(monthLabel("2026-12")).toBe("Dec 2026");
    expect(monthLabel(outlook.months[1].month)).toBe("Jan 2027");
  });
});
