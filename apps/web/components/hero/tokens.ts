// Hero design tokens: colour, look-around, motion. One place to tune the helmet experience.
// Durations are milliseconds unless the name says otherwise. Exits are 20% shorter than entrances.

// ---------- colour ----------
export const color = {
  space: "#000000",
  /** Helmet shell: near-black with a faint cool cast. */
  shell: "#030405",
  shellEdge: "#0a0c10",
  /** Off-white text; hierarchy comes from opacity (see `ink`). */
  text: "#eceef1",
  /** The only accent: a soft light blue (not cyan) for selection, live/confirm states and the Earth attribution. */
  accent: "#a3bfe9",
  /** Same accent as an "r,g,b" triplet for canvas drawing (waypoint pins). */
  accentRgb: "163,191,233",
} as const;

/** Text opacity steps. Secondary text stays readable (55–70%). */
export const ink = { primary: 0.92, secondary: 0.64, tertiary: 0.42, faint: 0.22 } as const;

// ---------- look-around (head turn inside the helmet) ----------
export const look = {
  /** Head rotation at the cursor limit, degrees. */
  maxYawDeg: 6,
  maxPitchDeg: 4,
  /** Cursor offset (fraction of the half-viewport) that reaches the limit; beyond it the head rubber-bands. */
  limitAt: 0.82,
  /** How much further the head may stretch past the limit, as a fraction of the limit (asymptotic). */
  rubberBand: 0.18,
  /**
   * Head spring (mass 1). Lower stiffness = more mass; damping ratio ≈ 0.9 lets the head settle with weight, a hair of
   * follow-through but no visible bounce.
   */
  stiffness: 58,
  damping: 13.5,
  /** The head leans into turns: roll in degrees per (limit units per second) of yaw speed, capped. */
  rollPerYawSpeed: 0.55,
  maxRollDeg: 0.9,
  /** Breathing sway while you hold still: tiny slow drift of the head, degrees and hertz. */
  breathe: { pitchDeg: 0.12, pitchHz: 0.21, yawDeg: 0.08, yawHz: 0.13 },
  /** HUD lags the head by this time constant, ms, and counter-drifts by up to this many px. */
  hudLagMs: 80,
  hudCounterDriftPx: 1.5,
} as const;

// ---------- rendering budget ----------
export const render = {
  /** Resolution cap (x CSS pixels): space needs little, the farm benefits from more. */
  globeScale: 1,
  farmScale: 1.5,
  minScale: 0.75,
  /** Frame-time governor: step down when the average exceeds the budget, back up when there is headroom, ms. */
  budgetMs: 16.7,
  headroomMs: 11,
  step: 0.125,
} as const;

/** Earth imagery grading: a little more contrast and colour, without going synthetic. */
export const earthLook = { contrast: 1.18, saturation: 1.28, brightness: 1.02, gamma: 0.97 } as const;

/**
 * The dive from space into a waypoint. The waypoint stays dead centre the whole way: first a swing to centre it, then a
 * fall straight in (accelerating like a meteor in log-distance), a low skim toward it across the land, and a brake into
 * the farm framing.
 */
export const dive = {
  centreSeconds: 1.0,
  fallSeconds: 4.4,
  /** Share of the fall's log-distance reached when the brake begins, and the time share at that point. */
  brakeAt: 0.8,
  /** Pitch profile over the fall (by log-distance progress): straight down, then a low skim, then the framing. */
  skimFrom: 0.58,
  skimTo: 0.86,
  skimPitchDeg: -21,
  /** Never let the camera drop below this height over the target during the fall, metres. */
  minHeightM: 420,
} as const;

// ---------- motion ----------
const exit = (ms: number) => Math.round(ms * 0.8);

export const ease = {
  /** Entrances: ease in-and-out. */
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** Exits: quicker out. */
  out: [0.2, 0, 0, 1] as [number, number, number, number],
} as const;

export const popover = {
  openMs: 180,
  closeMs: exit(180),
  fromScale: 0.95,
  /** Rows stagger in; details (coords, metrics) settle one beat after the names. */
  rowStaggerMs: 30,
  detailDelayMs: 60,
} as const;

export const card = { openMs: 220, closeMs: exit(220), fromScale: 0.95 } as const;

/** Detail screen that opens from a pin: enters (ease out) from the pin, leaves back to it 20% quicker. */
export const detail = { openMs: 220, closeMs: exit(220), fromScale: 0.95 } as const;

/** Scroll-to-zoom on the centred Earth: camera distance as a multiple of the whole-Earth distance. */
export const zoom = {
  min: 0.3,
  max: 1.25,
  /** Exponent per wheel pixel (exponential, so each notch feels the same). */
  perPx: 0.0014,
  glideMs: 260,
} as const;

/** Camera fly-to between points on the globe: a great-circle arc, eased in then flashed out. */
export const flyTo = { seconds: 1.1 } as const;
/** "Ease in, flash out": accelerate smoothly, then arrive in a short, decisive settle. */
export const easeInFlashOut = (t: number) => (t < 0.72 ? 0.72 * Math.pow(t / 0.72, 2.4) : 1 - 0.28 * Math.pow(1 - (t - 0.72) / 0.28, 3));

/** Confirmation pulse on the selected marker. */
export const pulse = {
  ms: 650,
  toScale: 2.4,
  /** Button confirm ring, and the beat before the action fires. */
  confirmMs: 220,
} as const;

/** Press feel for every interactive element. */
export const press = {
  scale: 0.97,
  /** Micro-vibration: translateX keyframes over `vibrateMs`. */
  vibrateX: [0, 1, -1, 0],
  vibrateMs: 120,
  haptic: 8,
  /** Release: critically damped, so no overshoot. */
  release: { type: "spring" as const, stiffness: 520, damping: 46, mass: 1 },
} as const;

/** Everyday UI spring: moderate, no bounce (damping ratio ≥ 1). */
export const uiSpring = { type: "spring" as const, stiffness: 300, damping: 35, mass: 1 };

/** Toggle knobs stretch along their travel, then settle. */
export const knob = { stretch: 1.12 } as const;

/** Icon crossfade: opacity with a slight blur. */
export const iconSwap = { ms: 160, blurPx: 3 } as const;

/** Entrance of the whole hero once the Earth is ready. */
export const heroIn = { ms: 1400 } as const;

// ---------- resting hero (link-1 layout) and its drag states ----------
/**
 * Hero states: "hero" (text + Earth on the right, slow spin) → "dragging" (pressed: text out, Earth glides to centre)
 * → "centred" (released, Earth stays centred) → "ui" (map UI in) → back to "hero" after idle.
 */
export const hero = {
  /** Where the Earth rests in the hero: its centre sits this far right of screen centre, as a fraction of half the width. */
  restOffsetX: 0.45,
  /** Earth glide between the right and the centre. */
  glideMs: 950,
  /** Press-and-move this far before a press counts as a drag, px. */
  dragThresholdPx: 4,
  /** After the last interaction: map UI fades in after `uiAfterMs`; with no pointer activity for `heroAfterMs` the hero returns. */
  uiAfterMs: 2000,
  heroAfterMs: 7000,
  /** Hero text: staggered fade out (right side first, then left column, headline last) and back in reverse. */
  textOutMs: 240,
  textInMs: 420,
  textStaggerMs: 70,
  /** Map UI fade. */
  uiInMs: 380,
  uiOutMs: 300,
  /** Layout reference: link 1 was designed on a 1440 x 1022 canvas; sizes scale down with the viewport from there. */
  designW: 1440,
  designH: 1022,
} as const;

/** Earth lighting in the hero: the sun follows the camera from the upper left, so the visible face is always lit. */
export const sun = { leftOfViewDeg: 38, aboveDeg: 12 } as const;

// ---------- arrival title (country / locality / farm name) ----------
/**
 * A directional sweep: on entry the text fades in from the right edge toward the left (letter by letter for the
 * country, word by word below), each piece drifting slightly leftward into place; on exit it fades out from the left
 * toward the right, drifting on to the right. Seconds unless noted.
 */
export const arrivalTitle = {
  letterStagger: 0.055,
  wordStagger: 0.09,
  inS: 0.75,
  hold: 2.4,
  outStagger: 0.04,
  outS: 0.5,
  /** Drift distance, em. */
  driftEm: 0.32,
  /** Gap between the country finishing and the lines below starting. */
  linesDelayS: 0.12,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  easeOut: [0.55, 0, 0.75, 0.2] as [number, number, number, number],
  /** Reduced motion: plain crossfade. */
  fadeS: 0.35,
} as const;

/** Farm controls fade in once the title has fully exited. */
export const farmControlsIn = { ms: 420 } as const;

