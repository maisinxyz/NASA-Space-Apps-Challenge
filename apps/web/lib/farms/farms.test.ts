import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { farmById, FARMS, twinConfig } from "./index";

const WEB = join(__dirname, "..", "..");
const twins = FARMS.filter((f) => f.tier === "twin");

describe("farm list", () => {
  it("has the chosen farms, Cornell and Beltsville as twins, Agassiz and Lancaster gone", () => {
    expect(FARMS.map((f) => f.id).slice(0, 3)).toEqual(["cornell-ruminant", "usda-barc", "ucdavis-oakville"]);
    expect(farmById("lancaster-intercourse")).toBeNull();
    expect(twins.map((f) => f.id)).toEqual(["cornell-ruminant", "usda-barc"]);
    expect(farmById("agassiz")).toBeNull();
  });

  it.each(FARMS)("$id is sourced and in range", (f) => {
    expect(f.name && f.owner && f.country).toBeTruthy();
    expect(f.sourceUrl).toMatch(/^https:\/\/\S+$/);
    expect(Math.abs(f.lon)).toBeLessThanOrEqual(180);
    expect(Math.abs(f.lat)).toBeLessThanOrEqual(90);
    expect(f.radiusM).toBeGreaterThan(0);
    if (f.areaHa !== undefined) expect(f.areaHa).toBeGreaterThan(0);
    if (f.note?.url) expect(f.note.url).toMatch(/^https:\/\/\S+$/);
  });

  it("no pin has verified (published) coordinates", () => {
    expect(FARMS.filter((f) => f.coordsVerified)).toEqual([]);
  });

  it("has no twin for explore farms or unknown ids", () => {
    for (const f of FARMS.filter((x) => x.tier === "explore")) expect(twinConfig(f.id)).toBeUndefined();
    expect(twinConfig("nope")).toBeUndefined();
    expect(twinConfig(null)).toBeUndefined();
    expect(farmById(null)).toBeNull();
  });
});

describe.each(twins)("twin $id", (farm) => {
  const t = () => twinConfig(farm.id)!;

  it("has 2+ valid fields with unique ids, inside a ~1–1.5 km square sim area", () => {
    const { fields, simBbox, phases } = t();
    expect(fields.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
    const [w, so, e, n] = simBbox;
    for (const f of fields) {
      expect(f.ring.length).toBeGreaterThanOrEqual(3);
      expect(f.areaHa).toBeGreaterThan(0);
      for (const [lon, lat] of f.ring) {
        expect(lon).toBeGreaterThan(w);
        expect(lon).toBeLessThan(e);
        expect(lat).toBeGreaterThan(so);
        expect(lat).toBeLessThan(n);
      }
    }
    for (const id of Object.keys(phases)) expect(fields.some((f) => f.id === id)).toBe(true);
    const heightM = (n - so) * 111320;
    const widthM = (e - w) * 111320 * Math.cos((((n + so) / 2) * Math.PI) / 180);
    expect(widthM / heightM).toBeGreaterThan(0.9);
    expect(widthM / heightM).toBeLessThan(1.1);
    expect(heightM).toBeGreaterThan(800);
    expect(heightM).toBeLessThan(2000);
  });

  it("carries honesty labels, attribution and three rotations", () => {
    const { labels, attribution, rotations, cropLabels } = t();
    expect(labels).toContain("Approximate field boundaries");
    expect(labels).toContain("Illustrative field layout and crops (not farm records)");
    expect(attribution.length).toBeGreaterThan(0);
    expect(rotations).toHaveLength(3);
    expect(cropLabels.bare).toBe("Bare soil");
  });
});

describe("components stay farm-agnostic", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(WEB, dir), { recursive: true, encoding: "utf8" })
      .filter((p) => /\.tsx?$/.test(p))
      .map((p) => join(dir, p));

  it("no component or page imports a specific farm file", () => {
    const bad = [...files("components"), ...files("app")].filter((p) => /from\s+["']@\/lib\/farms\/(?!index["'])|lib\/twin\/agassiz/.test(readFileSync(join(WEB, p), "utf8")));
    expect(bad).toEqual([]);
  });
});
