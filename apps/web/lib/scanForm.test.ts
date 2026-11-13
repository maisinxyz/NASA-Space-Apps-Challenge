import { describe, expect, it } from "vitest";

import { validateScanForm } from "./scanForm";

const ok = { lat: "49.1", lon: "-122.3", name: "", images: [] };

describe("validateScanForm", () => {
  it("accepts a valid location without photos", () => {
    expect(validateScanForm(ok)).toEqual({ errors: {}, input: { lat: 49.1, lon: -122.3 } });
  });

  it("rejects missing, non-numeric and out-of-range coordinates", () => {
    expect(validateScanForm({ ...ok, lat: "" }).errors.lat).toMatch(/Enter/);
    expect(validateScanForm({ ...ok, lon: "abc" }).errors.lon).toMatch(/number/);
    expect(validateScanForm({ ...ok, lat: "91" }).errors.lat).toMatch(/between -90 and 90/);
    expect(validateScanForm({ ...ok, lon: "-180.5" }).errors.lon).toMatch(/between -180 and 180/);
    expect(validateScanForm({ ...ok, lat: "91" }).input).toBeUndefined();
  });

  it("enforces photo count, type and name length", () => {
    const img = { name: "a.jpg", type: "image/jpeg" };
    expect(validateScanForm({ ...ok, images: Array(7).fill(img) }).errors.images).toMatch(/at most 6/);
    expect(validateScanForm({ ...ok, images: [{ name: "x.gif", type: "image/gif" }] }).errors.images).toMatch(/x.gif/);
    expect(validateScanForm({ ...ok, name: "n".repeat(121) }).errors.name).toBeDefined();
    expect(validateScanForm({ ...ok, name: " Home field ", images: [img] }).input).toEqual({ lat: 49.1, lon: -122.3, name: "Home field" });
  });
});
