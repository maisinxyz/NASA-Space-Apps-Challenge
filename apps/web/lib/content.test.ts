import { describe, expect, it } from "vitest";

import { learningContentStatus, terrainForSelectedFarm } from "./content";

describe("methods and learning content status", () => {
  it("uses only the selected farm's explicit terrain mapping", () => {
    const mappings = { "farm-a": "terrain-a", "farm-b": "terrain-b" };

    expect(terrainForSelectedFarm("farm-b", mappings)).toBe("terrain-b");
    expect(terrainForSelectedFarm("unknown-farm", mappings)).toBeUndefined();
    expect(terrainForSelectedFarm(null, mappings)).toBeUndefined();
  });

  it("marks learning content provisional in either API mode", () => {
    expect(learningContentStatus("mock")).toBe("provisional");
    expect(learningContentStatus("live")).toBe("provisional");
  });
});

it('candidate source notices state their uncertainty in reader-facing language', async () => {
  const { CANDIDATE_DATASETS } = await import('./farms');
  const licences = Object.values(CANDIDATE_DATASETS).map(dataset => dataset.licence);
  expect(licences.some(text => text.includes('not yet verified'))).toBe(true);
  expect(licences.some(text => text.includes(['TODO','(verify)'].join('')))).toBe(false);
});
