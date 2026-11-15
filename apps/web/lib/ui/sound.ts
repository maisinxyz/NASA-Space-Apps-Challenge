/* eslint-disable @typescript-eslint/no-explicit-any -- structural Web Audio / timer fakes */
// Web Audio feedback sounds, synthesised (no audio files). Spec: hive/farm-view/SHARED-SPEC.md.
// One AudioContext, created/resumed on the first pointerdown. Mute persisted in localStorage.

export const MUTE_KEY = "fieldtwin:sound-muted";
export const TICK_MIN_GAP_MS = 35;

export type SoundName = "tickWeek" | "tickMonth" | "tap" | "pop" | "close" | "success";

type AudioLike = {
  currentTime: number;
  sampleRate: number;
  state: string;
  destination: unknown;
  resume?: () => Promise<void> | void;
  createGain: () => any;
  createOscillator: () => any;
  createBiquadFilter: () => any;
  createBuffer: (ch: number, len: number, rate: number) => any;
  createBufferSource: () => any;
};

export type SoundDeps = {
  createContext?: () => AudioLike | null;
  now?: () => number;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
};

function defaultContext(): AudioLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function createSound(deps: SoundDeps = {}) {
  const makeContext = deps.createContext ?? defaultContext;
  const now = deps.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  let ctx: AudioLike | null = null;
  let muted = false;
  let lastTick = -Infinity;
  let noise: any = null;

  try {
    const s = deps.storage === undefined ? defaultStorage() : deps.storage;
    muted = s?.getItem(MUTE_KEY) === "1";
  } catch {
    /* storage blocked: stay unmuted */
  }

  function unlock() {
    try {
      if (!ctx) ctx = makeContext();
      if (ctx && ctx.state === "suspended") void ctx.resume?.();
    } catch {
      ctx = null;
    }
  }

  function noiseBuffer(c: AudioLike) {
    if (noise) return noise;
    const len = Math.max(1, Math.floor(c.sampleRate * 0.004));
    noise = c.createBuffer(1, len, c.sampleRate);
    const d = noise.getChannelData(0);
    let seed = 1; // deterministic noise
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
    return noise;
  }

  // ~2 ms noise burst through a band-pass.
  function click(c: AudioLike, t: number, freq: number, gain: number, pitchDrop = 1) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(freq, t);
    if (pitchDrop !== 1) bp.frequency.exponentialRampToValueAtTime(freq * pitchDrop, t + 0.03);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(bp);
    bp.connect(g);
    g.connect(c.destination);
    src.start(t);
    src.stop(t + 0.05);
  }

  function tone(c: AudioLike, t: number, freq: number, dur: number, gain: number, endFreq = freq) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Returns true if a sound was scheduled. */
  function play(name: SoundName): boolean {
    if (muted) return false;
    if (name === "tickWeek" || name === "tickMonth") {
      const t0 = now();
      if (t0 - lastTick < TICK_MIN_GAP_MS) return false;
      lastTick = t0;
    }
    if (process.env.NEXT_PUBLIC_E2E === "1" && typeof window !== "undefined") {
      // Dev-only log for the Playwright checks (hive/farm-view/DECISIONS.md D4).
      const w = window as unknown as { __soundLog?: { name: string; t: number }[] };
      (w.__soundLog ??= []).push({ name, t: now() });
    }
    if (!ctx) return false;
    try {
      const t = ctx.currentTime;
      switch (name) {
        case "tickWeek": click(ctx, t, 3500, 0.06); break;
        case "tickMonth": click(ctx, t, 3000, 0.12, 0.7); break;
        case "tap": click(ctx, t, 3800, 0.04); break;
        case "pop": tone(ctx, t, 220, 0.06, 0.07, 120); break;
        case "close": tone(ctx, t, 180, 0.06, 0.04, 100); break;
        case "success":
          tone(ctx, t, 660, 0.09, 0.03);
          tone(ctx, t + 0.08, 880, 0.12, 0.03);
          break;
      }
      return true;
    } catch {
      return false;
    }
  }

  function setMuted(next: boolean) {
    muted = next;
    try {
      const s = deps.storage === undefined ? defaultStorage() : deps.storage;
      s?.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return {
    unlock,
    play,
    tickWeek: () => play("tickWeek"),
    tickMonth: () => play("tickMonth"),
    tap: () => play("tap"),
    pop: () => play("pop"),
    close: () => play("close"),
    success: () => play("success"),
    setMuted,
    isMuted: () => muted,
    /** Attach the one-shot unlock to the first pointerdown. Returns a cleanup. */
    installUnlock(target: Pick<EventTarget, "addEventListener" | "removeEventListener"> | null =
      typeof window === "undefined" ? null : window) {
      if (!target) return () => {};
      const h = () => {
        unlock();
        target.removeEventListener("pointerdown", h, true);
      };
      target.addEventListener("pointerdown", h, true);
      return () => target.removeEventListener("pointerdown", h, true);
    },
  };
}

export const sound = createSound();
