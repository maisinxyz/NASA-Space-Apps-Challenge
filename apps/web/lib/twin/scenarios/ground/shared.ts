// Shared helpers for the ground evaluators (pure, deterministic). Layer conventions the renderer implements:
//  every spec: id (stable string), kind, intensity 0..1, opacity 0..1, timeS = run.timeS for animated kinds
//    (wetness, water, runoff, floodZones, dryness, frost, heatGlow). byField: Record<fieldId, 0..1>; missing = intensity.
//  cropCover:     byField 1 = something grows, 0 = bare; params.month (0..11); params["crop_<fieldId>"] = index into CROP_INDEX;
//                 params.bareHighlight 0/1.
//  vegetation:    byField greenness 0..1 (1 = normal green, lower = yellow/brown); params["delta_<fieldId>"] = -1..1 vs normal.
//  dryness:       params.cracks 0..1.
//  water:         params.lowSpotOnly 1 (pools in low spots) or 0 (splashes anywhere on the layer's fields); params.ripples 0..1.
//  runoff:        params.flow 0..1 (streak speed/strength).
//  floodZones:    params.levelM = water level metres (0..2); intensity = levelM / 2.
//  frost:         params.lowSpotBias 0..1.
//  heatGlow:      byField per field.
//  organicMatter: params.markers 0/1; byField relative darkening 0..1 (relative only, no numbers shown).
//  nasaImagery:   imagery { layerId, date YYYY-MM-DD, credit }.
import type { CropLook, GroundLayerKind, GroundLayerSpec } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";
// Cyclic (registry imports GROUND): only read SCENARIO_DEFS inside functions, never at module top level.
import { SCENARIO_DEFS } from "../registry";
import type { ScenarioRun } from "../../scenario";

export const CROP_INDEX: CropLook[] = ["grass", "corn", "cereal", "legume", "cover", "berry", "bare"];

/** Mid-season month (July) used where a scenario's clock carries no month (drought, heat wave): an assumption. */
export const MID_SEASON_MONTH = 6;

export const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Smooth 0..1 ramp between edges a < b. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Input value by id; falls back to the registry default. */
export function input(run: ScenarioRun, id: string): number {
  const v = run.inputs[id];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return SCENARIO_DEFS.find((d) => d.id === run.scenarioId)?.inputs.find((i) => i.id === id)?.default ?? 0;
}

export const fieldIds = (farmId: string): string[] => twinConfig(farmId)?.fields.map((f) => f.id) ?? [];

/** Crop on a field in a rotation year and month (0..11). Fields outside the rotation keep field.crop; no twin = bare. */
export function cropAt(farmId: string, rotationId: string | null, fieldId: string, yearIndex: number, month: number): CropLook {
  const twin = twinConfig(farmId);
  const field = twin?.fields.find((f) => f.id === fieldId);
  if (!twin || !field) return "bare";
  const offset = twin.phases[fieldId];
  if (offset === undefined) return field.crop;
  const rot = twin.rotations.find((r) => r.id === rotationId) ?? twin.rotations.find((r) => r.id === "rot_existing") ?? twin.rotations[0];
  if (!rot) return field.crop;
  const n = rot.years.length;
  const row = rot.years[(((yearIndex + offset) % n) + n) % n];
  return row[Math.min(11, Math.max(0, month))] ?? field.crop;
}

export const isGrowing = (c: CropLook) => c !== "bare";

const ANIMATED: GroundLayerKind[] = ["wetness", "water", "runoff", "floodZones", "dryness", "frost", "heatGlow"];

/** Build a clamped spec. byField/params values are clamped to 0..1 only where `raw` is not set (params like month are raw). */
export function layer(
  run: ScenarioRun,
  id: string,
  kind: GroundLayerKind,
  intensity: number,
  o: { opacity?: number; byField?: Record<string, number>; params?: Record<string, number> } = {},
): GroundLayerSpec {
  const spec: GroundLayerSpec = { id, kind, intensity: clamp01(intensity), opacity: clamp01(o.opacity ?? 0.8) };
  if (ANIMATED.includes(kind)) spec.timeS = run.timeS;
  if (o.byField) spec.byField = Object.fromEntries(Object.entries(o.byField).map(([k, v]) => [k, clamp01(v)]));
  if (o.params) spec.params = o.params;
  return spec;
}

/** Per-field map from a function. */
export const perField = (run: ScenarioRun, f: (id: string) => number): Record<string, number> => Object.fromEntries(fieldIds(run.farmId).map((id) => [id, f(id)]));

/**
 * cropCover for one month: every field shows what is on it (crop colour when growing, bare brown when bare), all
 * months. The shader scales alpha by byField, so byField is 1 for EVERY field (0 would hide bare fields). The bare
 * look is the shader's brown unless `highlightBare` (bare-soil scenario) turns on its amber exposure highlight.
 * `only` limits drawing to fields where it returns true (others get byField 0, still given their crop index).
 */
export function cropCoverLayer(run: ScenarioRun, yearIndexOf: number, month: number, o: { highlightBare?: boolean; only?: (crop: CropLook) => boolean } = {}): GroundLayerSpec {
  const ids = fieldIds(run.farmId);
  const crops = ids.map((id) => cropAt(run.farmId, run.rotationId, id, yearIndexOf, month));
  const params: Record<string, number> = { month, bareHighlight: o.highlightBare && crops.some((c) => c === "bare") ? 1 : 0 };
  ids.forEach((id, i) => (params[`crop_${id}`] = CROP_INDEX.indexOf(crops[i])));
  const byField = Object.fromEntries(ids.map((id, i) => [id, !o.only || o.only(crops[i]) ? 1 : 0]));
  return layer(run, "crop-cover", "cropCover", 1, { opacity: 0.9, byField, params });
}
