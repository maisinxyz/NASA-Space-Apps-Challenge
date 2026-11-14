import { describe, expect, it } from "vitest";

import { bareMonths, cropsForSeason, DEFAULT_WEIGHTS, explainRanking, PRIORITIES, PRIORITY_LABELS, rankRotations, ROTATION_SETS, rotationById, type TwinRotation, vsBaseline } from "./rotations";
import { SCENARIOS } from "./scenario";

const even = { water: 1, erosion: 1, soilCover: 1, income: 1 };
const SETS = Object.entries(ROTATION_SETS);

describe.each(SETS)("rotation set %s", (_, rotations) => {
  it("has exactly three rotations: existing baseline, cover, and one more, each complete", () => {
    expect(rotations).toHaveLength(3);
    expect(rotations.map((r) => r.id).slice(0, 2)).toEqual(["rot_existing", "rot_cover"]);
    expect(rotations.filter((r) => r.isExisting).map((r) => r.id)).toEqual(["rot_existing"]);
    expect(new Set(rotations.map((r) => r.id)).size).toBe(3);
    for (const r of rotations) {
      expect(r.id).toMatch(/^rot_[A-Za-z0-9_-]+$/);
      expect(r.card.rotation_id).toBe(r.id);
      for (const y of r.years) expect(y).toHaveLength(12);
      for (const p of PRIORITIES) expect(r.scores[p]).toBeGreaterThanOrEqual(1);
      for (const p of PRIORITIES) expect(r.scores[p]).toBeLessThanOrEqual(5);
      for (const k of ["evidence", "benefits", "information_gaps", "risks_for_local_review"] as const) expect(r.card[k].length).toBeGreaterThan(0);
    }
  });

  it("rates the cover-crop rotation as less bare than the existing one", () => {
    const share = (id: string) => bareMonths(rotationById(rotations, id)!).share;
    expect(share("rot_cover")).toBeLessThan(share("rot_existing"));
  });

  it("with the default equal weights, does not put the baseline first and explains in one sentence", () => {
    const ranked = rankRotations(rotations, DEFAULT_WEIGHTS);
    expect(ranked[0].rotation.isExisting).toBe(false);
    const s = explainRanking(ranked, DEFAULT_WEIGHTS);
    expect(s.split(". ")).toHaveLength(1);
    expect(s.startsWith(ranked[0].rotation.name)).toBe(true);
  });
});

describe("rotation data", () => {
  it("has a regional set for New York dairy and Maryland grain", () => {
    expect(Object.keys(ROTATION_SETS).sort()).toEqual(["md-grain", "ny-dairy"]);
  });
  it("defines the 10 climate scenarios (copy and inputs only; results need backend data)", () => {
    expect(SCENARIOS).toHaveLength(10);
  });
});

describe("bareMonths", () => {
  it("counts bare months per year and overall", () => {
    const b = bareMonths({ years: [["bare", "bare", ...Array(10).fill("corn")], Array(12).fill("bare")] });
    expect(b.perYear).toEqual([2, 12]);
    expect(b.total).toBe(14);
    expect(b.share).toBeCloseTo(14 / 24);
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
    const ring: [number, number][] = [[0, 0], [1, 0], [1, 1]];
    const fields = [0, 1].map((i) => ({ id: `x${i}`, name: `X${i}`, ring, areaHa: 1, crop: "berry" as const }));
    const r = { years: [Array(12).fill("corn"), Array(12).fill("cereal")] };
    expect(cropsForSeason(fields, { x0: 1 }, r, 0, 6)).toEqual({ x0: "cereal", x1: "berry" });
    expect(cropsForSeason(fields, { x0: 1 }, r, 1, 6)).toEqual({ x0: "corn", x1: "berry" });
  });
});

describe("vsBaseline", () => {
  it("puts a score in words against the existing one", () => {
    expect(vsBaseline(4, 2)).toBe("higher");
    expect(vsBaseline(2, 2)).toBe("similar");
    expect(vsBaseline(1, 2)).toBe("lower");
  });
});

describe("explainRanking", () => {
  const rot = (name: string, scores: Record<string, number>, isExisting = false) => ({ name, isExisting, scores: scores as TwinRotation["scores"] });
  const A = rot("Alpha", { water: 1, erosion: 1, soilCover: 1, income: 5 }, true);
  const B = rot("Beta", { water: 5, erosion: 4, soilCover: 2, income: 1 });

  it("names the biggest weighted gains over the runner-up", () => {
    const w = { water: 3, erosion: 3, soilCover: 3, income: 1 };
    expect(explainRanking(rankRotations([A, B], w), w)).toBe("Beta is first because, with the weights you set, it scores higher than Alpha on water conservation and erosion control.");
  });

  it("says when only economic fit puts the existing rotation first", () => {
    const w = { water: 0, erosion: 0, soilCover: 0, income: 5 };
    expect(explainRanking(rankRotations([A, B], w), w)).toBe("Alpha is first because, with the weights you set, it scores higher than Beta on economic fit (proxy).");
  });

  it("explains ties and all-zero weights without inventing a reason", () => {
    const tie = { water: 1, erosion: 0, soilCover: 0, income: 1 };
    expect(explainRanking(rankRotations([A, B], tie), tie)).toBe("Alpha and Beta tie on your priorities; Alpha is listed first only because it is the existing rotation.");
    const zero = { water: 0, erosion: 0, soilCover: 0, income: 0 };
    expect(explainRanking(rankRotations([A, B], zero), zero)).toMatch(/^All priorities are set to 0/);
  });

  it("uses the renamed economic label", () => {
    expect(PRIORITY_LABELS.income).toBe("Economic fit (proxy)");
    expect(Object.values(DEFAULT_WEIGHTS)).toEqual([3, 3, 3, 3]);
  });
});
