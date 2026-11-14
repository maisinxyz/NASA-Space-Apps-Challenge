// Colour keys for the cover-based scenarios (bare-soil, veg-stress, multi-year), built from the SAME colour table the map
// draws with (lib/twin/cropColors.ts) and listing ONLY the classes present this month for the chosen rotation.
// Other scenarios keep the static legend in registry.ts.
import type { CropLook } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";

import { CROP_COLORS, CROP_WORDS } from "../cropColors";
import type { ScenarioDef, ScenarioRun } from "../scenario";
import { multiYearPos } from "./ground/multiYear";
import { clamp01, cropAt, CROP_INDEX, fieldIds } from "./ground/shared";

export type LegendItem = { color: string; label: string };

// Colours the ground shader (components/viewer/cesium/ground/material.ts) draws for these overlays.
/** Bare-soil exposure highlight: vec3(0.96, 0.78, 0.35). */
export const BARE_HIGHLIGHT_COLOR = "#f5c759";
/** Vegetation ramp ends: mix(vec3(0.62,0.50,0.20), vec3(0.18,0.56,0.20), greenness). */
export const VEG_LOW_COLOR = "#9e8033";
export const VEG_HIGH_COLOR = "#2e8f33";
/** Organic-matter darkening: vec3(0.14, 0.10, 0.07). */
export const ORGANIC_COLOR = "#241a12";

/** Crop classes on the farm's fields in a rotation year and month, in the table's order. */
export function cropsPresent(farmId: string, rotationId: string | null, yearIndex: number, month: number): CropLook[] {
  const on = new Set(fieldIds(farmId).map((id) => cropAt(farmId, rotationId, id, yearIndex, month)));
  return CROP_INDEX.filter((c) => on.has(c));
}

/** The year index and month a cover scenario shows for this run (same maths as the evaluators). */
function whenOf(run: ScenarioRun): { yi: number; month: number } {
  if (run.scenarioId === "multi-year") return multiYearPos(run);
  return { yi: 0, month: Math.min(11, Math.floor(clamp01(run.progress) * 12)) };
}

/** Legend for the run's current month, or null when the scenario keeps its static legend. */
export function scenarioLegend(def: ScenarioDef, run: ScenarioRun): LegendItem[] | null {
  if (def.id !== "bare-soil" && def.id !== "veg-stress" && def.id !== "multi-year") return null;
  const { yi, month } = whenOf(run);
  const words = twinConfig(run.farmId)?.cropLabels ?? CROP_WORDS;
  const present = cropsPresent(run.farmId, run.rotationId, yi, month);
  const bare = present.includes("bare");
  const item = (c: CropLook): LegendItem => ({ color: CROP_COLORS[c], label: words[c] ?? CROP_WORDS[c] });

  if (def.id === "veg-stress") {
    const out: LegendItem[] = present.some((c) => c !== "bare")
      ? [
          { color: VEG_HIGH_COLOR, label: "Greener (normal or above)" },
          { color: VEG_LOW_COLOR, label: "Below normal (stress)" },
        ]
      : [];
    if (bare) out.push({ color: CROP_COLORS.bare, label: `${words.bare ?? CROP_WORDS.bare} (not rated)` });
    return out;
  }
  const out = present.map((c) => (c === "bare" && def.id === "bare-soil" ? { color: BARE_HIGHLIGHT_COLOR, label: `${words.bare ?? CROP_WORDS.bare} (exposed)` } : item(c)));
  if (def.id === "multi-year") out.push({ color: ORGANIC_COLOR, label: "Darker = more organic matter (relative)" });
  return out;
}
