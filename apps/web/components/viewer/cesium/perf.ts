// Pure perf/quality helpers for the farm view (no Cesium import, unit-tested) + frame stats for the dev readout.
import type { DetailLevel } from "@/components/globe/types";

/** Globe keeps requesting frames while an effect engine animates (requestRenderMode would otherwise stop). */
export const needsContinuousRender = (weather: { active: boolean } | null | undefined, ground: { active: boolean } | null | undefined): boolean =>
  !!weather?.active || !!ground?.active;

export type RenderQuality = { sse: number; resolutionScale: number };

/** Detail setting -> tile screen-space error and the cap for the resolution scale (device pixel ratio, capped). */
const DETAIL = { high: { sse: 12, scaleCap: 1.5 }, medium: { sse: 16, scaleCap: 1.25 }, low: { sse: 24, scaleCap: 1 } } as const satisfies Record<DetailLevel, { sse: number; scaleCap: number }>;
/** While the camera moves: coarser tiles, native resolution. */
export const MOVING_SSE = 32;
/** Low detail with a scenario playing: effectively no new refinement requests (tiles keep what they have). */
export const PAUSED_SSE = 64;
/** Camera idle time before the detail setting comes back, ms. */
export const MOTION_IDLE_MS = 1000;
/** Ground-height queries (tileset ray pick) per second at most 5 Hz. */
export const GROUND_QUERY_MS = 200;

/**
 * Pure: the render quality for a detail level. `moving` = camera in motion (raise SSE, resolutionScale 1);
 * `scenario` = a weather/ground scenario is active (low detail then pauses new tile refinement while playing).
 */
export function qualityFor(detail: DetailLevel, dpr: number, o: { moving?: boolean; scenario?: boolean } = {}): RenderQuality {
  const d = DETAIL[detail];
  const base = Math.max(1, Math.min(dpr || 1, d.scaleCap));
  let sse: number = d.sse;
  if (o.moving) sse = Math.max(sse, MOVING_SSE);
  if (detail === "low" && o.scenario) sse = Math.max(sse, PAUSED_SSE);
  return { sse, resolutionScale: o.moving ? Math.min(base, 1) : base };
}

/** Debounced "camera is moving": touch() on every camera change; moving() is false after MOTION_IDLE_MS of quiet. */
export function createMotionTracker(idleMs = MOTION_IDLE_MS) {
  let at = Number.NEGATIVE_INFINITY;
  return { touch: (now: number) => void (at = now), moving: (now: number) => now - at < idleMs };
}

/** True at most every `intervalMs`. Stateful. */
export function createThrottle(intervalMs: number) {
  let last = Number.NEGATIVE_INFINITY;
  return (now: number) => {
    if (now - last < intervalMs) return false;
    last = now;
    return true;
  };
}

/** Ring buffer of frame intervals (ms) -> avg / p95 / fps. */
export function createFrameStats(size = 120) {
  const buf: number[] = [];
  return {
    push(ms: number) {
      buf.push(ms);
      if (buf.length > size) buf.shift();
    },
    read() {
      if (!buf.length) return { avgMs: 0, p95Ms: 0, fps: 0, n: 0 };
      const s = [...buf].sort((a, b) => a - b);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      return { avgMs: avg, p95Ms: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], fps: 1000 / avg, n: buf.length };
    },
  };
}
