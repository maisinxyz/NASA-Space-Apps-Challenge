import { describe, expect, it } from "vitest";

import type { GroundLayerKind, GroundLayerSpec } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";
import { ROTATION_SETS } from "@/lib/twin/rotations";

import type { ScenarioId, ScenarioRun } from "../../scenario";
import { resolveInputs } from "../clock";
import { SCENARIO_DEFS } from "../registry";
import { GROUND, tooWetDays } from "./index";
import { CROP_INDEX, clamp01, cropAt, fieldIds, input, smoothstep } from "./shared";
import { GIBS_CREDIT, TRENDS_FIXTURE_LAYER, trendsYear } from "./trends";

const CORNELL = "cornell-ruminant";
const BELTSVILLE = "usda-barc";

function run(id: ScenarioId, progress: number, over: Record<string, number> = {}, farmId = CORNELL, rotationId: string | null = "rot_existing"): ScenarioRun {
  const def = SCENARIO_DEFS.find((d) => d.id === id)!;
  return { scenarioId: id, farmId, progress, inputs: { ...resolveInputs(def, undefined), ...over }, rotationId, timeS: 3 };
}
const find = (ls: GroundLayerSpec[], k: GroundLayerKind) => ls.find((l) => l.kind === k);

const KINDS: Record<ScenarioId, GroundLayerKind[]> = {
  storm: ["wetness", "water", "runoff"],
  "wet-spell": ["wetness", "water"],
  "flood-zones": ["floodZones"],
  drought: ["dryness", "vegetation"],
  "heat-wave": ["heatGlow"],
  frost: ["frost"],
  "bare-soil": ["cropCover"],
  "veg-stress": ["vegetation"],
  "multi-year": ["cropCover", "organicMatter"],
  trends: ["nasaImagery"],
};

describe("ground evaluators", () => {
  it.each(SCENARIO_DEFS.flatMap((d) => [CORNELL, BELTSVILLE].flatMap((f) => [0, 0.5, 1].map((p) => [d.id, f, p] as const))))("%s on %s at %s: kinds and ranges", (id, farm, p) => {
    const ls = GROUND[id](run(id, p, {}, farm));
    expect(ls.map((l) => l.kind)).toEqual(KINDS[id]);
    const ids = fieldIds(farm);
    for (const l of ls) {
      expect(l.id).toBeTruthy();
      for (const v of [l.intensity, l.opacity, ...Object.values(l.byField ?? {})]) expect(v >= 0 && v <= 1).toBe(true);
      for (const [k, v] of Object.entries(l.params ?? {})) {
        expect(Number.isFinite(v)).toBe(true);
        if (k.startsWith("delta_")) expect(Math.abs(v)).toBeLessThanOrEqual(1);
        else if (k !== "month" && !k.startsWith("crop_") && k !== "levelM") expect(v >= 0 && v <= 1).toBe(true);
      }
      if (l.byField) for (const k of Object.keys(l.byField)) expect(ids).toContain(k);
    }
    expect(GROUND[id](run(id, p, {}, farm))).toEqual(ls);
  });

  it("storm wetness is non-decreasing to the peak and stays above 0 at the end", () => {
    const w = (p: number) => find(GROUND.storm(run("storm", p)), "wetness")!.intensity;
    for (let p = 0; p < 0.7; p += 0.05) expect(w(p + 0.05)).toBeGreaterThanOrEqual(w(p) - 1e-9);
    expect(w(1)).toBeGreaterThan(0);
    expect(w(1)).toBeLessThan(w(0.7));
  });

  it("drought dryness is non-decreasing and cracks appear late", () => {
    const d = (p: number) => find(GROUND.drought(run("drought", p)), "dryness")!;
    for (let p = 0; p < 1; p += 0.1) expect(d(p + 0.1).intensity).toBeGreaterThanOrEqual(d(p).intensity);
    expect(d(0.1).params!.cracks).toBe(0);
    expect(d(1).params!.cracks).toBeGreaterThan(0);
  });

  it("frost is lower at progress 1 than at 0.7", () => {
    expect(find(GROUND.frost(run("frost", 1)), "frost")!.intensity).toBeLessThan(find(GROUND.frost(run("frost", 0.7)), "frost")!.intensity);
  });

  it("flood intensity rises with water level and equals level/2", () => {
    const f = (m: number) => GROUND["flood-zones"](run("flood-zones", 0, { water_level_m: m }))[0];
    expect(f(1.5).intensity).toBeGreaterThan(f(0.5).intensity);
    expect(f(1).intensity).toBe(0.5);
    expect(f(1).params!.levelM).toBe(1);
  });

  it("wet spell: too-wet days only grow", () => {
    const n = (p: number) => tooWetDays(run("wet-spell", p));
    expect(n(0)).toBe(0);
    expect(n(1)).toBeGreaterThanOrEqual(n(0.5));
    expect(n(1)).toBeLessThanOrEqual(28);
  });

  it("heat wave glows only on corn or cereal fields", () => {
    const l = GROUND["heat-wave"](run("heat-wave", 1))[0];
    for (const id of fieldIds(CORNELL)) {
      const c = cropAt(CORNELL, "rot_existing", id, 0, 6);
      expect(l.byField![id] > 0).toBe(c === "corn" || c === "cereal");
    }
  });

  it("bare-soil crop by month matches rotations.ts", () => {
    const twin = twinConfig(CORNELL)!;
    const rot = ROTATION_SETS[twin.rotationSet].find((r) => r.id === "rot_cover")!;
    for (const month of [0, 6, 10]) {
      const l = find(GROUND["bare-soil"](run("bare-soil", (month + 0.5) / 12, {}, CORNELL, "rot_cover")), "cropCover")!;
      expect(l.params!.month).toBe(month);
      for (const [id, off] of Object.entries(twin.phases)) expect(CROP_INDEX[l.params![`crop_${id}`]]).toBe(rot.years[off % rot.years.length][month]);
    }
  });

  it("multi-year crops follow the year index", () => {
    const id = Object.keys(twinConfig(CORNELL)!.phases)[0];
    const l = (p: number) => find(GROUND["multi-year"](run("multi-year", p, { years: 4 }, CORNELL, "rot_cover")), "cropCover")!;
    for (const [p, yi] of [[0.1, 0], [0.35, 1], [0.6, 2], [0.9, 3]] as const) {
      const c = l(p);
      expect(c.params![`crop_${id}`]).toBe(CROP_INDEX.indexOf(cropAt(CORNELL, "rot_cover", id, yi, c.params!.month)));
    }
  });

  it("trends uses advertised January imagery and clamps out-of-range years", () => {
    expect(TRENDS_FIXTURE_LAYER).toBe("MERRA2_2m_Air_Temperature_Assimilated_Monthly");
    expect(trendsYear(1981, 0)).toBe(1981);
    expect(trendsYear(1981, 1)).toBe(2026);
    expect(trendsYear(1900, 0)).toBe(1980);
    expect(trendsYear(2100, 1)).toBe(2026);
    expect(trendsYear(1991, -1)).toBe(1991);
    expect(trendsYear(1991, 2)).toBe(2026);
    for (const p of [0, 0.5, 1]) {
      const imagery = GROUND.trends(run("trends", p, { start_year: 1981 }))[0].imagery;
      expect(imagery).toEqual({ layerId: TRENDS_FIXTURE_LAYER, date: `${trendsYear(1981, p)}-01-01`, credit: GIBS_CREDIT });
    }
  });
});

describe("ground shared helpers", () => {
  it("clamp01 and smoothstep", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0.2, 0.4, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.4, 0.5)).toBe(1);
  });
  it("input falls back to the registry default", () => {
    const r = { ...run("storm", 0), inputs: {} };
    expect(input(r, "peak_rain_mm_h")).toBe(40);
    expect(input({ ...r, inputs: { peak_rain_mm_h: 10 } }, "peak_rain_mm_h")).toBe(10);
  });
  it("cropAt falls back for unknown rotation and no twin", () => {
    const id = fieldIds(CORNELL)[0];
    expect(cropAt(CORNELL, "nope", id, 0, 6)).toBe(cropAt(CORNELL, "rot_existing", id, 0, 6));
    expect(cropAt("unknown", null, "x", 0, 0)).toBe("bare");
    expect(fieldIds("unknown")).toEqual([]);
  });
});
