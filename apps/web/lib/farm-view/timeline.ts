// Timeline logic for the farm view: date maths, tick detection, drag/snap/glide/coast engine.
// Pure and time-injected so it runs in node tests. Spec: hive/farm-view/SHARED-SPEC.md (TIMELINE).

export const YEAR = 2026; // sample-data year (not a leap year)
export const DAYS = 365;
export const LAST_DAY = DAYS - 1; // day index 0 = 1 Jan, 364 = 31 Dec
export const MAGNET_PX = 6;
export const SPRING = { stiffness: 500, damping: 38 } as const;
export const GLIDE_MS = 250;
export const FLICK_MIN_PX_PER_S = 500;
export const COAST_FRICTION = 4; // 1/s velocity decay

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_STARTS: readonly number[] = MONTH_LENGTHS.reduce<number[]>((a, _, i) => [...a, i === 0 ? 0 : a[i - 1] + MONTH_LENGTHS[i - 1]], []);

export type Season = "Winter" | "Spring" | "Summer" | "Autumn";
export type TickKind = "week" | "month" | "season";
export type TickEvent = { kind: TickKind; day: number };

export const clampDay = (d: number) => Math.min(LAST_DAY, Math.max(0, d));
export const monthOf = (day: number) => {
  const d = Math.floor(clampDay(day));
  let m = 11;
  while (MONTH_STARTS[m] > d) m--;
  return m;
};
/** Northern-hemisphere meteorological seasons (Zürich). */
export const seasonOfMonth = (m: number): Season => (m === 11 || m <= 1 ? "Winter" : m <= 4 ? "Spring" : m <= 7 ? "Summer" : "Autumn");

export function dateOf(day: number) {
  const d = Math.floor(clampDay(day));
  const month = monthOf(d);
  const dayOfMonth = d - MONTH_STARTS[month] + 1;
  return {
    month,
    monthName: MONTH_NAMES[month],
    dayOfMonth,
    week: Math.floor(d / 7) + 1, // week 1 starts 1 Jan; 14 July -> 28
    season: seasonOfMonth(month),
    label: `${dayOfMonth} ${MONTH_NAMES[month]}`, // aria-valuetext
  };
}

export const dayToX = (day: number, width: number) => (clampDay(day) / LAST_DAY) * width;
export const xToDay = (x: number, width: number) => clampDay((x / width) * LAST_DAY);
export const nearestDay = (d: number) => clampDay(Math.round(d));
export const nearestWeekDay = (d: number) => Math.min(LAST_DAY, Math.max(0, Math.round(d / 7) * 7));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Pull x onto a month line when within `radius` px of it. */
export function magnetX(x: number, width: number, radius = MAGNET_PX) {
  let best = x;
  let bestDist = radius + 1e-9;
  for (const s of MONTH_STARTS) {
    const lx = dayToX(s, width);
    const dist = Math.abs(x - lx);
    if (dist <= bestDist) { best = lx; bestDist = dist; }
  }
  return best;
}

/** Tick events for the integer day boundaries crossed moving prev -> next, in travel order. */
export function crossings(prev: number, next: number): TickEvent[] {
  if (prev === next) return [];
  const lo = Math.min(prev, next), hi = Math.max(prev, next);
  const out: TickEvent[] = [];
  for (let b = Math.floor(lo) + 1; b <= hi; b++) {
    if (b > LAST_DAY) break;
    const mi = MONTH_STARTS.indexOf(b);
    if (mi >= 0) out.push({ kind: seasonOfMonth(mi) !== seasonOfMonth(mi - 1) ? "season" : "month", day: b });
    else if (b % 7 === 0) out.push({ kind: "week", day: b });
  }
  return next < prev ? out.reverse() : out;
}

export const strongest = (evs: TickEvent[]): TickEvent | null =>
  evs.reduce<TickEvent | null>((a, e) => (!a || rank(e) > rank(a) ? e : a), null);
const rank = (e: TickEvent) => (e.kind === "season" ? 2 : e.kind === "month" ? 1 : 0);

/** navigator.vibrate pattern: 8 per week, 16 per month, [10,30,10] at a season change. */
export function hapticFor(kind: TickKind): number | number[] {
  return kind === "season" ? [10, 30, 10] : kind === "month" ? 16 : 8;
}

export function vibrate(kind: TickKind, nav: { vibrate?: (p: number | number[]) => boolean } | undefined =
  typeof navigator === "undefined" ? undefined : navigator) {
  try { if (nav && typeof nav.vibrate === "function") nav.vibrate(hapticFor(kind)); } catch { /* unsupported */ }
}

/** Keyboard: ←/→ day, Shift week, PageUp/Down month, Home/End. Returns the new day or null if unhandled. */
export function keyToDay(day: number, key: string, shift = false): number | null {
  const d = Math.round(day);
  switch (key) {
    case "ArrowLeft": return clampDay(d - (shift ? 7 : 1));
    case "ArrowRight": return clampDay(d + (shift ? 7 : 1));
    case "PageUp":
    case "PageDown": {
      const dir = key === "PageDown" ? 1 : -1; // PageDown = later
      const { month, dayOfMonth } = dateOf(d);
      const m = month + dir;
      if (m < 0 || m > 11) return dir > 0 ? LAST_DAY : 0;
      return clampDay(MONTH_STARTS[m] + Math.min(dayOfMonth, MONTH_LENGTHS[m]) - 1);
    }
    case "Home": return 0;
    case "End": return LAST_DAY;
    default: return null;
  }
}

type Mode = "idle" | "drag" | "glide" | "spring" | "coast";
export type EngineOpts = {
  width: number;
  reducedMotion?: boolean;
  initialDay?: number;
  /** Called whenever the day value changes. `dragging` is true while the handle is held. */
  onDay?: (day: number, dragging: boolean) => void;
  /** Called per tick event crossed (the consumer plays sound / haptics). */
  onTick?: (e: TickEvent) => void;
};

export class TimelineEngine {
  day: number;
  mode: Mode = "idle";
  width: number;
  reducedMotion: boolean;
  private o: EngineOpts;
  private vel = 0; // days/s
  private lastT = 0;
  private lastX = 0;
  private velPx = 0; // smoothed px/s while dragging
  private target = 0;
  private glideFrom = 0;
  private glideStart = 0;

  constructor(o: EngineOpts) {
    this.o = o;
    this.width = o.width;
    this.reducedMotion = !!o.reducedMotion;
    this.day = clampDay(o.initialDay ?? 0);
  }

  get dragging() { return this.mode === "drag"; }
  get animating() { return this.mode !== "idle" && this.mode !== "drag"; }

  private set(next: number) {
    next = clampDay(next);
    if (next === this.day) return;
    const evs = crossings(this.day, next);
    this.day = next;
    this.o.onDay?.(next, this.dragging);
    for (const e of evs) this.o.onTick?.(e);
  }

  setWidth(w: number) { this.width = w; }

  /** Set the day from outside (e.g. controlled prop), no ticks, cancels motion. */
  jump(day: number) { this.mode = "idle"; const d = clampDay(day); if (d !== this.day) { this.day = d; this.o.onDay?.(d, false); } }

  pointerDown(x: number, t: number) {
    this.mode = "drag";
    this.lastX = x; this.lastT = t; this.velPx = 0;
    this.set(xToDay(magnetX(x, this.width), this.width));
  }

  pointerMove(x: number, t: number) {
    if (this.mode !== "drag") return;
    const dt = (t - this.lastT) / 1000;
    if (dt > 0) this.velPx = 0.6 * ((x - this.lastX) / dt) + 0.4 * this.velPx;
    this.lastX = x; this.lastT = t;
    this.set(xToDay(magnetX(x, this.width), this.width));
  }

  /** Release: flick coasts then snaps to the nearest week; otherwise springs to the nearest day. */
  pointerUp(t: number) {
    if (this.mode !== "drag") return;
    const stale = (t - this.lastT) > 80; // pointer rested before release: not a flick
    const flick = !stale && Math.abs(this.velPx) >= FLICK_MIN_PX_PER_S && !this.reducedMotion;
    this.lastT = t;
    if (flick) {
      this.vel = (this.velPx / this.width) * LAST_DAY;
      this.mode = "coast";
    } else {
      this.snapTo(nearestDay(this.day));
    }
  }

  private snapTo(target: number) {
    this.target = target;
    this.vel = 0;
    if (this.reducedMotion) { this.mode = "idle"; this.set(target); return; }
    this.mode = "spring";
  }

  /** Click on the track: glide there over 250 ms (ease-out), ticking along the way. */
  clickTrack(x: number, t: number) {
    const target = nearestDay(xToDay(x, this.width));
    if (this.reducedMotion) { this.mode = "idle"; this.set(target); return; }
    this.glideFrom = this.day; this.target = target; this.glideStart = t; this.lastT = t;
    this.mode = "glide";
  }

  /** Returns true if the key was handled. */
  key(key: string, shift = false): boolean {
    const next = keyToDay(this.day, key, shift);
    if (next === null) return false;
    this.mode = "idle";
    this.set(next);
    return true;
  }

  /** Advance animations to time t (ms). Call from rAF while `animating`. */
  step(t: number) {
    const dt = Math.min(0.05, Math.max(0, (t - this.lastT) / 1000));
    if (this.mode === "glide") {
      const p = (t - this.glideStart) / GLIDE_MS;
      if (p >= 1) { this.mode = "idle"; this.set(this.target); }
      else this.set(this.glideFrom + (this.target - this.glideFrom) * easeOutCubic(p));
    } else if (this.mode === "coast") {
      this.vel *= Math.exp(-COAST_FRICTION * dt);
      const next = this.day + this.vel * dt;
      const atEdge = next <= 0 || next >= LAST_DAY;
      this.set(next);
      if (atEdge || Math.abs(this.vel) < 0.5) this.snapTo(nearestWeekDay(this.day));
    } else if (this.mode === "spring") {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      let d = this.day, v = this.vel;
      for (let i = 0; i < n; i++) {
        v += (-SPRING.stiffness * (d - this.target) - SPRING.damping * v) * h;
        d += v * h;
      }
      this.vel = v;
      if (Math.abs(d - this.target) < 0.002 && Math.abs(v) < 0.02) { this.mode = "idle"; this.set(this.target); }
      else this.set(d);
    }
    this.lastT = t;
  }
}
