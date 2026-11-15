# Farm view rebuild — test plan (Phase 1, Kevin / Tester)

Status: PLAN + stubs only. All stubs are `test.fixme` (nothing runs yet). Source of truth: hive/farm-view/SHARED-SPEC.md.

## Findings to resolve (before Phase 2)
1. **Playwright is not installed** (no `@playwright/test`, no browsers). Needs `pnpm add -D @playwright/test` + `pnpm exec playwright install chromium` and a `test:e2e` script. Those touch package.json (not mine); Oscar/god to approve. Until then stubs carry `// @ts-nocheck` so `tsc` (which includes `**/*.ts`) stays green.
2. **Spec vs Image 2 conflict.** Image 2 (shot-3) shows the Soil moisture card open *and* Twin answering at once; the spec says opening Twin closes all cards/popovers. Plan follows the spec (rule) for behaviour; the screenshot "Soil moisture + Twin answering" will show the card closed unless god rules otherwise.
3. **Image mapping.** shot-1 = Image 1 (all minimized). shot-3 = Image 2 (Soil moisture, report, moisture card, Twin). shot-2 = Crop vigor + vigor card + report (the "third" state, matches the Crop vigor screenshot in DONE WHEN).
4. **Test hooks needed from coder:** `data-testid`s listed in `helpers.ts`; sound spy `window.__soundLog` (`{name,t}`) written by `lib/ui/sound.ts` when `NEXT_PUBLIC_E2E=1` (spec asks to spy on sound.ts; module-level spying isn't possible from the browser); a way to read field centroids/camera (e.g. `window.__farmView`) for click and fly-to checks. Route for the farm view is currently the globe dive (`/#farm=…`); no `/explore` page exists.
5. Ambiguities, tested as I read them: "week" boundary (day-of-year ÷ 7) — TODO(verify) with Oscar; `tick`/`tick-month` sound names.

## Plan (one row per rule). Type: E2E = Playwright, U = vitest unit, M = manual/visual.

| # | Rule (spec section) | Type | Stub |
|---|---|---|---|
| L1 | Cesium map fills screen, draggable/zoomable where no panel covers | E2E | layers-layout |
| L2 | No dark gradient scrims; text-shadow value | E2E | layers-layout |
| L3 | Top-left: Globe link, name Newsreader 36, subtitle text | E2E | layers-layout |
| L4 | Top-right bar: 3 options + reset icon, active light fill | E2E | layers-layout |
| L5 | Condition pills row (4 values), right-aligned, always visible | E2E | layers-layout |
| L6 | Field report 380 px; header, summary, 5 rows exact | E2E | layers-layout |
| L7 | Status = shape + text (diamond/dot) | E2E | layers-layout |
| L8 | Collapse to 40 px vertical tab and back | E2E | layers-layout |
| L9 | Timeline bottom with July 46 + "14 · Summer · week 28" | E2E | timeline |
| L10 | Twin button 60 px, logo only | E2E | twin |
| L11 | Fixed layout, no resize at 1280x720 / 1440x900 | E2E | layers-layout |
| P1 | Pill opens card under row, 332 px | E2E | popups |
| P2 | Only one card; opening another closes first | E2E | popups |
| P3 | Open card's pill hidden; "–" folds to pill | E2E | popups |
| P4 | Empty map click / Esc closes | E2E | popups |
| P5 | 4 card contents (rainfall, moisture, vigor, heat 2x2 numbers) + "Sample data" | E2E+U | popups, sample.test |
| P6 | Field popover at click point with 5 fields' data; mutual exclusion with cards | E2E | popups |
| P7 | Opening Twin closes cards/popover | E2E | popups |
| P8 | Never cover the clicked field | E2E | popups |
| P9 | Open from cursor: transform-origin, 200/160 ms, ease, never scale(0) | E2E | popups |
| M1 | Satellite: no overlays | E2E | layers-layout |
| M2 | Vigor: fill scale #F2E8A6→#2C6A38, opacity .5, tags, legend | E2E+U | layers-layout, lut unit |
| M3 | Moisture: scale #E1ECF7→#1C5AA3, dashed #BE8426 under 50 %, legend | E2E+U | layers-layout |
| M4 | Polygons clamped Cesium entities; APPROXIMATE placeholders flagged | U/grep | layers-layout |
| M5 | Layer switch cross-fade 200 ms + tick | E2E | layers-layout, sound |
| T1 | Twin morph: pill 460 px centred, placeholder, autofocus, gold send | E2E | twin |
| T2 | Answer card above pill, same width; question bubble, streamed answer, caret | E2E | twin |
| T3 | Chips: Show on map (layer + fly-to + success), Why not main block | E2E | twin |
| T4 | Thinking: spinning sparkle + status text | E2E | twin |
| T5 | Close via ✕ / Esc / logo reverses morph | E2E | twin |
| T6 | Copy rules (no filler, no emoji, real numbers); mock file has API TODO | E2E+U | twin |
| TL1 | Look: ticks, labels Jan–Dec, brighter filled part, 16 px handle | E2E+M | timeline |
| TL2 | Drag 1:1, setPointerCapture, grab/grabbing, scale 1.15 | E2E | timeline |
| TL3 | Release snaps to nearest day (spring 500/38) | E2E+U | timeline, timeline hook unit |
| TL4 | Flick inertia then snap to week; month pull-in ±6 px | E2E+U | timeline |
| TL5 | Keyboard: ←/→, Shift, PgUp/PgDn, Home/End; each ticks; slider role + aria-valuetext | E2E | timeline |
| TL6 | Track click glides 250 ms with ticks | E2E | timeline |
| TL7 | Date change updates label, cards, layer colours; rAF-throttle, 150 ms debounce | E2E+U | timeline |
| TL8 | Haptics 8 / 16 / [10,30,10], feature-detected | E2E | timeline |
| S1 | One AudioContext, unlocked on first pointerdown | E2E+U | sound |
| S2 | Sounds: tick, tap, pop, soft close, success, called at right events | E2E | sound |
| S3 | Synth params (2 ms noise, 3–4 kHz BP, gain .06/.12, ≤1 per 35 ms) | U | lib/ui/sound.test.ts (Oscar is writing) |
| S4 | Mute toggle persisted, localStorage in try/catch | E2E+U | sound |
| F1 | Press scale .95, 100 ms, on every button incl. inert ones, tap sound | E2E | layers-layout, sound |
| F2 | Success ring 1→1.6, .5→0, 350 ms + success sound | E2E | twin, sound |
| F3 | Closing 20 % faster; stagger 30 ms; icon swap blur/scale | E2E | popups |
| F4 | Reduced motion: opacity only, timeline snaps instantly, sounds follow mute | E2E | reduced-motion |
| ST1 | Tokens: fonts, ink, glass, accent usage, radii, tabular-nums | E2E | layers-layout |
| ST2 | Icon-only buttons have aria-label; contrast ≥ 4.5:1 | E2E (axe) | layers-layout |
| H1 | Honesty: "Sample data" everywhere, numbers in sample.ts, no yield/profit | E2E+U | layers-layout |
| D1 | Screenshots 1440x900 + 1280x720: minimized, vigor, moisture+Twin | E2E | screenshots (→ docs/farm-view/shots/) |

Every DONE-WHEN item is covered: Images reproduced + all states reachable (L*, M*, P*, T*), timeline ticks/snaps + button press/sound (TL*, S*, F1), single pop-up + draggable map (P2, L1), screenshots (D1).

## Files
`apps/web/e2e/farm-view/`: playwright.config.ts, helpers.ts, popups.spec.ts, timeline.spec.ts, reduced-motion.spec.ts, sound.spec.ts, twin.spec.ts, layers-layout.spec.ts, screenshots.spec.ts. Run order rule: one run at a time (`workers: 1`).
