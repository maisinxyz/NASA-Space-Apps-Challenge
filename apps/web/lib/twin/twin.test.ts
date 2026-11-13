import { describe, expect, it } from "vitest";

import { AGASSIZ_FIELDS, AGASSIZ_SIM_BBOX, ROTATING_FIELDS } from "./agassiz";
import { bareMonths, cropsForSeason, PRIORITIES, rankRotations, ROTATIONS } from "./rotations";
import { SCENARIOS } from "./scenario";

const even = { water: 1, erosion: 1, soilCover: 1, income: 1 };

describe("agassiz twin data", () => {
  it("has 2–3 valid fields", () => {
    expect(AGASSIZ_FIELDS.length).toBeGreaterThanOrEqual(2);
    expect(AGASSIZ_FIELDS.length).toBeLessThanOrEqual(3);
    expect(new Set(AGASSIZ_FIELDS.map((f) => f.id)).size).toBe(AGASSIZ_FIELDS.length);
    for (const f of AGASSIZ_FIELDS) {
      expect(f.ring.length).toBeGreaterThanOrEqual(3);
      expect(f.areaHa).toBeGreaterThan(0);
    }
    for (const id of Object.keys(ROTATING_FIELDS)) expect(AGASSIZ_FIELDS.some((f) => f.id === id)).toBe(true);
  });

  it("keeps every field fully inside a roughly square simulation area", () => {
    const [w, so, e, n] = AGASSIZ_SIM_BBOX;
    for (const f of AGASSIZ_FIELDS) for (const [lon, lat] of f.ring) {
      expect(lon).toBeGreaterThan(w);
      expect(lon).toBeLessThan(e);
      expect(lat).toBeGreaterThan(so);
      expect(lat).toBeLessThan(n);
    }
    const heightM = (n - so) * 111320;
    const widthM = (e - w) * 111320 * Math.cos((((n + so) / 2) * Math.PI) / 180);
    expect(widthM / heightM).toBeGreaterThan(0.97);
    expect(widthM / heightM).toBeLessThan(1.03);
    expect(heightM).toBeGreaterThan(1000);
    expect(heightM).toBeLessThan(1500);
  });

  it("has exactly three rotations, one existing, each complete", () => {
    expect(ROTATIONS).toHaveLength(3);
    expect(ROTATIONS.filter((r) => r.isExisting)).toHaveLength(1);
    for (const r of ROTATIONS) {
      expect(r.id).toMatch(/^rot_[A-Za-z0-9_-]+$/);
      expect(r.card.rotation_id).toBe(r.id);
      for (const y of r.years) expect(y).toHaveLength(12);
      for (const p of PRIORITIES) expect(r.scores[p]).toBeGreaterThanOrEqual(1);
      for (const k of ["evidence", "benefits", "information_gaps", "risks_for_local_review"] as const) expect(r.card[k].length).toBeGreaterThan(0);
    }
  });

  it("has no climate scenario until real data exists", () => {
    expect(SCENARIOS).toHaveLength(0);
  });
});

describe("bareMonths", () => {
  it("counts bare months per year and overall", () => {
    const b = bareMonths({ years: [["bare", "bare", ...Array(10).fill("corn")], Array(12).fill("bare")] });
    expect(b.perYear).toEqual([2, 12]);
    expect(b.total).toBe(14);
    expect(b.share).toBeCloseTo(14 / 24);
  });
  it("rates the cover-crop rotation as the least bare", () => {
    const [existing, cover] = ROTATIONS.map((r) => bareMonths(r).share);
    expect(cover).toBeLessThan(existing);
  });
});

describe("rankRotations", () => {
  const rs = [
    { id: "a", scores: { water: 1, erosion: 1, soilCover: 1, income: 5 } },
    { id: "b", scores: { water: 5, erosion: 5, soilCover: 5, income: 1 } },
    { id: "c", scores: { water: 3, erosion: 3, soilCover: 3, income: 3 } },
  ];
  it("follows the weights", () => {
    expect(rankRotations(rs, { water: 0, erosion: 0, soilCover: 0, income: 1 }).map((x) => x.rotation.id)).toEqual(["a", "c", "b"]);
    expect(rankRotations(rs, { water: 1, erosion: 1, soilCover: 0, income: 0 }).map((x) => x.rotation.id)).toEqual(["b", "c", "a"]);
  });
  it("keeps input order on ties", () => {
    expect(rankRotations(rs, { water: 0, erosion: 0, soilCover: 0, income: 0 }).map((x) => x.rotation.id)).toEqual(["a", "b", "c"]);
    expect(rankRotations(rs, even).map((x) => x.total)).toEqual([16, 12, 8]);
  });
});

describe("cropsForSeason", () => {
  it("rotates only rotating fields, offset by phase", () => {
    const fields = AGASSIZ_FIELDS.slice(0, 2).map((f, i) => ({ ...f, id: `x${i}`, crop: "berry" as const }));
    const r = { years: [Array(12).fill("corn"), Array(12).fill("cereal")] };
    expect(cropsForSeason(fields, { x0: 1 }, r, 0, 6)).toEqual({ x0: "cereal", x1: "berry" });
    expect(cropsForSeason(fields, { x0: 1 }, r, 1, 6)).toEqual({ x0: "corn", x1: "berry" });
  });
});
