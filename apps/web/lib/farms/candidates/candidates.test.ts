import { describe, expect, it } from "vitest";

import { CANDIDATE_DATASETS, CANDIDATES, FARMS } from "../index";
import { buildingsFromOverpass, distanceKm, groundRing, median, orbitCamera, overpassQuery, stage1 } from "@/lib/scouting/check";

const ids = CANDIDATES.map((c) => c.farm.id);

describe("candidate farms", () => {
  it("has unique ids, distinct from the chosen farms", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FARMS.slice(0, 3)) expect(ids).not.toContain(f.id);
    expect(ids).not.toContain("lancaster-intercourse");
  });

  it("puts only candidates that passed the 3D check on the globe", () => {
    const pinned = CANDIDATES.filter((c) => c.validation === "pass").map((c) => c.farm.id);
    expect(FARMS.map((f) => f.id).slice(3)).toEqual(pinned);
    for (const c of CANDIDATES.filter((x) => x.validation !== "pass")) expect(FARMS.map((f) => f.id)).not.toContain(c.farm.id);
  });

  it.each(CANDIDATES)("$farm.id is explore-only, approximate, sourced and uses known datasets", (c) => {
    const f = c.farm;
    expect(f.tier).toBe("explore");
    expect(f.coordsVerified).toBe(false);
    expect(f.sourceUrl).toMatch(/^https:\/\/\S+$/);
    expect(f.name && f.owner && f.country).toBeTruthy();
    expect(Math.abs(f.lat)).toBeLessThanOrEqual(90);
    expect(Math.abs(f.lon)).toBeLessThanOrEqual(180);
    expect(CANDIDATE_DATASETS[c.elevation]).toBeDefined();
    expect(CANDIDATE_DATASETS[c.boundaries]).toBeDefined();
    if (c.privacy === "private") {
      expect(f.owner).toMatch(/area only/);
      expect(f.note?.text).toBe("Private working farmland, area only. No owners or addresses are shown.");
      expect(f.minRangeM).toBeGreaterThanOrEqual(250);
    }
  });

  it("keeps pins spread out: every candidate is 500+ km from every other farm (no clustering at globe zoom)", () => {
    const all = [...FARMS.slice(0, 3), ...CANDIDATES.map((c) => c.farm)];
    const close: string[] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        if (i < 3 && j < 3) continue; // Cornell and Beltsville: the two existing full twins, kept as chosen
        if (distanceKm(all[i], all[j]) < 500) close.push(`${all[i].id}/${all[j].id}`);
      }
    expect(close).toEqual([]);
  });

  it("every dataset links to an https page with a licence", () => {
    for (const d of Object.values(CANDIDATE_DATASETS)) {
      expect(d.url).toMatch(/^https:\/\/\S+$/);
      expect(d.licence.length).toBeGreaterThan(0);
    }
  });
});

describe("farm check helpers", () => {
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("stage1 separates real 3D buildings from a flat mesh", () => {
    const real = stage1([
      { roof: 110, localGround: 100, terrain: 101 },
      { roof: 106, localGround: 100, terrain: 99 },
      { roof: 101, localGround: 100, terrain: 100 },
    ]);
    expect(real.buildingsSampled).toBe(3);
    expect(real.share3dLocal).toBeCloseTo(2 / 3);
    expect(real.medianLocalM).toBe(6);
    const flat = stage1([{ roof: 100.4, localGround: 100, terrain: 100 }]);
    expect(flat.share3dLocal).toBe(0);
    expect(stage1([{ roof: undefined, localGround: 1, terrain: 1 }]).share3dLocal).toBeNull();
  });

  it("orbitCamera puts the camera behind and above the target", () => {
    const c = orbitCamera({ lon: 0, lat: 0, ground: 100 }, 1000, -30, 0);
    expect(c.height).toBeCloseTo(600);
    expect(c.lat).toBeLessThan(0); // heading 0 = looking north, so the camera sits south
    expect(distanceKm({ lon: 0, lat: 0 }, c) * 1000).toBeCloseTo(866, -1);
  });

  it("groundRing stays just outside the footprint", () => {
    for (const p of groundRing({ lon: 10, lat: 50, radiusM: 12 })) expect(distanceKm({ lon: 10, lat: 50 }, { lon: p[0], lat: p[1] }) * 1000).toBeCloseTo(20, 0);
  });

  it("parses Overpass geometry into centroids and sizes", () => {
    const b = buildingsFromOverpass({
      elements: [
        { geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.0002 }, { lat: 0.0002, lon: 0.0002 }, { lat: 0.0002, lon: 0 }] },
        { geometry: [{ lat: 1, lon: 1 }] },
      ],
    });
    expect(b).toHaveLength(1);
    expect(b[0].radiusM).toBeCloseTo(11.1, 0);
    expect(overpassQuery(5, 50, 600)).toBe('[out:json][timeout:25];way["building"](around:600,50,5);out geom 150;');
  });
});
