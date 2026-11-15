"use client";
// useWindowManager: the one store for every farm-screen window — rects, minimise/maximise, open/hidden, z-order —
// plus the per-device layout persistence (localStorage, never synced). z-index is assigned only here.
import { create } from "zustand";

import { DOCK_H, limitsFor, WINDOW_CONFIG, WINDOW_IDS, workArea, type WindowId } from "./config";
import { clampRect, fromFrac, toFrac, type Bounds, type Rect } from "./geometry";

export type WinState = {
  rect: Rect;
  /** Rect to return to after maximise. */
  prev: Rect | null;
  minimized: boolean;
  maximized: boolean;
  /** User visibility for "hide" windows (the close button); context windows ignore it. */
  open: boolean;
};

export type WindowManager = {
  bounds: Bounds | null;
  /** False until the saved (or default) layout is applied on the client: windows stay invisible until then. */
  ready: boolean;
  wins: Record<WindowId, WinState>;
  /** Back to front. */
  order: WindowId[];
  /** Context windows with something to show right now (not persisted). */
  active: Partial<Record<WindowId, boolean>>;

  init(b: Bounds): void;
  setBounds(b: Bounds): void;
  setRect(id: WindowId, r: Rect): void;
  focus(id: WindowId): void;
  minimize(id: WindowId): void;
  restore(id: WindowId): void;
  toggleMaximize(id: WindowId): void;
  setOpen(id: WindowId, open: boolean): void;
  setActive(id: WindowId, on: boolean): void;
  reset(): void;
};

export const LAYOUT_KEY = "app.windowLayout.v1";
/** Base of the window stacking range; above the map and its tags, below the dock (Z_DOCK) and toasts. */
export const Z_BASE = 30;
export const Z_DOCK = Z_BASE + WINDOW_IDS.length + 10;
const DEFAULT_ORDER: WindowId[] = ["nav", "time", "inspector", "future", "planner", "copilot"];

/** Where windows may sit: the whole screen below the dock row. */
export const regionFor = (b: Bounds): Rect => ({ x: 0, y: DOCK_H, w: b.w, h: Math.max(0, b.h - DOCK_H) });

/** The maximised rect: the region less each window's margin. */
export function maxRect(id: WindowId, b: Bounds): Rect {
  const m = WINDOW_CONFIG[id].maxMargin;
  const r = regionFor(b);
  return { x: r.x + m, y: r.y, w: Math.max(0, r.w - 2 * m), h: Math.max(0, r.h - m) };
}

export const zIndexOf = (order: WindowId[], id: WindowId) => Z_BASE + Math.max(0, order.indexOf(id));

const fitRect = (id: WindowId, r: Rect, b: Bounds) => clampRect(r, regionFor(b), limitsFor(id, b));

function fit(id: WindowId, w: WinState, b: Bounds): WinState {
  if (w.maximized) return { ...w, rect: maxRect(id, b), prev: w.prev && fitRect(id, w.prev, b) };
  return { ...w, rect: fitRect(id, w.rect, b) };
}

export function defaultWins(b: Bounds): Record<WindowId, WinState> {
  const work = workArea(b);
  return Object.fromEntries(
    WINDOW_IDS.map((id) => [id, { rect: fitRect(id, WINDOW_CONFIG[id].defaultRect(work), b), prev: null, minimized: false, maximized: false, open: true }]),
  ) as Record<WindowId, WinState>;
}

/* ---------- persistence ---------- */

type SavedWin = { r: number[]; p: number[] | null; min: boolean; max: boolean; open: boolean };
type Saved = { v: 1; order: WindowId[]; wins: Partial<Record<WindowId, SavedWin>> };

export function serializeLayout(s: Pick<WindowManager, "wins" | "order">, b: Bounds): string {
  const wins: Saved["wins"] = {};
  for (const id of WINDOW_IDS) {
    const w = s.wins[id];
    wins[id] = { r: toFrac(w.rect, b), p: w.prev && toFrac(w.prev, b), min: w.minimized, max: w.maximized, open: w.open };
  }
  return JSON.stringify({ v: 1, order: s.order, wins } satisfies Saved);
}

const isFrac = (a: unknown): a is number[] =>
  Array.isArray(a) && a.length === 4 && a.every((n) => typeof n === "number" && Number.isFinite(n) && n > -1 && n < 2) && a[2] > 0 && a[3] > 0;

/**
 * Parse a saved layout for this screen. Anything malformed falls back to defaults: the whole layout when the
 * envelope or version is wrong, a single window when only its entry is bad. Rects are clamped to this screen.
 */
export function parseLayout(raw: string | null, b: Bounds): Pick<WindowManager, "wins" | "order"> | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<Saved>;
  if (d.v !== 1 || !d.wins || typeof d.wins !== "object") return null;
  const defaults = defaultWins(b);
  const wins = { ...defaults };
  for (const id of WINDOW_IDS) {
    const sw = (d.wins as Record<string, unknown>)[id] as Partial<SavedWin> | undefined;
    if (!sw || !isFrac(sw.r) || typeof sw.min !== "boolean" || typeof sw.max !== "boolean" || typeof sw.open !== "boolean") continue;
    if (sw.p !== null && !isFrac(sw.p)) continue;
    wins[id] = fit(id, { rect: fromFrac(sw.r, b), prev: sw.p ? fromFrac(sw.p, b) : null, minimized: sw.min, maximized: sw.max, open: sw.open }, b);
  }
  const seen = Array.isArray(d.order) ? d.order.filter((id, i, a): id is WindowId => WINDOW_IDS.includes(id as WindowId) && a.indexOf(id) === i) : [];
  const order = [...seen, ...DEFAULT_ORDER.filter((id) => !seen.includes(id))];
  return { wins, order };
}

function readStorage(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(LAYOUT_KEY);
  } catch {
    return null;
  }
}

/* ---------- store ---------- */

const front = (order: WindowId[], id: WindowId) => [...order.filter((o) => o !== id), id];

export const useWindowManager = create<WindowManager>((set, get) => {
  const patch = (id: WindowId, p: Partial<WinState>) => set((s) => ({ wins: { ...s.wins, [id]: { ...s.wins[id], ...p } } }));
  return {
    bounds: null,
    ready: false,
    wins: defaultWins({ w: 1440, h: 900 }),
    order: DEFAULT_ORDER,
    active: {},

    init: (b) => {
      const saved = parseLayout(readStorage(), b);
      set({ bounds: b, ready: true, ...(saved ?? { wins: defaultWins(b), order: DEFAULT_ORDER }) });
    },
    setBounds: (b) => {
      // A refit to a new screen size is not a user choice: do not overwrite the saved layout with it.
      refitting = true;
      set((s) => ({
        bounds: b,
        wins: Object.fromEntries(WINDOW_IDS.map((id) => [id, fit(id, s.wins[id], b)])) as Record<WindowId, WinState>,
      }));
      refitting = false;
    },
    setRect: (id, r) => {
      const b = get().bounds;
      patch(id, { rect: b ? fitRect(id, r, b) : r, maximized: false, prev: null });
    },
    focus: (id) => {
      const o = get().order;
      if (o[o.length - 1] !== id) set({ order: front(o, id) });
    },
    minimize: (id) => patch(id, { minimized: true }),
    restore: (id) => {
      patch(id, { minimized: false, open: true });
      get().focus(id);
    },
    toggleMaximize: (id) => {
      const { wins, bounds } = get();
      const w = wins[id];
      if (!bounds) return;
      if (w.maximized) patch(id, { maximized: false, rect: fitRect(id, w.prev ?? w.rect, bounds), prev: null });
      else patch(id, { maximized: true, prev: w.rect, rect: maxRect(id, bounds), minimized: false });
      get().focus(id);
    },
    setOpen: (id, open) => {
      patch(id, { open, ...(open ? { minimized: false } : {}) });
      if (open) get().focus(id);
    },
    setActive: (id, on) => {
      const was = !!get().active[id];
      if (was === on) return;
      set((s) => ({ active: { ...s.active, [id]: on } }));
      // Content opened from elsewhere (a rail tab, a button) must be visible: un-minimise and raise it.
      if (on) {
        patch(id, { minimized: false });
        get().focus(id);
      }
    },
    reset: () => {
      try {
        window.localStorage.removeItem(LAYOUT_KEY);
      } catch {
        /* storage unavailable: defaults still apply for this session */
      }
      const b = get().bounds;
      if (b) set({ wins: defaultWins(b), order: DEFAULT_ORDER });
      skipNextSave = true;
    },
  };
});

/* ---------- saving: debounced, plus flush on pointerup / beforeunload ---------- */

let timer: ReturnType<typeof setTimeout> | undefined;
let skipNextSave = false;
let refitting = false;

export function flushLayout() {
  clearTimeout(timer);
  timer = undefined;
  const s = useWindowManager.getState();
  if (!s.ready || !s.bounds) return;
  if (skipNextSave) {
    skipNextSave = false;
    return;
  }
  try {
    window.localStorage.setItem(LAYOUT_KEY, serializeLayout(s, s.bounds));
  } catch {
    /* quota or privacy mode: layout simply is not remembered */
  }
}

if (typeof window !== "undefined") {
  useWindowManager.subscribe((s, p) => {
    if (refitting || !s.ready || (s.wins === p.wins && s.order === p.order)) return;
    clearTimeout(timer);
    timer = setTimeout(flushLayout, 150);
  });
  window.addEventListener("beforeunload", flushLayout);
}
