// Window manager config: every farm-screen panel is a draggable, resizable window. One place for ids, titles, size
// limits and default layout. Sizes are CSS px inside the farm screen (the .fv-root box, normally the viewport).
import type { Bounds, Rect } from "./geometry";

export type WindowId = "nav" | "time" | "inspector" | "future" | "copilot" | "planner" | "simulation";

/**
 * "hide": always available; the close button hides it and the dock reopens it (user-owned visibility).
 * "context": shown while the app has something to show (a drawer, a card, Gus, the planner); close calls the
 * app's own close so existing behaviour is unchanged.
 */
export type WindowKind = "hide" | "context";

export type WindowSpec = {
  title: string;
  kind: WindowKind;
  /** Smallest size at which the content is still fully readable and usable. */
  minW: number;
  minH: number;
  /** Largest size: the work area minus this margin on each side (so the frame edges stay visible). */
  maxMargin: number;
  defaultRect(work: Rect): Rect;
};

/** Gap kept between default windows and the screen edges. */
const GAP = 16;
/** Free strip along the bottom for the map scale bar and imagery attribution (Map2D keeps its chrome in it). */
export const BOTTOM_STRIP = 40;
/** Height of the dock (window launcher) along the top centre; maximised windows start below it. */
export const DOCK_H = 48;
/** Title bar height; also what stays on screen when keeping a window reachable. */
export const TITLE_H = 34;
/** Left navigation width in the default layout (the old fixed sidebar was 256px). */
const NAV_W = 256;
/** Inspector width in the default layout (the old fixed drawer was 360px). */
const INSPECTOR_W = 360;
/** Timeline window height: title bar + horizon tabs (44) + timeline (150) + padding. */
const TIME_H = 260;

/** Below this width the default layout stacks full-width windows instead of columns. */
export const NARROW_W = 760;
const narrow = (work: Rect) => work.w < NARROW_W;
/** Narrow screens: one full-width column; nav on top, timeline at the bottom, everything else between. */
const stacked = (work: Rect, part: "top" | "middle" | "bottom" | "full"): Rect => {
  const x = work.x + GAP / 2;
  const w = work.w - GAP;
  const topH = Math.round(work.h * 0.4);
  if (part === "top") return { x, y: work.y + GAP / 2, w, h: topH };
  if (part === "bottom") return { x, y: work.y + work.h - GAP / 2 - TIME_H, w, h: TIME_H };
  if (part === "middle") return { x, y: work.y + GAP / 2, w, h: work.h - TIME_H - GAP * 1.5 };
  return { x, y: work.y + GAP / 2, w, h: work.h - GAP };
};

const rightColumn = (work: Rect): Rect => {
  if (narrow(work)) return stacked(work, "middle");
  const w = Math.min(INSPECTOR_W, work.w - 2 * GAP);
  return { x: work.x + work.w - GAP - w, y: work.y + GAP, w, h: work.h - TIME_H - 3 * GAP };
};

export const WINDOW_CONFIG: Record<WindowId, WindowSpec> = {
  nav: {
    title: "Farm",
    kind: "hide",
    // 220: the action buttons ("Compare rotations", "Plan rotations") stay on one line and the overview's
    // label/value rows keep their gap. 260: title bar + back link + farm name + three action rows stay visible;
    // the rest scrolls.
    minW: 220,
    minH: 260,
    maxMargin: 8,
    defaultRect: (work) => (narrow(work) ? stacked(work, "top") : { x: work.x + GAP, y: work.y + GAP, w: NAV_W, h: work.h - 2 * GAP }),
  },
  time: {
    title: "Timeline",
    kind: "hide",
    // 320: compact tier (stacked readout, 40px play/toggle targets) with 10 year ticks thinned to every 2nd.
    // 260: title bar + tabs + compact stacked readout + 72px slider track.
    minW: 320,
    minH: 260,
    maxMargin: 8,
    defaultRect: (work) => {
      if (narrow(work)) return stacked(work, "bottom");
      const x = work.x + GAP + NAV_W + GAP;
      return { x, y: work.y + work.h - GAP - TIME_H, w: Math.max(320, work.x + work.w - GAP - x), h: TIME_H };
    },
  },
  simulation: {
    title: "Simulation",
    kind: "context",
    minW: 320,
    minH: 280,
    maxMargin: 8,
    defaultRect: (work) => ({ x: work.x + GAP + NAV_W + GAP, y: work.y + GAP, w: 420, h: Math.min(720, work.h - 2 * GAP) }),
  },
  inspector: {
    title: "Panel",
    kind: "context",
    // 280: condition pills wrap two per row and the observations grid keeps two columns. 200: title + a few
    // rows of content; the body scrolls.
    minW: 280,
    minH: 200,
    maxMargin: 8,
    defaultRect: rightColumn,
  },
  future: {
    title: "Details",
    kind: "context",
    // 300: what-if sliders and forecast sparklines keep their label + value on one line.
    minW: 300,
    minH: 200,
    maxMargin: 8,
    defaultRect: rightColumn,
  },
  copilot: {
    title: "Ask Gus",
    kind: "context",
    // 300: chat bubbles stay readable (~36 characters a line) and the send row fits input + button.
    // 320: header, a couple of messages and the composer.
    minW: 300,
    minH: 320,
    maxMargin: 8,
    defaultRect: (work) => {
      if (narrow(work)) return stacked(work, "full");
      const w = Math.min(380, work.w - 2 * GAP);
      return { x: work.x + work.w - GAP - w, y: work.y + GAP, w, h: work.h - 2 * GAP };
    },
  },
  planner: {
    title: "Rotation planner",
    kind: "context",
    // 560: the planner's two columns (crop list ≥ 240 + plan grid ≥ 300) side by side. 360: list + a few rows.
    minW: 560,
    minH: 360,
    maxMargin: 8,
    defaultRect: (work) => {
      if (narrow(work)) return stacked(work, "full");
      const x = work.x + GAP + NAV_W + GAP;
      return { x, y: work.y + GAP, w: Math.max(560, work.x + work.w - GAP - x), h: work.h - 2 * GAP };
    },
  },
};

export const WINDOW_IDS = Object.keys(WINDOW_CONFIG) as WindowId[];

/** The area windows live in: the screen minus the dock row on top and the map-chrome strip at the bottom. */
export function workArea(b: Bounds): Rect {
  return { x: 0, y: DOCK_H, w: b.w, h: Math.max(0, b.h - DOCK_H - BOTTOM_STRIP) };
}

/**
 * Size limits for one window on the current screen. On a screen smaller than a window's minimum (a phone and the
 * 560px planner) the minimum yields to the screen, so the window, and its title bar, always fits on screen.
 */
export function limitsFor(id: WindowId, b: Bounds) {
  const s = WINDOW_CONFIG[id];
  const maxW = Math.max(0, b.w - 2 * s.maxMargin);
  const maxH = Math.max(0, b.h - DOCK_H - BOTTOM_STRIP - s.maxMargin);
  return { minW: Math.min(s.minW, maxW), minH: Math.min(s.minH, maxH), maxW, maxH };
}
