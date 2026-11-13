// Pure timing and layout math for the viewer (unit-tested): terraform curve, water frame lookup, split layout.

export const TERRAFORM_SECONDS = 2.5;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Terraform state after `elapsedS` seconds. Deterministic: depends only on elapsed time. */
export function terraformAt(elapsedS: number): { rise: number; imagery: number; settle: number; done: boolean } {
  const p = clamp01(elapsedS / TERRAFORM_SECONDS);
  return {
    rise: 1 - Math.pow(1 - p, 3), // ease-out cubic
    imagery: smooth(0.3, 0.95, p),
    settle: smooth(0.5, 1, p), // sun and fog
    done: p >= 1,
  };
}

/**
 * Fractional frame index for `timeMin` given RotationResult.frame_times_min (ascending, any spacing).
 * 12.25 means a quarter of the way from frame 12 to frame 13. Clamps outside the range.
 */
export function frameCoord(frameTimesMin: readonly number[], timeMin: number): number {
  const n = frameTimesMin.length;
  if (n < 2 || timeMin <= frameTimesMin[0]) return 0;
  if (timeMin >= frameTimesMin[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frameTimesMin[mid] <= timeMin) lo = mid;
    else hi = mid;
  }
  const span = frameTimesMin[hi] - frameTimesMin[lo];
  return span > 0 ? lo + (timeMin - frameTimesMin[lo]) / span : lo;
}

/** Halve a frame stack in x and y by taking the max of each 2x2 block (keeps thin flow lines). Low tier only. */
export function downsampleFrames(frames: Uint8Array, width: number, height: number, frameCount: number): { frames: Uint8Array; width: number; height: number } {
  const w = width >> 1;
  const h = height >> 1;
  const out = new Uint8Array(w * h * frameCount);
  for (let f = 0; f < frameCount; f++) {
    const src = f * width * height;
    const dst = f * w * h;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = src + r * 2 * width + c * 2;
        out[dst + r * w + c] = Math.max(frames[i], frames[i + 1], frames[i + width], frames[i + width + 1]);
      }
    }
  }
  return { frames: out, width: w, height: h };
}

export interface ViewRect {
  /** Index into rotationIds. */
  side: 0 | 1;
  x: number;
  width: number;
}

/** Side-by-side viewports in CSS pixels. Both use the full canvas height, the same camera and the same time. */
export function viewRects(canvasWidth: number, mode: "single" | "split", divider = 0.5): ViewRect[] {
  if (mode === "single") return [{ side: 0, x: 0, width: canvasWidth }];
  const left = Math.round(canvasWidth * Math.min(0.9, Math.max(0.1, divider)));
  return [
    { side: 0, x: 0, width: left },
    { side: 1, x: left, width: canvasWidth - left },
  ];
}

/**
 * What each view draws this frame. The ONLY per-side inputs are the rotation's own frame times; the
 * time and the camera are shared, which is what keeps A/B in sync.
 */
export function splitPlan(
  canvasWidth: number,
  mode: "single" | "split",
  divider: number,
  timeMin: number,
  frameTimes: readonly (readonly number[] | undefined)[],
): (ViewRect & { timeMin: number; frame: number })[] {
  return viewRects(canvasWidth, mode, divider).map((r) => ({ ...r, timeMin, frame: frameCoord(frameTimes[r.side] ?? [], timeMin) }));
}
