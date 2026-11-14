// Ground & data layer renderer seam. OWNER: Person 2 (ground & data layers). Globe.tsx only creates, updates, destroys it.
// Rules: animated layers must be GPU materials with a time uniform (GroundPrimitive + a custom Fabric Material),
// never per-frame canvas re-uploads. On the Google surface they are masked with `overlayMask` (building footprints)
// so water/frost does not paint roofs. Layers draw inside `simBbox` only. `active` true only while a layer animates.
import type { Viewer } from "cesium";
import type { CropLook, DetailLevel, FarmField, FarmSurface, GroundLayerSpec } from "@/components/globe/types";

export interface GroundContext {
  detail: DetailLevel;
  reducedMotion: boolean;
  /** Seconds since the previous update (capped at 0.1). */
  dtS: number;
  /** Monotonic clock, seconds. */
  nowS: number;
  surface: FarmSurface;
  fields: FarmField[];
  simBbox?: [number, number, number, number];
  overlayMask?: [number, number][][];
  cropByField?: Record<string, CropLook>;
}

export interface GroundRenderer {
  update(layers: GroundLayerSpec[], ctx: GroundContext): void;
  /** True while something animates (Globe keeps requesting frames). */
  readonly active: boolean;
  destroy(): void;
}

/** STUB: no-op until Person 2 builds the renderer. */
export function createGroundRenderer(viewer: Viewer): GroundRenderer {
  void viewer;
  return { update() {}, active: false, destroy() {} };
}
