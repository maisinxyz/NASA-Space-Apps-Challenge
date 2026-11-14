// Dev-only dive timing: click -> farm interactive (ms) and the worst frame time in between, from requestAnimationFrame.
// Off by default; on with ?perf=1 in the URL or localStorage "ftDivePerf" = "1". Logs to the console and keeps the last
// result on window.__ftDive.

export type DiveTiming = { farmId: string; clickToInteractiveMs: number; worstFrameMs: number; frames: number; over16ms: number };

let run: { farmId: string; t0: number; last: number; worst: number; frames: number; over: number; raf: number } | null = null;

function enabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("perf") === "1" || window.localStorage.getItem("ftDivePerf") === "1";
  } catch {
    return false;
  }
}

/** The click that starts a dive. */
export function diveStart(farmId: string) {
  if (!enabled()) return;
  if (run) cancelAnimationFrame(run.raf);
  const t0 = performance.now();
  const r = { farmId, t0, last: t0, worst: 0, frames: 0, over: 0, raf: 0 };
  const tick = (t: number) => {
    const dt = t - r.last;
    r.last = t;
    if (r.frames > 0) {
      r.worst = Math.max(r.worst, dt);
      if (dt > 16.7) r.over++;
    }
    r.frames++;
    r.raf = requestAnimationFrame(tick);
  };
  r.raf = requestAnimationFrame(tick);
  run = r;
}

/** The farm is interactive (camera input live, veil gone). */
export function diveInteractive(farmId: string): DiveTiming | null {
  const r = run;
  if (!r || r.farmId !== farmId) return null;
  cancelAnimationFrame(r.raf);
  run = null;
  const out: DiveTiming = { farmId, clickToInteractiveMs: Math.round(performance.now() - r.t0), worstFrameMs: +r.worst.toFixed(1), frames: r.frames, over16ms: r.over };
  (window as unknown as { __ftDive?: DiveTiming }).__ftDive = out;
  console.info(`[dive] ${farmId}: click to interactive ${out.clickToInteractiveMs} ms, worst frame ${out.worstFrameMs} ms, ${out.over16ms}/${out.frames} frames over 16.7 ms`);
  return out;
}
