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

it('candidate source notices expose reader-facing license and attribution details', async () => {
  const { CANDIDATE_DATASETS } = await import('./farms');
  const licences = Object.values(CANDIDATE_DATASETS).map(dataset => dataset.licence);
  for (const dataset of Object.values(CANDIDATE_DATASETS)) {
    expect(dataset.licence.trim().length).toBeGreaterThan(0);
    expect(dataset.attribution.trim().length).toBeGreaterThan(0);
    expect(dataset.url).toMatch(/^https:\/\//);
  }
  // Upstream 05c71e5 verified the previously provisional licence descriptions.
  // Keep the reader-facing check without requiring obsolete uncertainty copy.
  expect(licences.some(text => text.includes(['TODO','(verify)'].join('')))).toBe(false);
});
