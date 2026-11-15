// Pure window geometry: clamping, rubber-band resistance and resize-edge math. No DOM, no React; unit-tested.

export type Rect = { x: number; y: number; w: number; h: number };
export type Bounds = { w: number; h: number };
export type Limits = { minW: number; minH: number; maxW: number; maxH: number };
/** Resize handle direction: -1 moves the left/top edge, 1 the right/bottom edge, 0 leaves that axis alone. */
export type Dir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Diminishing-returns pull past a limit (the iOS scroll curve): ~0.55 px per px at first, approaching `dim` px for
 * very large overshoot. Sign-preserving; rubber(0) = 0.
 */
export function rubber(overshoot: number, dim = 180, c = 0.55): number {
  if (!overshoot) return 0;
  const a = Math.abs(overshoot);
  return Math.sign(overshoot) * (1 - 1 / ((a * c) / dim + 1)) * dim;
}

/** Size within min/max and the region; then position so the whole window lies inside the region. */
export function clampRect(r: Rect, region: Rect, lim: Limits): Rect {
  const w = clamp(r.w, lim.minW, Math.min(lim.maxW, region.w));
  const h = clamp(r.h, lim.minH, Math.min(lim.maxH, region.h));
  return {
    x: clamp(r.x, region.x, region.x + region.w - w),
    y: clamp(r.y, region.y, region.y + region.h - h),
    w,
    h,
  };
}

/** Dragging: where the window should settle, and where to draw it now (rubber-banded past the region edges). */
export function dragRect(start: Rect, dx: number, dy: number, region: Rect, lim: Limits): { show: Rect; target: Rect } {
  const raw = { ...start, x: start.x + dx, y: start.y + dy };
  const target = clampRect(raw, region, lim);
  return { target, show: { ...target, x: target.x + rubber(raw.x - target.x), y: target.y + rubber(raw.y - target.y) } };
}

/** One axis of a resize: move the `lo` or `hi` edge by d, keeping size in [min, max] and the edge in the region. */
function resizeAxis(lo: number, size: number, d: number, dir: -1 | 0 | 1, rLo: number, rHi: number, min: number, max: number) {
  const hi = lo + size;
  if (dir === 0) return { show: [lo, hi], target: [lo, hi] };
  if (dir < 0) {
    const raw = lo + d;
    const t = clamp(raw, Math.max(rLo, hi - max), hi - min);
    return { show: [t + rubber(raw - t), hi], target: [t, hi] };
  }
  const raw = hi + d;
  const t = clamp(raw, lo + min, Math.min(rHi, lo + max));
  return { show: [lo, t + rubber(raw - t)], target: [lo, t] };
}

/** Resizing from a handle: settle target within limits and region, and the rubber-banded rect to draw now. */
export function resizeRect(start: Rect, dir: Dir, dx: number, dy: number, region: Rect, lim: Limits): { show: Rect; target: Rect } {
  const ax = resizeAxis(start.x, start.w, dx, dir.x, region.x, region.x + region.w, lim.minW, lim.maxW);
  const ay = resizeAxis(start.y, start.h, dy, dir.y, region.y, region.y + region.h, lim.minH, lim.maxH);
  const mk = (x: number[], y: number[]): Rect => ({ x: x[0], y: y[0], w: x[1] - x[0], h: y[1] - y[0] });
  return { show: mk(ax.show, ay.show), target: mk(ax.target, ay.target) };
}

/** A rect as fractions of the screen, so a saved layout still makes sense on another screen size. */
export const toFrac = (r: Rect, b: Bounds): [number, number, number, number] => [r.x / b.w, r.y / b.h, r.w / b.w, r.h / b.h];
export const fromFrac = (f: readonly number[], b: Bounds): Rect => ({ x: f[0] * b.w, y: f[1] * b.h, w: f[2] * b.w, h: f[3] * b.h });

export const sameRect = (a: Rect, b: Rect, eps = 0.5) =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.w - b.w) < eps && Math.abs(a.h - b.h) < eps;

/** easeOutBack: overshoots slightly then settles, for the recoil after a drag past the edge. */
export function easeOutBack(k: number, s = 1.4): number {
  const t = k - 1;
  return 1 + t * t * ((s + 1) * t + s);
}

export const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  w: a.w + (b.w - a.w) * k,
  h: a.h + (b.h - a.h) * k,
});

/** Animation frames stay inside the region even when easing overshoots. */
export const boundedRecoilRect = (from: Rect, to: Rect, k: number, region: Rect, limits: Limits): Rect =>
  clampRect(lerpRect(from, to, easeOutBack(k)), region, limits);
