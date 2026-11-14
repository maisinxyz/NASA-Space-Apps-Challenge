// Share links: the twin's view (farm, mode, field, A/B rotations, divider, surface, look, camera) in the URL hash.
// decodeShare() keeps only values it can validate, so a hand-edited or stale link never puts bad state in the store.
import type { CameraState, FarmSurface, LookFilter } from "@/components/globe/types";
import { farmById } from "@/lib/farms";
import { TWIN_MODES, type TwinMode } from "@/lib/store";
import { twinFields } from "@/lib/twin/agassiz";
import { rotationById } from "@/lib/twin/rotations";

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
};

const SURFACES: FarmSurface[] = ["google", "terrain"];
export const LOOKS: LookFilter[] = ["none", "thermal", "vegetation", "night"];
const CAM_DIGITS = [6, 6, 1, 2, 2]; // lon, lat (≈0.1 m), height m, heading, pitch

const round = (v: number, d: number) => Number(v.toFixed(d));

export function encodeShare(s: ShareState): string {
  const q = new URLSearchParams({ farm: s.farm, m: s.mode, a: s.a, b: s.b, d: String(round(s.divider, 3)), s: s.surface, l: s.look });
  if (s.field) q.set("f", s.field);
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
  if (field && twinFields(farm)?.some((f) => f.id === field)) out.field = field;
  for (const k of ["a", "b"] as const) {
    const id = q.get(k);
    if (id && rotationById(id)) out[k] = id;
  }
  const d = Number(q.get("d"));
  if (q.has("d") && Number.isFinite(d)) out.divider = Math.min(1, Math.max(0, d));
  const surface = q.get("s") as FarmSurface;
  if (SURFACES.includes(surface)) out.surface = surface;
  const look = q.get("l") as LookFilter;
  if (LOOKS.includes(look)) out.look = look;
  const cam = q.get("cam")?.split(",").map(Number);
  if (cam?.length === 5 && cam.every(Number.isFinite) && Math.abs(cam[0]) <= 180 && Math.abs(cam[1]) <= 90 && cam[2] > 0) {
    const [lon, lat, height, heading, pitch] = cam;
    out.camera = { lon, lat, height, heading, pitch };
  }
  return out;
}
