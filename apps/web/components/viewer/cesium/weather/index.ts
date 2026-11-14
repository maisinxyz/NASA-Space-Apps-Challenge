// Sky / weather engine seam. OWNER: Person 1 (sky/weather engine). Globe.tsx only creates, updates and destroys it.
// Contract rules (components/globe/types.ts AtmosphereState):
// - Lightning: at most 1 flash per 3 s; disabled entirely under reduced motion.
// - Clouds are illustrative mood effects. Only `rainRateMmH` is data-driven; label nothing else as data.
// - Budget: about 3 ms GPU for ALL effects together (weather + ground layers); `ctx.detail` scales effect cost.
// - The farm camera looks down at -25 deg or more from 150 m - 1.5 km, so a low broken cloud layer sits 150-350 m
//   above the fields (visible between camera and ground), not at real cloud heights.
// - `update(null)` = clear sky, no objects. Keep `active` true only while something animates; Globe then keeps
//   requesting frames (requestRenderMode) and costs nothing when `active` is false.
import type { Viewer } from "cesium";
import type { AtmosphereState, DetailLevel, FarmSurface } from "@/components/globe/types";

export interface WeatherContext {
  detail: DetailLevel;
  reducedMotion: boolean;
  /** Seconds since the previous update (capped at 0.1). */
  dtS: number;
  /** Monotonic clock, seconds. */
  nowS: number;
  surface: FarmSurface;
}

export interface WeatherEngine {
  update(state: AtmosphereState | null, ctx: WeatherContext): void;
  /** True while something animates (Globe keeps requesting frames). */
  readonly active: boolean;
  destroy(): void;
}

/** STUB: no-op until Person 1 builds the engine. */
export function createWeatherEngine(viewer: Viewer): WeatherEngine {
  void viewer;
  return { update() {}, active: false, destroy() {} };
}
