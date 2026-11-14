// Real load progress of a farm view (prewarmed or landed), for the dive's cloud loading screen. Pure: Globe.tsx feeds it
// the Cesium state every frame. Progress is made of stages that really happened, never a timer:
//   farm surface shown (Google tileset created, or terrain + imagery)  0.15
//   terrain height at the farm centre known                             0.10
//   first view drawn (Google initialTilesLoaded, or globe tiles loaded) 0.25
//   tile streaming: 1 - pending / peak pending since the start          0.50 (only after the surface is shown)
// It reaches 1 only when every stage is done AND nothing is pending AND the scene has settled; until then it is capped
// below 1. Reported values are monotonic and eased (time constant EASE_S), and jump to 1 when done.

export type LoadInputs = {
  /** The farm surface the view asks for is the one shown. */
  surfaceReady: boolean;
  /** The terrain height at the farm centre is known (terrain sample returned, or the tiles give it). */
  groundKnown: boolean;
  /** The first view of the surface has loaded (Google: initialTilesLoaded fired; terrain: globe tiles loaded once). */
  firstView: boolean;
  /** Tiles still loading on what is shown (globe queue + tileset requests and processing). */
  pending: number;
  /** Cesium reports every shown layer loaded for this view. */
  tilesLoaded: boolean;
};

export type LoadTrack = {
  farmId: string;
  /** performance.now() at the start, ms. */
  at: number;
  /** Highest pending count seen (the streaming denominator). */
  peak: number;
  /** Stages seen at least once (a stage never un-happens). */
  firstView: boolean;
  groundKnown: boolean;
  /** Reported (eased, monotonic) progress 0..1. */
  value: number;
  done: boolean;
};

/** Do not call it done before requests have had a moment to start (Cesium reports "loaded" before it asks for tiles). */
export const LOAD_SETTLE_MS = 400;
/** Cap while not done, so the bar never sits at 100 % on a scene that is still loading. */
export const LOAD_CAP = 0.97;
const EASE_S = 0.18;

export const startLoad = (farmId: string, now: number): LoadTrack => ({ farmId, at: now, peak: 0, firstView: false, groundKnown: false, value: 0, done: false });

/** Raw (uneased) progress of the stages, 0..1. Mutates the sticky stage flags and the peak. */
export function rawLoad(t: LoadTrack, i: LoadInputs): number {
  if (i.groundKnown) t.groundKnown = true;
  if (i.surfaceReady && i.firstView) t.firstView = true;
  if (i.surfaceReady) t.peak = Math.max(t.peak, i.pending);
  const streaming = !i.surfaceReady ? 0 : t.peak === 0 ? (i.tilesLoaded ? 1 : 0) : 1 - Math.min(i.pending, t.peak) / t.peak;
  return (i.surfaceReady ? 0.15 : 0) + (t.groundKnown ? 0.1 : 0) + (t.firstView ? 0.25 : 0) + 0.5 * streaming;
}

/** Advance the track one frame. Returns true when `value` or `done` changed. */
export function stepLoad(t: LoadTrack, i: LoadInputs, now: number, dtS: number): boolean {
  if (t.done) return false;
  const raw = rawLoad(t, i);
  if (i.surfaceReady && t.groundKnown && t.firstView && i.tilesLoaded && i.pending === 0 && now - t.at > LOAD_SETTLE_MS) {
    t.done = true;
    t.value = 1;
    return true;
  }
  const target = Math.min(LOAD_CAP, raw);
  if (target <= t.value) return false;
  const next = t.value + (target - t.value) * (1 - Math.exp(-Math.max(0, dtS) / EASE_S));
  const changed = next - t.value > 1e-4;
  t.value = next;
  return changed;
}
