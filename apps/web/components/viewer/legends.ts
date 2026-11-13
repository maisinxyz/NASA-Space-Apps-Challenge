// Color ramps and legend data. The same stops feed the 3D lookup textures and the UI legends,
// so the panel can never disagree with the canvas.
import type { DiffStats, LayerCatalog, TerrainPackage } from "@/lib/api/types";
import type { ViewerLegend } from "./types";

type Stops = { t: number; color: string }[];
const even = (colors: string[]): Stops => colors.map((color, i) => ({ t: i / (colors.length - 1), color }));

// `color_ramp` is a free-text rendering hint in the contract; unknown names fall back to viridis.
const RAMPS: Record<string, Stops> = {
  magma: even(["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"]),
  blues: even(["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"]),
  viridis: even(["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]),
};
export const rampStops = (name: string): Stops => RAMPS[name] ?? RAMPS.viridis;

export const RISK_STOPS: Stops = even(["#fde68a", "#f59e0b", "#dc2626", "#7f1d1d"]);
/** Risk index at and above which the 3D view adds a hatch. */
export const RISK_HATCH_FROM = 60;

/** Diverging, colorblind-safe (orange / purple). t = 0 is "b drier", 0.5 no change, 1 "b wetter". */
export const DIFF_DRIER = "#e66101";
export const DIFF_WETTER = "#7b61ff";
export const DIFF_STOPS: Stops = [
  { t: 0, color: DIFF_DRIER },
  { t: 0.5, color: "#f7f7f7" },
  { t: 1, color: DIFF_WETTER },
];

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function sampleStops(stops: Stops, t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1].t) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const f = b.t === a.t ? 0 : (x - a.t) / (b.t - a.t);
  const ca = hexToRgb(a.color);
  const cb = hexToRgb(b.color);
  return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * Math.min(1, Math.max(0, f)))) as [number, number, number];
}

export function buildLayerLegends(catalog: LayerCatalog): ViewerLegend[] {
  return catalog.layers.map((l) => ({
    name: l.name,
    title: l.title,
    kind: l.kind,
    unit: l.unit,
    basis: l.basis,
    range: l.kind === "continuous" ? [l.value_range[0], l.value_range[1]] : undefined,
    stops: l.kind === "continuous" ? rampStops(l.color_ramp) : undefined,
    classes: l.classes?.map((c) => ({ value: c.value, label: c.label, color: c.color ?? "#888888" })),
  }));
}

export const RISK_LEGEND: ViewerLegend = {
  name: "risk",
  title: "Erosion risk index",
  kind: "continuous",
  unit: "index 0-100",
  basis: "relative",
  range: [0, 100],
  stops: RISK_STOPS,
  pattern: `Diagonal hatch where the index is ${RISK_HATCH_FROM} or more`,
  note: "Relative comparison between rotations, not a soil-loss prediction.",
};

export function diffLegend(stats: DiffStats): ViewerLegend {
  return {
    name: "diff",
    title: "Peak water depth, B minus A",
    kind: "diverging",
    unit: stats.unit,
    basis: stats.basis,
    range: [-stats.max_abs_diff_mm, stats.max_abs_diff_mm],
    stops: DIFF_STOPS,
    pattern: "Striped orange = B drier than A. Solid purple glow = B wetter than A.",
    note: "Relative comparison of two rotations under the same storm.",
  };
}

/**
 * Viewer heuristic, not a contract field: TextureInfo has no "coarse" flag, so imagery counts as
 * coarse at 10 m or worse (PRD D5 fallback) or when it comes from NASA GIBS. UI shows a "coarse" badge.
 */
export function isCoarseImagery(terrain: TerrainPackage): boolean {
  const t = terrain.texture;
  if (!t) return true;
  return t.source === "nasa_gibs" || (t.resolution_m ?? 0) >= 10;
}
