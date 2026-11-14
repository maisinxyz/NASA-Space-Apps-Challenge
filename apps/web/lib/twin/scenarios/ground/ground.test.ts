import { describe, expect, it } from "vitest";

import type { GroundLayerKind, GroundLayerSpec } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";
import { ROTATION_SETS } from "@/lib/twin/rotations";

import type { ScenarioId, ScenarioRun } from "../../scenario";
import { resolveInputs } from "../clock";
import { SCENARIO_DEFS } from "../registry";
import { GROUND, tooWetDays } from "./index";
import { CROP_INDEX, clamp01, cropAt, fieldIds, input, smoothstep } from "./shared";
import { frostLevel } from "./frost";
import { wetSpellRainy } from "../atmosphere/evaluators";
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
  "veg-stress": ["cropCover", "vegetation"],
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

  it("heat wave glows on every growing field, strongest on corn or cereal", () => {
    const l = GROUND["heat-wave"](run("heat-wave", 1))[0];
    for (const id of fieldIds(CORNELL)) {
      const c = cropAt(CORNELL, "rot_existing", id, 0, 6);
      expect(l.byField![id] > 0).toBe(c !== "bare");
      if (c === "corn" || c === "cereal") expect(l.byField![id]).toBeCloseTo(l.intensity);
      else if (c !== "bare") expect(l.byField![id]).toBeLessThan(l.intensity);
    }
  });

  it("frost level follows the WRCC thresholds and the slider reaches all three", () => {
    expect(frostLevel(0)).toBe("light");
    expect(frostLevel(-2.2)).toBe("moderate");
    expect(frostLevel(-4.3)).toBe("moderate");
    expect(frostLevel(-4.4)).toBe("hard");
    const lv = (t: number) => find(GROUND.frost(run("frost", 0.2, { min_temp_c: t })), "frost")!.params!.level;
    expect([lv(-1), lv(-3), lv(-5)]).toEqual([0, 0.5, 1]);
    const def = SCENARIO_DEFS.find((d) => d.id === "frost")!.inputs.find((i) => i.id === "min_temp_c")!;
    expect(def.min).toBeLessThan(-4.4);
  });

  it("ground frost is timed with the sky: frozen before the 06:00 dawns, thawed by 09:00", () => {
    const f = (h: number) => find(GROUND.frost(run("frost", h / 48)), "frost")!.intensity;
    expect(f(11.5)).toBeGreaterThan(0.3); // 05:30 day 2
    expect(f(15)).toBe(0); // 09:00 day 2
    expect(f(35.5)).toBeGreaterThan(0.3); // 05:30 day 3
    expect(f(39)).toBe(0);
  });

  it("wet spell wetness rises on rainy days and drains on dry days (sky pattern)", () => {
    const w = (d: number) => find(GROUND["wet-spell"](run("wet-spell", d / 28)), "wetness")!.intensity;
    for (let d = 0; d < 27; d++) {
      if (wetSpellRainy(d, 4)) expect(w(d + 1)).toBeGreaterThan(w(d));
      else expect(w(d + 1)).toBeLessThanOrEqual(w(d));
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

  it("cropCover shows every field every month: byField 1 for bare too, highlight only when asked", () => {
    for (const rot of ["rot_existing", "rot_cover"]) {
      for (let m = 0; m < 12; m++) {
        const l = find(GROUND["multi-year"](run("multi-year", (m + 0.5) / 48, { years: 4 }, CORNELL, rot)), "cropCover")!;
        for (const id of fieldIds(CORNELL)) expect(l.byField![id]).toBe(1);
        expect(l.params!.bareHighlight).toBe(0);
        const b = find(GROUND["bare-soil"](run("bare-soil", (m + 0.5) / 12, {}, CORNELL, rot)), "cropCover")!;
        const anyBare = fieldIds(CORNELL).some((id) => cropAt(CORNELL, rot, id, 0, m) === "bare");
        expect(b.params!.bareHighlight).toBe(anyBare ? 1 : 0);
      }
    }
  });

  it("veg-stress: bare fields are out of the ramp (veg 0, plain cropCover), growing fields are rated", () => {
    for (let m = 0; m < 12; m++) {
      const ls = GROUND["veg-stress"](run("veg-stress", (m + 0.5) / 12));
      const cc = find(ls, "cropCover")!;
      const veg = find(ls, "vegetation")!;
      expect(cc.params!.bareHighlight).toBe(0);
      for (const id of fieldIds(CORNELL)) {
        const bare = cropAt(CORNELL, "rot_existing", id, 0, m) === "bare";
        expect(cc.byField![id]).toBe(bare ? 1 : 0);
        if (bare) expect(veg.byField![id]).toBe(0);
        else expect(veg.byField![id]).toBeGreaterThan(0);
      }
    }
  });

  it("veg-stress start month shifts the stress", () => {
    const g = (start: number) => find(GROUND["veg-stress"](run("veg-stress", 0.55, { stress_start_month: start, stress_severity: 100 }, CORNELL, "rot_cover")), "vegetation")!.intensity;
    expect(g(11)).toBeGreaterThan(g(5)); // stress has not started yet at ~July when it begins in November
  });

  it("bare-soil rain intensity scales the exposure highlight (relative)", () => {
    const rainy = [...Array(24).keys()].map((k) => (k + 0.5) / 24).find((p) => find(GROUND["bare-soil"](run("bare-soil", p)), "water"));
    if (rainy === undefined) return; // no rainy bare month for this farm/rotation
    const w = (x: number) => find(GROUND["bare-soil"](run("bare-soil", rainy, { rain_intensity: x })), "water")!.intensity;
    expect(w(2)).toBeGreaterThanOrEqual(w(0.5));
  });

  it("multi-year cover-crop share raises organic matter and defaults to unchanged", () => {
    const om = (s: number) => find(GROUND["multi-year"](run("multi-year", 0.99, { years: 4, cover_crop_share: s }, CORNELL, "rot_existing")), "organicMatter")!.intensity;
    expect(om(100)).toBeGreaterThan(om(0));
    expect(om(0)).toBe(find(GROUND["multi-year"](run("multi-year", 0.99, { years: 4 }, CORNELL, "rot_existing")), "organicMatter")!.intensity);
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
