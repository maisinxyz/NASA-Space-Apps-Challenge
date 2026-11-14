import { describe, expect, it } from "vitest";

import { CROP_COLORS } from "../cropColors";
import type { ScenarioId, ScenarioRun } from "../scenario";
import { resolveInputs } from "./clock";
import { BARE_HIGHLIGHT_COLOR, cropsPresent, scenarioLegend } from "./legend";
import { SCENARIO_DEFS } from "./registry";

const CORNELL = "cornell-ruminant";
const defOf = (id: ScenarioId) => SCENARIO_DEFS.find((d) => d.id === id)!;
const run = (id: ScenarioId, progress: number, rotationId = "rot_existing", over: Record<string, number> = {}): ScenarioRun => ({
  scenarioId: id,
  farmId: CORNELL,
  progress,
  inputs: { ...resolveInputs(defOf(id), undefined), ...over },
  rotationId,
  timeS: 0,
});

describe("scenario legends", () => {
  it("static scenarios keep their registry legend (null)", () => {
    expect(scenarioLegend(defOf("storm"), run("storm", 0.5))).toBeNull();
    expect(scenarioLegend(defOf("trends"), run("trends", 0.5))).toBeNull();
  });

  it("bare-soil: only classes present this month, swatches equal the map colour table", () => {
    const hexes = new Set<string>(Object.values(CROP_COLORS));
    hexes.add(BARE_HIGHLIGHT_COLOR);
    for (const rot of ["rot_existing", "rot_cover"]) {
      for (let m = 0; m < 12; m++) {
        const l = scenarioLegend(defOf("bare-soil"), run("bare-soil", (m + 0.5) / 12, rot))!;
        const present = cropsPresent(CORNELL, rot, 0, m);
        expect(l).toHaveLength(present.length);
        for (const item of l) expect(hexes.has(item.color)).toBe(true);
        for (const c of present) {
          const want = c === "bare" ? BARE_HIGHLIGHT_COLOR : CROP_COLORS[c];
          expect(l.some((i) => i.color === want)).toBe(true);
        }
        for (const [c, hex] of Object.entries(CROP_COLORS)) if (c !== "bare" && !present.includes(c as keyof typeof CROP_COLORS)) expect(l.some((i) => i.color === hex)).toBe(false);
      }
    }
  });

  it("veg-stress: ramp for growing fields, bare soil listed as not rated with the map's bare colour", () => {
    for (let m = 0; m < 12; m++) {
      const l = scenarioLegend(defOf("veg-stress"), run("veg-stress", (m + 0.5) / 12))!;
      const present = cropsPresent(CORNELL, "rot_existing", 0, m);
      expect(l.some((i) => i.color === CROP_COLORS.bare)).toBe(present.includes("bare"));
      expect(l.some((i) => /stress/.test(i.label))).toBe(present.some((c) => c !== "bare"));
    }
  });

  it("multi-year: follows the year and adds the organic-matter key", () => {
    const l = scenarioLegend(defOf("multi-year"), run("multi-year", 0.6, "rot_cover", { years: 4 }))!;
    expect(l[l.length - 1].label).toMatch(/organic matter/i);
    expect(l.slice(0, -1).every((i) => Object.values(CROP_COLORS).includes(i.color))).toBe(true);
    expect(scenarioLegend(defOf("multi-year"), run("multi-year", 0.6, "rot_cover", { years: 4 }))).toEqual(l);
  });
});
