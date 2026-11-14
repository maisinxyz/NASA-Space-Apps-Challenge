// Share links: the twin's view (farm, mode, field, A/B rotations, divider, surface, look, camera) in the URL hash.
// decodeShare() keeps only values it can validate, so a hand-edited or stale link never puts bad state in the store.
import type { CameraState, DetailLevel, FarmSurface, LookFilter } from "@/components/globe/types";
import { farmById, twinConfig } from "@/lib/farms";
import { TWIN_MODES, type TwinMode } from "@/lib/store";
import { clampInput } from "@/lib/twin/scenarios/clock";
import { scenarioById } from "@/lib/twin/scenarios/registry";
import type { ScenarioId } from "@/lib/twin/scenario";

export type ShareState = {
  farm: string;
  mode: TwinMode;
  field: string | null;
  a: string;
  b: string;
  divider: number;
  surface: FarmSurface;
  look: LookFilter;
  camera: CameraState | null;
  /** Simulate: the open scenario, its input values (by input id) and the render detail. All optional. */
  scenario?: ScenarioId | null;
  inputs?: Record<string, number>;
  detail?: DetailLevel;
};

const SURFACES: FarmSurface[] = ["google", "terrain"];
export const LOOKS: LookFilter[] = ["none", "thermal", "vegetation", "night"];
export const DETAILS: DetailLevel[] = ["high", "medium", "low"];
const CAM_DIGITS = [6, 6, 1, 2, 2]; // lon, lat (≈0.1 m), height m, heading, pitch

const round = (v: number, d: number) => Number(v.toFixed(d));

export function encodeShare(s: ShareState): string {
  const q = new URLSearchParams({ farm: s.farm, m: s.mode, a: s.a, b: s.b, d: String(round(s.divider, 3)), s: s.surface, l: s.look });
  if (s.field) q.set("f", s.field);
  if (s.detail && s.detail !== "medium") q.set("dt", s.detail);
  if (s.scenario) {
    q.set("sc", s.scenario);
    const si = Object.entries(s.inputs ?? {}).map(([k, v]) => `${k}:${round(v, 3)}`);
    if (si.length) q.set("si", si.join(","));
  }
  if (s.camera) {
    const c = s.camera;
    q.set("cam", [c.lon, c.lat, c.height, c.heading, c.pitch].map((v, i) => round(v, CAM_DIGITS[i])).join(","));
  }
  return `#${q.toString()}`;
}

/** Null unless the hash names a known farm; every other field is kept only when valid for that farm. */
export function decodeShare(hash: string): Partial<ShareState> & { farm: string } | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const farm = q.get("farm");
  if (!farm || !farmById(farm)) return null;
  const out: Partial<ShareState> & { farm: string } = { farm };
  const mode = q.get("m") as TwinMode;
  if (TWIN_MODES.includes(mode)) out.mode = mode;
  const field = q.get("f");
  // Fields and rotations are checked against this farm's own twin (none for explore-only farms).
  const twin = twinConfig(farm);
  if (field && twin?.fields.some((f) => f.id === field)) out.field = field;
  for (const k of ["a", "b"] as const) {
    const id = q.get(k);
    if (id && twin?.rotations.some((r) => r.id === id)) out[k] = id;
  }
  const d = Number(q.get("d"));
  if (q.has("d") && Number.isFinite(d)) out.divider = Math.min(1, Math.max(0, d));
  const surface = q.get("s") as FarmSurface;
  if (SURFACES.includes(surface)) out.surface = surface;
  const look = q.get("l") as LookFilter;
  if (LOOKS.includes(look)) out.look = look;
  const detail = q.get("dt") as DetailLevel;
  if (DETAILS.includes(detail)) out.detail = detail;
  // A scenario only exists for a twin farm and a known id; each input must be one of its inputs, clamped into range.
  const def = twin ? scenarioById(q.get("sc")) : undefined;
  if (def) {
    out.scenario = def.id;
    const inputs: Record<string, number> = {};
    for (const part of (q.get("si") ?? "").split(",")) {
      const [k, raw] = part.split(":");
      const input = def.inputs.find((i) => i.id === k);
      if (input && raw !== undefined && raw.trim() !== "" && Number.isFinite(Number(raw))) inputs[k] = clampInput(input, Number(raw));
    }
    if (Object.keys(inputs).length) out.inputs = inputs;
  }
  const cam = q.get("cam")?.split(",").map(Number);
  if (cam?.length === 5 && cam.every(Number.isFinite) && Math.abs(cam[0]) <= 180 && Math.abs(cam[1]) <= 90 && cam[2] > 0) {
    const [lon, lat, height, heading, pitch] = cam;
    out.camera = { lon, lat, height, heading, pitch };
  }
  return out;
}
