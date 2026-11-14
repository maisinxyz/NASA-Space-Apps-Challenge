// Pure mapping GroundLayerSpec[] -> shader uniform values (no Cesium).
import type { CropLook, DetailLevel, GroundLayerKind, GroundLayerSpec } from "@/components/globe/types";

import { MAX_FIELDS } from "./geometry";

/** Layer order in the shader (bottom first). nasaImagery is not procedural. */
export const PROCEDURAL_KINDS = [
  "cropCover",
  "vegetation",
  "organicMatter",
  "dryness",
  "wetness",
  "runoff",
  "water",
  "floodZones",
  "frost",
  "heatGlow",
] as const satisfies readonly GroundLayerKind[];
export type ProceduralKind = (typeof PROCEDURAL_KINDS)[number];

/** Kinds whose strength is per field (slotted). Others use `intensity` over the whole square. */
export const FIELD_KINDS = ["cropCover", "vegetation", "organicMatter", "water", "heatGlow"] as const satisfies readonly ProceduralKind[];
export type FieldKind = (typeof FIELD_KINDS)[number];

/** Index into the crop palette; the order is part of the params contract (params["crop_<fieldId>"]). */
export const CROP_ORDER: readonly CropLook[] = ["grass", "corn", "cereal", "legume", "cover", "berry", "bare"];

/** Kinds that animate when motion is allowed. */
const ANIMATED: ReadonlySet<ProceduralKind> = new Set(["wetness", "runoff", "floodZones", "water"]);

export type KindUniform = { intensity: number; opacity: number; p1: number; p2: number };

export type GroundUniforms = {
  /** null = layer absent (opacity 0 in the shader). */
  kinds: Record<ProceduralKind, KindUniform | null>;
  /** Per-field strengths, MAX_FIELDS slots, for FIELD_KINDS. */
  fields: Record<FieldKind, number[]>;
  /** Crop palette index per slot. */
  crops: number[];
  detail: 0 | 1 | 2;
  motion: 0 | 1;
  /** Any procedural layer present: the primitive is shown. */
  anyProcedural: boolean;
  /** Something animates and motion is allowed: Globe keeps rendering. */
  active: boolean;
};

const clamp01 = (x: number | undefined, d = 0) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x as number)) : d);
const isProcedural = (k: GroundLayerKind): k is ProceduralKind => (PROCEDURAL_KINDS as readonly string[]).includes(k);

/** Documented per-kind params -> (p1, p2). See the layer conventions in the S2-G prompt. */
function paramsOf(kind: ProceduralKind, p: Record<string, number> = {}): [number, number] {
  switch (kind) {
    case "cropCover": return [p.byField === undefined ? 1 : clamp01(p.byField), clamp01(p.bareHighlight)];
    case "water": return [clamp01(p.lowSpotOnly, 1), clamp01(p.ripples)];
    case "runoff": return [clamp01(p.flow, 0.5), 0];
    case "floodZones": return [Math.min(2, Math.max(0, p.levelM ?? 0)), 0]; // intensity = levelM/2 fallback applied by the caller
    case "dryness": return [clamp01(p.cracks), 0];
    case "frost": return [clamp01(p.lowSpotBias), clamp01(p.level)]; // level: 0 light, 0.5 moderate, 1 hard
    case "organicMatter": return [clamp01(p.markers), 0];
    default: return [0, 0];
  }
}

/**
 * @param fieldIds ids in slot order (ctx.fields); more than MAX_FIELDS are ignored.
 * @param fieldCrops fallback crop per slot when params["crop_<id>"] is absent (default "bare").
 */
export function layersToUniforms(
  layers: readonly GroundLayerSpec[],
  fieldIds: readonly string[],
  detail: DetailLevel,
  reducedMotion: boolean,
  fieldCrops: readonly CropLook[] = [],
): GroundUniforms {
  const kinds = Object.fromEntries(PROCEDURAL_KINDS.map((k) => [k, null])) as GroundUniforms["kinds"];
  const fields = Object.fromEntries(FIELD_KINDS.map((k) => [k, new Array<number>(MAX_FIELDS).fill(0)])) as GroundUniforms["fields"];
  const crops = new Array<number>(MAX_FIELDS).fill(CROP_ORDER.indexOf("bare"));
  const ids = fieldIds.slice(0, MAX_FIELDS);
  let active = false;

  for (const l of layers) {
    // A layer with a backend raster is drawn by the overlay layer instead of procedurally.
    if (!isProcedural(l.kind) || l.overlay) continue;
    const intensity = clamp01(l.intensity);
    const opacity = clamp01(l.opacity, 1);
    const [q1, p2] = paramsOf(l.kind, l.params);
    // floodZones: intensity = levelM / 2, so a missing levelM falls back to it.
    const p1 = l.kind === "floodZones" && l.params?.levelM === undefined ? intensity * 2 : q1;
    kinds[l.kind] = { intensity, opacity, p1, p2 };
    if ((FIELD_KINDS as readonly string[]).includes(l.kind)) {
      const k = l.kind as FieldKind;
      ids.forEach((id, i) => (fields[k][i] = clamp01(l.byField?.[id], intensity)));
    }
    if (l.kind === "cropCover") {
      ids.forEach((id, i) => {
        const fromParam = l.params?.[`crop_${id}`];
        const idx = Number.isFinite(fromParam) ? Math.round(fromParam as number) : CROP_ORDER.indexOf(fieldCrops[i] ?? "bare");
        crops[i] = Math.min(CROP_ORDER.length - 1, Math.max(0, idx));
      });
    }
    const visible = opacity > 0 && (intensity > 0 || Object.values(l.byField ?? {}).some((v) => v > 0));
    if (visible && ANIMATED.has(l.kind) && (l.kind !== "water" || p2 > 0)) active = true;
  }
  return {
    kinds,
    fields,
    crops,
    detail: detail === "low" ? 0 : detail === "medium" ? 1 : 2,
    motion: reducedMotion ? 0 : 1,
    anyProcedural: PROCEDURAL_KINDS.some((k) => kinds[k]),
    active: active && !reducedMotion,
  };
}
