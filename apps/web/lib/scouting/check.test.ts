import { describe, expect, it } from "vitest";

import { buildingsFromOsmApi, reliefGrid, reliefStats, stage1 } from "./check";

describe("farm 3D check helpers", () => {
  it("turns OSM API ways into building centroids and skips non-buildings", () => {
    const n = (id: number, lon: number, lat: number) => ({ type: "node", id, lon, lat });
    const b = buildingsFromOsmApi({
      elements: [n(1, 0, 0), n(2, 0.001, 0), n(3, 0.001, 0.001), n(4, 0, 0.001), { type: "way", id: 9, nodes: [1, 2, 3, 4, 1], tags: { building: "barn" } }, { type: "way", id: 10, nodes: [1, 2, 3], tags: { highway: "track" } }],
    });
    expect(b).toHaveLength(1);
    expect(b[0].radiusM).toBeCloseTo(55.7, 0);
  });

  it("relief: flat mesh reads 0, a 10 m roof reads as 3D", () => {
    expect(reliefStats([100, 100], Array(12).fill(100)).reliefShare3).toBe(0);
    expect(reliefStats([110, 100], Array(12).fill(100))).toEqual({ reliefShare3: 0.5, reliefP90M: 10 });
    expect(reliefGrid(0, 0).centres).toHaveLength(169);
  });

  it("counts a building as 3D only when its roof is >= 3 m above local ground", () => {
    const s = stage1([{ roof: 110, localGround: 100, terrain: 99 }, { roof: 101, localGround: 100, terrain: 100 }]);
    expect(s.share3dLocal).toBe(0.5);
  });
});
