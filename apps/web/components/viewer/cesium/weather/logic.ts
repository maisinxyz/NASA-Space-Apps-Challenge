// Pure logic of the weather engine (no Cesium): detail tiers, rain mapping, lightning limiter, auto step-down, sun.
import type { DetailLevel } from "@/components/globe/types";

export type TierSettings = { cloudSteps: number; fbmOctaves: number; rainLayers: number; shimmer: boolean; sparkle: boolean };

// Cloud steps march at most CLOUD_MARCH_M along the ray (was 2500 m), so each step is ~4x shorter than before and
// one extra step on high/medium/low stays within the old cost (the march also stops once the cloud is opaque).
const TIERS: Record<DetailLevel, TierSettings> = {
  high: { cloudSteps: 7, fbmOctaves: 4, rainLayers: 3, shimmer: true, sparkle: true },
  medium: { cloudSteps: 5, fbmOctaves: 3, rainLayers: 2, shimmer: true, sparkle: true },
  low: { cloudSteps: 3, fbmOctaves: 2, rainLayers: 1, shimmer: false, sparkle: false },
};
/** Longest stretch of a ray marched through the cloud slab (m); grazing rays fade to an even veil beyond ~300 m. */
export const CLOUD_MARCH_M = 1200;
/** Cloud extinction per metre at density 1 (mood): a 110 m column through a dense core lets ~5% light through. */
export const CLOUD_SIGMA = 0.028;

/**
 * Vertical cloud density profile over the slab, h = 0 at the base .. 1 at the top. Mirrors cloudProfile() in
 * shader.ts (keep both in sync): a soft, short fade at the base, full density from h ~0.2 to ~0.55, a long rounded
 * fade to the top, so only the densest cores reach the top and bottom (soft edges, one continuous mass).
 */
export function cloudProfile(h: number): number {
  const s = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return s(0, 0.2, h) * s(1, 0.55, h);
}
export const tierSettings = (d: DetailLevel): TierSettings => TIERS[d];
export const stepDown = (d: DetailLevel): DetailLevel => (d === "high" ? "medium" : "low");
const RANK: Record<DetailLevel, number> = { low: 0, medium: 1, high: 2 };
export const lowerOf = (a: DetailLevel, b: DetailLevel): DetailLevel => (RANK[a] <= RANK[b] ? a : b);

/** Rain streak density 0..1 from the rain rate (mm/h): saturating, 0 at 0, ~0.4 at 10, ~0.86 at 40, ~0.99 at 100. */
export const rainDensity = (mmH: number): number => (mmH > 0 && Number.isFinite(mmH) ? 1 - Math.exp(-mmH / 20) : 0);
/** Fall speed multiplier: heavier rain reads faster (mood; bigger drops fall faster). */
export const rainSpeed = (mmH: number): number => 1 + 0.6 * Math.min(1, Math.max(0, mmH) / 50);

/**
 * Lightning limiter. At most ONE flash start per `minGapS` (3 s), none at all under reduced motion (WCAG 2.3.1).
 * A flash is a single soft pulse (fast rise, ~0.2 s decay), returned as 0..1; the shader keeps it far from white.
 */
export function createLightning(rand: () => number, minGapS = 3) {
  let lastStart = -Infinity;
  let lastNow: number | null = null;
  return {
    update(weight: number, nowS: number, reducedMotion: boolean): number {
      const dt = lastNow === null ? 0 : Math.max(0, nowS - lastNow);
      lastNow = nowS;
      if (reducedMotion) {
        lastStart = -Infinity; // nothing pending; and nothing shown
        return 0;
      }
      if (weight > 0 && nowS - lastStart >= minGapS && rand() < 1 - Math.exp(-0.5 * weight * dt)) lastStart = nowS;
      const t = nowS - lastStart;
      if (t < 0 || t > 0.9) return 0;
      return t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) / 0.18);
    },
    /** Start time of the most recent flash (tests). */
    get lastStart() {
      return lastStart;
    },
  };
}

/**
 * Automatic step-down: if the smoothed frame rate stays below `fpsFloor` for `holdS` seconds, drop one tier.
 * After a change (or a new requested detail) wait `graceS` (shader rebuild hitch) before judging again.
 * A new requested detail resets the cap. Never steps up on its own.
 */
export function createAutoTier(fpsFloor = 45, holdS = 2, graceS = 1) {
  let requested: DetailLevel | null = null;
  let cap: DetailLevel = "high";
  let low = 0;
  let grace = graceS;
  let ema = 60;
  let steps = 0;
  return {
    update(req: DetailLevel, dtS: number): DetailLevel {
      if (req !== requested) {
        requested = req;
        cap = req;
        low = 0;
        grace = graceS;
        steps = 0;
      }
      // dt arrives capped at 0.1 s: a capped gap is a stall or a throttled background window, not a slow render.
      if (dtS <= 0 || dtS >= 0.099) return cap;
      if (grace > 0) {
        grace -= dtS;
        ema = 60;
        return cap;
      }
      ema += (1 / dtS - ema) * Math.min(1, dtS * 4); // ~0.25 s time constant
      low = ema < fpsFloor ? low + dtS : 0;
      if (low >= holdS && cap !== "low") {
        cap = stepDown(cap);
        steps++;
        low = 0;
        grace = graceS;
      }
      return cap;
    },
    /** How many tiers the engine stepped down since the last requested change. */
    get steps() {
      return steps;
    },
    get fps() {
      return ema;
    },
  };
}

export type Sun = { dir: [number, number, number]; exposure: number; color: [number, number, number] };

/**
 * Stylised sun for a local solar hour (mood only, not an ephemeris): rises in the east at 06:00, ~55 deg high at noon
 * (in the south), sets in the west at 18:00. dir is east/north/up (unit). exposure scales scene brightness:
 * night ~0.35, golden dawn/dusk, day = sunIntensity (gentler above 1: 1.5 -> 1.2).
 */
export function sunFor(hours: number, sunIntensity: number): Sun {
  const h = ((hours % 24) + 24) % 24;
  const day = (h - 6) / 12; // 0 sunrise .. 1 sunset
  const elev = Math.sin(Math.PI * day) * ((55 * Math.PI) / 180); // negative at night
  const az = Math.PI / 2 + Math.PI * day; // radians from north, clockwise: 90 east -> 180 south -> 270 west
  const up = Math.max(Math.sin(elev), 0.08); // keep a light direction above the horizon
  const flat = Math.sqrt(1 - up * up);
  const dir: [number, number, number] = [Math.sin(az) * flat, Math.cos(az) * flat, up];
  const e = Math.sin(elev);
  const daylight = Math.min(1, Math.max(0, (e + 0.1) / 0.35)); // 0 at night .. 1 once the sun is ~15 deg up
  const golden = Math.max(0, 1 - Math.abs(e - 0.08) / 0.25) * (e > -0.1 ? 1 : 0); // warm light near the horizon
  const i = Math.min(1.5, Math.max(0, sunIntensity));
  const dayLevel = i > 1 ? 1 + (i - 1) * 0.4 : i; // above 1, brighten gently: photogrammetry roofs clip fast
  const exposure = 0.35 + (dayLevel - 0.35) * daylight;
  const color: [number, number, number] = [1, 1 - 0.18 * golden, 1 - 0.38 * golden];
  if (daylight < 1) {
    // Moonlight blue at night.
    const n = 1 - daylight;
    color[0] -= 0.25 * n;
    color[1] -= 0.12 * n;
  }
  return { dir, exposure, color };
}

/**
 * Low cloud slab (metres above the fields). Nominally 150-350 m, but always kept ~50 m below the camera so the
 * puffs sit between camera and ground (the farm camera can be as low as ~60 m); ~110 m thick, base never below 40 m.
 */
/**
 * World wind direction (unit east/north, the way the wind blows) from the wind slant (rad). Mood only: the contract
 * has no wind direction, so it is a fixed west-south-west breeze (the cloud drift the engine always had) that veers a
 * little west as the slant grows. Clouds drift this way and rain leans this way, so both turn on screen with the
 * camera heading.
 */
export function windDir(slantRad: number): [number, number] {
  const e = Math.cos(slantRad * 0.5);
  const n = 0.35;
  const l = Math.hypot(e, n);
  return [-e / l, -n / l];
}

/** Unit fall direction of rain in the local east/north/up frame: down, leaning `slantRad` from vertical along `wind`. */
export function rainFall(wind: [number, number], slantRad: number): [number, number, number] {
  const k = Math.tan(Math.min(Math.max(slantRad, 0), 1.2));
  const l = Math.hypot(wind[0] * k, wind[1] * k, 1);
  return [(wind[0] * k) / l, (wind[1] * k) / l, -1 / l];
}

export function cloudSlab(cameraHeightM: number): { x: number; y: number } {
  const top = Math.min(350, Math.max(90, cameraHeightM - 50));
  return { x: Math.max(40, top - 110), y: top };
}
