// Farm view design tokens. Source of truth for values: docs/farm-view/design-spec.md
// (measured from hive/farm-view/images shot-1..3 at 1440x900; spec = hive/farm-view/SHARED-SPEC.md).
// Owner: designer. Coder imports these; do not hard-code the same numbers in components.

/* ---------- colour ---------- */
export const color = {
  ink: "#F2EBDD",
  inkSecondary: "#C9BFAE",
  inkMuted: "#A39985", // NOT for text: 3.4:1 on glass over bright imagery. Dots, ticks, dividers only.
  accent: "#E2B866", // send button + sparkle only (see spec §A1 for the handle)
  accentInk: "#2A2117", // arrow on the gold send button
  water: "#4A8CD6",
  stress: "#BE8426", // dry/stress: diamonds, dashed outlines, 50% line
  neutralDot: "#A39985", // grey status dot
  glass: "rgba(27,22,18,0.80)",
  glassBorder: "rgba(242,235,221,0.12)",
  hairline: "rgba(242,235,221,0.08)", // table row rules, chart grid
  fillActive: "rgba(242,235,221,0.16)", // active layer segment, hover-on-glass is 0.08
  fillHover: "rgba(242,235,221,0.08)",
  fillPressed: "rgba(242,235,221,0.12)",
  bubble: "rgba(242,235,221,0.08)", // question bubble + chips
  bubbleBorder: "rgba(242,235,221,0.14)",
  trackPast: "#F2EBDD",
  trackFuture: "rgba(242,235,221,0.35)",
  tick: "rgba(242,235,221,0.55)",
  focusRing: "rgba(242,235,221,0.70)",
  successRing: "#FFFFFF",
} as const;

export const shadow = {
  glass: "0 8px 24px rgba(0,0,0,0.28), 0 1px 2px rgba(0,0,0,0.20)",
  handleHalo: "0 0 0 6px rgba(242,235,221,0.18), 0 1px 3px rgba(0,0,0,0.35)",
  handleHaloHeld: "0 0 0 9px rgba(242,235,221,0.22), 0 1px 3px rgba(0,0,0,0.35)",
  textOnMap: "0 1px 2px rgba(0,0,0,.55), 0 0 18px rgba(0,0,0,.45)",
} as const;

export const blur = { glass: 16 } as const; // backdrop-filter: blur(16px)

/* ---------- map layer scales ---------- */
export const layerScale = {
  vigor: { from: "#F2E8A6", to: "#2C6A38", min: 0.4, max: 0.8, fillOpacity: 0.5, outlineWidth: 2 },
  moisture: { from: "#E1ECF7", to: "#1C5AA3", min: 30, max: 60, fillOpacity: 0.5, outlineWidth: 2, stressLine: 50, stressDash: [8, 6] as const },
} as const;
export type LayerId = "satellite" | "vigor" | "moisture";

/* ---------- type ---------- */
// Families are CSS variables set by next/font (Newsreader, Geist) on the farm-view root.
export const font = {
  display: "var(--fv-font-display), Georgia, serif", // Newsreader: titles + dates only
  sans: "var(--fv-font-sans), ui-sans-serif, system-ui, sans-serif", // Geist: everything else
  mono: "var(--font-mono)", // keyboard hints only
} as const;

// size / lineHeight in px, weight numeric. All numbers use font-variant-numeric: tabular-nums.
export const type = {
  farmTitle: { family: "display", size: 36, lineHeight: 44, weight: 400 },
  monthLabel: { family: "display", size: 46, lineHeight: 52, weight: 400 },
  reportTitle: { family: "display", size: 22, lineHeight: 28, weight: 400 },
  backLink: { family: "sans", size: 13, lineHeight: 16, weight: 400 },
  subtitle: { family: "sans", size: 13, lineHeight: 18, weight: 400 },
  dateMeta: { family: "sans", size: 14, lineHeight: 18, weight: 400 },
  segment: { family: "sans", size: 13, lineHeight: 16, weight: 500 },
  pillLabel: { family: "sans", size: 13, lineHeight: 16, weight: 400 },
  pillValue: { family: "sans", size: 13, lineHeight: 16, weight: 600 },
  cardTitle: { family: "sans", size: 14, lineHeight: 18, weight: 500 },
  cardBig: { family: "sans", size: 26, lineHeight: 30, weight: 500 },
  cardUnit: { family: "sans", size: 13, lineHeight: 18, weight: 400 },
  body: { family: "sans", size: 13, lineHeight: 18, weight: 400 },
  tableHead: { family: "sans", size: 11, lineHeight: 14, weight: 400 },
  tableCell: { family: "sans", size: 13, lineHeight: 16, weight: 400 },
  tableName: { family: "sans", size: 13, lineHeight: 16, weight: 500 },
  axis: { family: "sans", size: 10, lineHeight: 12, weight: 400 },
  caption: { family: "sans", size: 11, lineHeight: 14, weight: 400 }, // "Sample data", legend notes
  fieldTag: { family: "sans", size: 12, lineHeight: 16, weight: 400 },
  fieldTagValue: { family: "sans", size: 12, lineHeight: 16, weight: 600 },
  monthTick: { family: "sans", size: 12, lineHeight: 16, weight: 400 },
  twinLabel: { family: "sans", size: 12, lineHeight: 16, weight: 400 },
  twinAnswer: { family: "sans", size: 15, lineHeight: 21, weight: 400 },
  twinBubble: { family: "sans", size: 13, lineHeight: 18, weight: 400 },
  twinChip: { family: "sans", size: 12, lineHeight: 16, weight: 400 },
  twinInput: { family: "sans", size: 16, lineHeight: 20, weight: 400 },
} as const;

/* ---------- shape ---------- */
export const radius = {
  card: 16,
  pill: 9999,
  segment: 9999,
  tab: 12, // collapsed report tab, right corners only
  bubble: 12,
  chip: 10,
  swatch: 2,
  legendBar: 9999,
} as const;

export const iconStroke = 1.6; // one family, round caps + joins

/* ---------- layout at 1440x900 (anchor edges; panels never resize) ---------- */
export const layout = {
  edge: 40, // left/right gutter for every edge-anchored panel
  title: { left: 40, top: 28 },
  layerBar: { right: 40, top: 32, height: 40, pad: 4, segHeight: 32, segPadX: 14, resetSize: 32 },
  pillRow: { right: 40, top: 86, height: 36, gap: 8, padL: 14, padR: 16, icon: 14, iconGap: 8, valueGap: 8 },
  card: { right: 40, top: 134, width: 332, pad: 18, chartHeight: 66 },
  report: { left: 40, bottom: 186, width: 380, padX: 16, padTop: 14, padBottom: 12, rowHeight: 30 },
  reportTab: { left: 0, bottom: 220, width: 40, height: 160 },
  legend: { right: 40, bottom: 172, width: 248, pad: 14, barHeight: 8 },
  twinButton: { size: 48, bottom: 108, icon: 21 }, // centred: left 50%, translateX(-50%); 60/26 in the shots, shrunk on request
  twinPill: { width: 460, height: 48, bottom: 108, pad: 6, send: 36, icon: 21 },
  twinAnswer: { width: 460, gapAbove: 10, pad: 16, maxHeight: 320 },
  fieldTag: { height: 28, padX: 10, swatch: 10, gap: 6 },
  popover: { width: 220, pad: 14, offset: 12 },
  timeline: { left: 40, right: 40, trackBottom: 66, track: 2, tickHeight: 8, labelGap: 18, handle: 16, hitHeight: 44, dateBaselineAbove: 30 },
  minViewport: { width: 1280, height: 720 },
} as const;

/* ---------- motion ---------- */
export const ease = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  pressOut: "ease-out",
  glide: "cubic-bezier(0.33, 1, 0.68, 1)", // easeOutCubic, matches timeline.ts
} as const;

export const motion = {
  pressScale: 0.95,
  pressMs: 100,
  pressSpring: { stiffness: 600, damping: 30 },
  popEnterMs: 200,
  popExitMs: 160,
  popFromScale: 0.95,
  popFromY: 4,
  layerFadeMs: 200,
  dropdownMs: 200,
  staggerMs: 30,
  iconSwapMs: 150,
  iconSwapBlur: 4,
  iconSwapFromScale: 0.8,
  successMs: 350,
  successScale: 1.6,
  successFromOpacity: 0.5,
  twinMorph: { type: "spring", stiffness: 520, damping: 40, mass: 1 }, // ~170 ms settle
  twinAnswerRiseY: 8,
  sparkleSpinMs: 2400,
  caretBlinkMs: 1000,
  streamWordMs: 45,
  handleHeldScale: 1.15,
  timelineSnapSpring: { stiffness: 500, damping: 38 },
  timelineGlideMs: 250,
  magnetPx: 6,
  dataDebounceMs: 150,
  cameraFlyMs: 1200,
  reportCollapseMs: 220,
} as const;

/* ---------- sound (gains must match lib/ui/sound.ts) ---------- */
export const sound = {
  tickWeek: { gain: 0.06, bandHz: 3500 },
  tickMonth: { gain: 0.12, bandHz: 3000, pitchDrop: 0.7 },
  tap: { gain: 0.04, bandHz: 3800 },
  pop: { gain: 0.07, fromHz: 220, toHz: 120, ms: 60 },
  close: { gain: 0.04, fromHz: 180, toHz: 100, ms: 60 },
  success: { gain: 0.03, notesHz: [660, 880] as const, gapMs: 80 },
  minTickGapMs: 35,
} as const;

export const haptic = { week: 8, month: 16, season: [10, 30, 10] as const } as const;

export const zIndex = { map: 0, mapTags: 10, chrome: 20, report: 30, cards: 40, popover: 45, twin: 50, toast: 60 } as const;
