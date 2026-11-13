import { describe, expect, it } from "vitest";

import { farmById, FARMS } from "./farms";

describe("farm list", () => {
  it("has 6 to 8 farms with unique ids and exactly one full twin", () => {
    expect(FARMS.length).toBeGreaterThanOrEqual(6);
    expect(FARMS.length).toBeLessThanOrEqual(8);
    expect(new Set(FARMS.map((f) => f.id)).size).toBe(FARMS.length);
    expect(FARMS.filter((f) => f.tier === "twin").map((f) => f.id)).toEqual(["agassiz"]);
  });

  it("covers one farm per country", () => {
    expect(new Set(FARMS.map((f) => f.country)).size).toBe(FARMS.length);
  });

  it.each(FARMS)("$id is sourced and in range", (f) => {
    expect(f.name && f.owner && f.country).toBeTruthy();
    expect(f.sourceUrl).toMatch(/^https:\/\/\S+$/);
    expect(Math.abs(f.lon)).toBeLessThanOrEqual(180);
    expect(Math.abs(f.lat)).toBeLessThanOrEqual(90);
    expect(f.radiusM).toBeGreaterThan(0);
    if (f.areaHa !== undefined) expect(f.areaHa).toBeGreaterThan(0);
  });

  it("looks farms up by id", () => {
    expect(farmById("agassiz")?.tier).toBe("twin");
    expect(farmById("nope")).toBeNull();
    expect(farmById(null)).toBeNull();
  });
});
