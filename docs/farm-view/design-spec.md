# Farm view: design build spec (Phase 1, designer)

Owner: Phyllis (designer). Builder: Oscar. QA: Kevin.
Inputs: `hive/farm-view/SHARED-SPEC.md` (binding behaviour), `hive/farm-view/images/shot-1..3.png` (binding visuals).
Tokens: `apps/web/lib/farm-view/tokens.ts`. Every value below has a token; import it, don't retype it.
Rule of precedence: images win on visuals, spec wins on behaviour. Section A lists every place they disagree and what to build.

## 0. Reference shots

| File | Which | State shown |
|---|---|---|
| `shot-1.png` | **Image 1** | Everything minimized: Satellite on, report collapsed to tab, no card, Twin closed. |
| `shot-3.png` | **Image 2** | Soil moisture on, Field report open, Soil moisture card open, Twin answering. |
| `shot-2.png` | Third (extra) | Crop vigor on, report open, Crop vigor card open, Twin closed. Use as the Crop vigor reference. |

Measuring: each PNG is 1384x872 with a 6 px dark frame; the viewport is 1378x862. CSS px at 1440x900 = (image px − 6) × 1.045. Check: the Field report measures 363 image px → 379 css (spec: 380).

## 1. Global

- Root: `position: fixed; inset: 0`. The Cesium canvas fills it. Every overlay is `position: absolute` and anchored to the edge named below. **Panels never resize.** At narrower viewports they keep size and position from their anchor edge, and the map shows less. Minimum supported viewport is 1280x720; at that size the layout must still not overlap (section 9).
- Overlay container `pointer-events: none`. Each panel, pill, tag and button sets `pointer-events: auto`. That keeps the map draggable everywhere it's visible.
- No scrims or gradients over the map. Any text sitting directly on the map (title block, date label, month labels) uses `shadow.textOnMap`.
- Glass (every panel, pill, card, tag, button): `background: color.glass; backdrop-filter: blur(16px); border: 1px solid color.glassBorder; box-shadow: shadow.glass`.
- Fonts: load **Newsreader** and **Geist** with `next/font/google` and expose them as `--fv-font-display` and `--fv-font-sans` on the farm-view root. Neither is loaded in the app today (`globals.css` uses system fonts). Newsreader is for the farm title, the "Field report" title and the month label only. Everything else is Geist. Every number is `tabular-nums`.
- Text colour: ink for values and names, inkSecondary for labels and body copy. **inkMuted is never used for text** (3.4:1 on glass over bright imagery, which fails 4.5:1). Captions such as "Sample data" use inkSecondary.
- Icons: one family, 1.6 px stroke, round caps and joins, `currentColor`. Lucide matches (`droplet`, `leaf`, `thermometer`, `rotate-ccw`, `chevron-left/right`, `minus`, `x`, `arrow-up`, `panel-left`). Sizes: 14 in pills, 16 in card headers, 18 in icon buttons.
- Every icon-only button has an `aria-label`. Focus ring: `outline: 2px solid color.focusRing; outline-offset: 2px`, shown with `:focus-visible` only.

## 2. Components (1440x900 positions)

### 2.1 Title block (top left, text on the map, no glass)
- Container: left 40, top 28.
- "‹ Globe" link: `type.backLink`, ink, chevron-left 14 px, 4 px gap. Hit area 28 px tall. Links to the globe. Hover: underline. Press: scale 0.95 + tap.
- Farm name: `type.farmTitle` (Newsreader 36/44), ink, 4 px below the link.
- Subtitle: `type.subtitle`, ink at 0.9, 2 px below. Copy: "Zürich, Switzerland · Explore only: simulation not available for this farm yet."
- All three use `shadow.textOnMap`.

### 2.2 Layer bar (top right)
- Glass pill: right 40, top 32, height 40, padding 4, width hugs its content (≈ 328).
- Segments "Satellite | Crop vigor | Soil moisture": height 32, padding-x 14, `type.segment`, radius pill.
  - rest: inkSecondary text, no fill
  - hover: ink text, `fillHover`
  - pressed: scale 0.95, `fillPressed`
  - active: ink text, `fillActive` fill + 1 px `glassBorder` inner border (the "light fill")
  - loading (layer data not ready): active styling plus a 12 px spinner replacing nothing; the label stays. On load: success ring + success sound.
  - focus-visible: focus ring
- Divider: 1 px × 16, `glassBorder`, 6 px margin on each side.
- Reset view: 32×32 round icon button, rotate-ccw 18, `aria-label="Reset view"`. Rest inkSecondary, hover ink + fillHover.
- `role="radiogroup"` on the bar, `role="radio"` + `aria-checked` on segments. ←/→ move between them.

### 2.3 Condition pills (always visible)
- Row: right 40, top 86, height 36, gap 8, right-aligned, in this order: Rainfall · Soil moisture · Crop vigor · Heat & frost.
- Pill: glass, radius pill, padding-left 14 / right 16, icon 14 (droplet, droplet, leaf, thermometer), 8 gap, label (`pillLabel`, inkSecondary), 8 gap, value (`pillValue`, ink). Values: "64 mm", "41%", "0.48", "9 days".
- States: rest; hover = border to ink at 0.24 + label to ink; pressed = scale 0.95; **open = the pill is removed from the row** (the others close the gap with a 200 ms layout animation, `ease.out`); focus-visible = ring.
- The pill is a `button` with `aria-expanded` and `aria-controls` pointing at its card.

### 2.4 Condition cards (one at a time)
- Glass card: right 40, top 134 (12 below the pills), width 332, padding 18, radius 16. Height is set by content (Soil ≈ 252, Crop vigor ≈ 237).
- Header row, 28 tall: icon 16 inkSecondary, 8 gap, title `cardTitle` ink. Right side: "–" button 28×28, `aria-label="Minimize <name>"`.
- Big number row, 12 below the header: value `cardBig` ink + unit/qualifier `cardUnit` inkSecondary, 8 gap, baseline aligned.
- Description: `body` inkSecondary, 6 below, wraps.
- Chart: 12 below, plot height 66, full card inner width. Y labels `axis` inkSecondary, left of the plot. Month initials row J F M A M J J A S O N D (`axis`) 8 below the plot; the selected month's initial is ink and 600 weight. Gridlines 1 px `hairline`. Crosshair: 1 px vertical line ink at 0.35 at the selected date, plus a 7 px dot on the series (fill = series colour, 1.5 px ink ring).
- Footer: "Sample data" `caption` inkSecondary, 12 below the chart. Required on every card.
- Card contents:
  - **Rainfall**: big "64 mm" + "in July · sample". Monthly 2026 bars (water, 60% opacity; selected month 100%), 30-year normal as a 1.5 px ink horizontal tick per month. Legend row under the chart: swatch "2026", tick "30-yr normal". Copy, data and normals in `lib/farm-view/sample.ts`.
  - **Soil moisture** (Image 2): big "41%" + "of field capacity, farm average". Description "Under the 50% stress line (dashed) since early July." Y labels 25/50/75/100%. Line 1.5 px water. 50% line dashed 1.5 px stress `[4,3]`. Zone below 50%: stress at 0.14 opacity.
  - **Crop vigor** (shot-2): big "0.48" + "NDVI · −0.10 vs 5-yr avg". Description "Browning earlier than the 5-year curve." Y labels 0.4/0.6/0.8. 2026 is solid 1.5 px ink; the 5-yr average is dashed 1.5 px ink at 0.6 `[3,3]`. End labels "2026" and "5-yr avg" in `axis`, at the right end of each line.
  - **Heat & frost**: big "9 days" + "above 30 °C". 2×2 grid instead of a chart (gap 10, each cell has a 12 px `caption` label over a 18 px ink value with a 12 px inkSecondary note): Days above 30 °C **9** (normal 4) · Growing degree days **1,412** (+6%) · First frost median **Oct 14** (92 days away) · Coldest July night **11 °C**.
- States: closed (pill shown); opening (from the cursor, section 5); open; minimizing (exit to the pill's centre); data loading on date change = the numbers and crosshair update in place with no skeleton (sample data is synchronous).

### 2.5 Field report
- **Open**: glass card, left 40, bottom 186 (top 452 at 900 tall), width 380, radius 16, padding 14 top / 16 sides / 12 bottom. Height ≈ 262 from content.
  - Header: "Field report" `reportTitle` (Newsreader 22) ink. Collapse button 28×28 on the right, chevron-left 18, `aria-label="Collapse field report"`, `aria-expanded="true"`.
  - Summary: `body` inkSecondary, 6 below. "4 of 5 fields are under the 50% stress line."
  - Table, 10 below. Header row `tableHead` inkSecondary, 18 tall, bottom border 1 px `hairline`. Columns: Field (left, flex) · Moisture (right-aligned, right edge at x 237) · NDVI (right-aligned, right edge at x 297) · Status (left-aligned, starts at x 312). x is measured from the viewport at 1440.
  - Rows: 30 tall, 1 px `hairline` between rows, none after the last. Name `tableName` ink; numbers `tableCell` ink; status text `tableCell` inkSecondary.
  - Status mark before the text, 6 px gap: **diamond** = 7×7 square rotated 45°, `stress` fill, for Dry/Stressed; **dot** = 6 px circle, `neutralDot`, for Watch/OK. Never colour alone.
  - Rows are clickable: hover `fillHover`, press 0.95 + tap. Click = fly the camera to that field and open its popover.
  - "Sample data" caption row at the bottom, 8 above the padding (not in the images; required by the spec, see A6).
- **Collapsed**: a tab flush to the left edge: left 0, bottom 220, 40×160, radius 0 12 12 0 (no left border). Top to bottom: panel-left icon 16, 12 gap, "Field report" `pillLabel` ink written vertically (`writing-mode: vertical-rl; transform: rotate(180deg)`), 12 gap, chevron-right 14. The whole tab is one button, `aria-label="Expand field report"`, `aria-expanded="false"`. Hover: fillHover. Press: scale 0.95 with `transform-origin: left center`.
- Open ↔ collapsed: the card shrinks into the tab (opacity + scale 0.95 toward the tab, origin left centre), 220 ms `ease.out` open / 176 ms close. Not layout-resizing, so the map never reflows.

### 2.6 Map layer overlays
- Polygons: Cesium entities with `classificationType: BOTH` (clamped to ground), drawn from `lib/farm-view/fields.ts` (APPROXIMATE placeholders, see A8).
- **Satellite**: no overlays, no tags, no legend.
- **Crop vigor**: fill interpolated `#F2E8A6` (0.4) → `#2C6A38` (0.8), clamp outside, `fill-opacity 0.5`; solid 2 px outline in the same colour at 0.9.
- **Soil moisture**: fill interpolated `#E1ECF7` (30%) → `#1C5AA3` (60%), clamp, `fill-opacity 0.5`. Fields under 50%: dashed 2 px `stress` outline (dash 8, gap 6). Fields at 50% or above: solid 2 px outline in the fill colour at 0.9.
- Interpolate in OKLab (or linear RGB if simpler; note which). Updated when the date changes, rAF-throttled.
- **Field tag** (one per field, at the polygon centroid, HTML overlay positioned each frame from the projected centroid): glass pill, height 28, padding-x 10, swatch 10×10 radius 2 in the field's layer colour (1 px ink at 0.3 border), 6 gap, name `fieldTag` ink, 6 gap, value `fieldTagValue` ink ("0.48" or "36%"). Tags are clickable (same as clicking the field). Hidden when the centroid is behind the camera or off-screen. Hidden in Satellite.
- **Legend card** (shown only with a layer on): glass, right 40, bottom 172, width 248, padding 14, radius 16.
  - Title `cardTitle` ink: "Crop vigor, NDVI" or "Soil moisture, % of capacity".
  - Gradient bar 8 tall, radius pill, 10 below the title.
  - Soil moisture: a 2×14 `stress` tick at 50% (two thirds along).
  - End labels `caption` inkSecondary under the bar: "0.4 thin" / "0.8 lush", or "30%" / "60%".
  - Note `caption` inkSecondary, 8 below: Crop vigor "Satellite, 14 Jul · sample data" (date follows the timeline); Soil moisture "Dashed outline: under the 50% stress line".
- Layer switch: the old overlay fades out while the new one fades in, 200 ms linear (`entity.polygon.material` alpha), tags and legend cross-fade in step, plus the tick sound.

### 2.7 Field popover (layer on, click a field or tag)
- Glass card 220 wide, padding 14, radius 16, opens at the click point. Place it 12 px from the click on the side away from the field's centroid, so it never covers the clicked field. Flip inside the viewport with a 16 px margin.
- Contents: name `cardTitle` ink; crop `body` inkSecondary; then two rows "Moisture 36%" and "NDVI 0.48" (label inkSecondary, value ink, right-aligned); status mark + text; "Sample data" caption. Close "✕" 24×24, `aria-label="Close"`.
- Satellite layer: clicking a field does nothing (spec: "With a layer on").

### 2.8 Twin
- **Closed** (Image 1): 60 px round glass button, bottom 108, `left: 50%; translateX(-50%)`. Shows ONLY the logo, 26 px, ink, gold sparkle. `aria-label="Ask Twin"`, `aria-expanded="false"`. Hover: border ink at 0.24. Press: 0.95 + tap.
- **Open** (input pill): 460×60, radius 30, glass, same bottom 108, centred. Padding 8. Left end: the logo at 26 px, centred in a 44 px slot (it is the same element as in the button, `layoutId` shared). Input: `twinInput` ink, placeholder "Ask about this farm" inkSecondary, 12 px left gap, autofocus, `aria-label="Ask about this farm"`. Right end: send button 44 round, `accent` fill, arrow-up 18 in `accentInk`, `aria-label="Send"`. Send disabled (empty input): accent at 0.4, no press, no sound. Enter sends.
- **Thinking**: right after send. Sparkle spins (2.4 s/turn, linear, around the sparkle centre, `transform-box: fill-box`). Status line in the answer card: "Reading soil moisture for 5 fields…" `body` inkSecondary. Input disabled, send shows a 14 px spinner. Duration of the mock: 900 ms.
- **Answering** (Image 2): answer card 460 wide, centred, bottom = 108 + 60 + 10 = 178, padding 16, radius 16, max-height 320 (scrolls inside).
  - "Twin" label `twinLabel` inkSecondary top left; close ✕ 24×24 top right, `aria-label="Close Twin"`.
  - Question bubble right-aligned, 12 below: `twinBubble` ink, padding 8×12, radius 12, `bubble` fill + `bubbleBorder`.
  - Answer, 14 below: `twinAnswer` (15/21) ink, streamed one word per 45 ms with a 2×16 ink caret blinking (1 s) after the last word; caret removed when done.
  - Chips, 12 below, gap 8, appear with a 30 ms stagger after streaming ends: `twinChip` ink, height 28, padding-x 12, radius 10, 1 px `bubbleBorder`, transparent fill; hover fillHover; press 0.95 + tap.
  - "Show on map": switch to Soil moisture, fly the camera to Trial plots (1.2 s), then success ring + success sound on the chip.
  - "Why not the main block?": sends it as the next mocked question (the new Q/A replaces the old one in the card).
- Close (✕, Esc, or clicking the logo): answer card exits (160 ms) and the pill morphs back to the round button.
- Copy and mocks: `lib/farm-view/twin-mock.ts` with `// TODO(api): replace with real Twin endpoint`. Answer first, real numbers, no "Great question", no emoji.

### 2.9 Timeline (bottom, on the map, no glass)
- Track: left 40, right 40 (1360 wide at 1440), the line's centre is 66 px from the bottom. Line 2 px, radius 1. Left of the handle: `trackPast`. Right: `trackFuture`.
- Month ticks: 13 boundaries (Jan 1 … Dec 31 end), 1×8 px, `tick` colour, hanging down from the line.
- Month labels "Jan … Dec": `monthTick` inkSecondary, centred under each month, centre 27 below the line. The selected month is ink, 600 weight.
- Handle: 16 px circle, fill `trackPast` (ink), `shadow.handleHalo`. Held: scale 1.15, `handleHaloHeld`. Hit area: 44 tall across the whole track, cursor `grab`, `grabbing` while held.
- Date label above the track, left 40, baseline 30 above the line: "July" `monthLabel` (Newsreader 46) ink, then 12 gap, "14 · Summer · week 28" `dateMeta` ink at 0.9, same baseline. Both use `shadow.textOnMap`.
- `role="slider"`, `aria-valuemin=1`, `aria-valuemax=365`, `aria-valuenow`=day of year, `aria-valuetext`="14 July".
- Behaviour is in `lib/farm-view/timeline.ts` (Oscar) and the spec; motion values below.

## 3. States matrix

| Component | rest | hover | pressed | open / active | closed | disabled | loading |
|---|---|---|---|---|---|---|---|
| Back link | ink | underline | 0.95 + tap | – | – | – | – |
| Layer segment | inkSecondary | ink + fillHover | 0.95 + fillPressed | ink + fillActive + border | – | – | active + 12 px spinner |
| Reset view | inkSecondary | ink + fillHover | 0.95 | – | – | while flying, opacity 0.5 | – |
| Condition pill | label inkSecondary, value ink | border 0.24, label ink | 0.95 | hidden (card shown) | shown | – | – |
| Card "–" | inkSecondary | ink + fillHover | 0.95 | – | – | – | – |
| Report collapse / tab | inkSecondary / ink | fillHover | 0.95 | card | 40 px tab | – | – |
| Report row | – | fillHover | 0.95 | row tinted fillActive while its popover is open | – | – | – |
| Field tag | glass | border 0.24 | 0.95 | border ink 0.5 while its popover is open | – | – | – |
| Twin button | logo ink | border 0.24 | 0.95 | morphs to pill | round | – | sparkle spins |
| Send | accent | brightness 1.06 | 0.95 | – | – | accent 0.4, no sound | 14 px spinner |
| Chip | border only | fillHover | 0.95 | – | – | – | – |
| Timeline handle | 16 px + halo | cursor grab | 1.15 + larger halo | – | – | – | – |

Every pressable plays `tap` on press, including buttons that do nothing yet. Reduced motion: no scale, the state colour change still applies.

## 4. One-at-a-time rule
One "pop-up slot" in the store: `null | {kind:'card', id} | {kind:'popover', fieldId} | {kind:'twin'}`. Opening anything closes the current one first: its exit (160 ms) and the new enter (200 ms) run at the same time; don't wait for the exit to finish. Esc and clicking empty map close the slot. The Field report and legend are not in the slot; they stay open. Twin open closes cards/popovers; opening a card closes Twin (back to the round button).

## 5. Motion table

| Element | Trigger | Property | From → to | Duration | Easing | Origin |
|---|---|---|---|---|---|---|
| Any button / pressable | pointerdown | scale | 1 → 0.95 | 100 ms | ease-out | centre |
| Any button / pressable | pointerup / leave | scale | 0.95 → 1 | spring 600/30 | spring | centre |
| Condition card | open (pill click) | opacity, scale, translateY | 0→1, 0.95→1, 4→0 px | 200 ms | `ease.out` | the click point relative to the card |
| Condition card | close (–, Esc, map, other open) | opacity, scale, translateY | 1→0, 1→0.95, 0→4 px | 160 ms | `ease.out` | the same origin as it opened from (for "–": the pill's centre) |
| Pill row | card opens/closes | layout (x) | gap closes / reopens | 200 ms | `ease.out` | – |
| Field popover | field click | opacity, scale, translateY | 0→1, 0.95→1, 4→0 | 200 ms | `ease.out` | the click point |
| Field popover | close | reverse | – | 160 ms | `ease.out` | the click point |
| Field report | collapse | opacity, scale | 1→0, 1→0.95 | 176 ms | `ease.out` | left centre (toward the tab) |
| Field report | expand | opacity, scale | 0→1, 0.95→1 | 220 ms | `ease.out` | left centre |
| Report tab | report collapses / expands | opacity, translateX | 0→1, −8→0 px (reverse on hide) | 150 ms | `ease.out` | – |
| Map overlay | layer switch | polygon alpha | old 0.5→0, new 0→0.5 | 200 ms | linear | – |
| Field tags, legend | layer switch | opacity | cross-fade | 200 ms | linear | – |
| Field tags | layer on | opacity, translateY | stagger 30 ms per tag, 0→1, 4→0 | 200 ms | `ease.out` | – |
| Twin button → pill | logo click | width, height, radius (shared layout) | 60×60 r30 → 460×60 r30 | spring 520/40 (~170 ms) | spring | from the button, stays centred |
| Twin input + send | pill open | opacity | 0 → 1, 60 ms delay | 120 ms | `ease.out` | – |
| Twin pill → button | ✕, Esc, logo | reverse morph | – | spring, input fades out in 80 ms first | spring | – |
| Twin answer card | send | opacity, scale, translateY | 0→1, 0.95→1, 8→0 | 200 ms | `ease.out` | bottom centre (rises out of the pill) |
| Twin answer card | close | reverse | – | 160 ms | `ease.out` | bottom centre |
| Sparkle | thinking | rotate | 0 → 360° loop | 2.4 s | linear | sparkle centre |
| Caret | streaming | opacity | 1 ↔ 0 | 1 s steps | step | – |
| Chips | answer done | opacity, translateY | stagger 30 ms, 0→1, 4→0 | 200 ms | `ease.out` | – |
| Success ring | send, layer loaded, Show on map done | ring scale, opacity | 1→1.6, 0.5→0 | 350 ms | ease-out | button centre |
| Icon swap (e.g. send → spinner, chevron) | state change | opacity, blur, scale | 0→1, 4px→0, 0.8→1 | 150 ms | `ease.out` | centre |
| Timeline handle | pointerdown / up | scale | 1 ↔ 1.15 | spring 500/38 | spring | centre |
| Timeline handle | release between days | x | → nearest day | spring 500/38 | spring | – |
| Timeline handle | flick ≥ 500 px/s | x | coast (friction 4/s) → nearest week | – | spring | – |
| Timeline handle | within 6 px of a month line | x | pulled onto the line | – | – | – |
| Timeline handle | track click | x | → click | 250 ms | easeOutCubic | – |
| Camera | Show on map, report row, reset | flyTo | – | 1.2 s | Cesium default | – |

Never animate from scale(0). Close is always 20% faster than open.
**prefers-reduced-motion**: opacity only (same durations), no scale, translate, blur or springs; the Twin morph becomes a cross-fade; the timeline snaps instantly with no coast; the sparkle doesn't spin (the status text carries "thinking"). Sounds still follow the mute toggle.

## 6. Sound table (`lib/ui/sound.ts`, values already match `tokens.sound`)

| Event | Sound | Gain | Notes |
|---|---|---|---|
| Timeline crosses a week | `tickWeek` | 0.06 | ~2 ms noise, band-pass 3.5 kHz |
| Timeline crosses a month boundary | `tickMonth` | 0.12 | band-pass 3 kHz, pitch drop ×0.7 (wins over week if both) |
| Keyboard step on the timeline | `tickWeek` / `tickMonth` | as above | every step ticks |
| Track click glide | `tickWeek` / `tickMonth` per crossing | as above | max one per 35 ms |
| Layer switch | `tickWeek` | 0.06 | |
| Condition pill opens its card | `tickWeek` | 0.06 | spec: "tick (… pill)" |
| Any button press | `tap` | 0.04 | on pointerdown, includes dead buttons |
| Twin open | `pop` | 0.07 | sine 220→120 Hz, 60 ms |
| Twin close, card close, popover close, report collapse | `close` | 0.04 | quieter than open |
| Message sent, layer loaded, Show on map done | `success` | 0.03 ×2 | 660 then 880 Hz, 80 ms apart |

One AudioContext, unlocked on the first pointerdown. Mute toggle: a 32×32 icon button (volume-2 / volume-x, icon swap) placed in the layer bar after the reset button, `aria-label="Mute sounds"` / "Unmute sounds" (see A7).
Haptics: `navigator.vibrate` 8 per week, 16 per month, `[10,30,10]` at a season change, feature-detected.

## 7. Copy (exact)
- "‹ Globe" · "Zürich, Switzerland · Explore only: simulation not available for this farm yet."
- Layers: "Satellite", "Crop vigor", "Soil moisture". Pills: "Rainfall 64 mm", "Soil moisture 41%", "Crop vigor 0.48", "Heat & frost 9 days".
- Report: "Field report", "4 of 5 fields are under the 50% stress line.", headers "Field / Moisture / NDVI / Status".
- Twin: "Ask about this farm", "Twin", "Reading soil moisture for 5 fields…", chips "Show on map", "Why not the main block?".
- "Sample data" on every card, the report and the popover. Numbers live in `lib/farm-view/sample.ts`.

## 8. Accessibility
- Text contrast checked on glass over white (worst case): ink 8.0:1, inkSecondary 5.3:1, inkMuted 3.4:1 (hence: no muted text). Arrow on gold: 8.5:1.
- Status uses shape + text. Charts have an `aria-label` summary ("Soil moisture 2026, 41% in July, under the 50% stress line").
- Keyboard: Tab order = back link → layers → reset → mute → pills → report → timeline → Twin. Esc closes the slot. Focus returns to the opener on close (card → its pill, Twin → the button).

## 9. 1280x720 check
Top: title, layer bar, pills, card (top 134, ≈ 252 tall → bottom 386). Bottom, anchored from the bottom edge: timeline (date label top ≈ 720 − 148 = 572), Twin (top 720 − 168 = 552), answer card bottom 178 (top ≈ 360), legend bottom 172 (top ≈ 445), report bottom 186 (top ≈ 272). The report (x 40–420) and the card (x 908–1240 at 1280) don't share x, so nothing overlaps. Answer card (x 410–870 at 1280, y ≈ 360–542) overlaps the open report (x 40–420, y 272–534) by 10 px of width. Decision: the Twin layer is above the report in z-order and the overlap is accepted (it only happens below ~1300 px wide). At 1440 there is 70 px clear.

## A. Images vs spec: disagreements and decisions

| # | Topic | Image | Spec | Build |
|---|---|---|---|---|
| A1 | Timeline handle colour | Ink/cream `#F1EBDE` with a soft white halo | Accent `#E2B866` reserved "for the timeline handle" | **Ink** (images win on visuals). Accent is used only on send + sparkle. God to confirm. |
| A2 | Twin pill position | Left edge at the button's left edge (x 690–1149), growing right | Centred, `left:50%; translateX(-50%)` | **Centred** (spec is explicit and numeric; it's layout behaviour). Answer card centred too. |
| A3 | Answer chips radius | ≈ 10 px rounded rectangles | "pills fully round" | **10 px** (chips aren't pills in the spec's list). |
| A4 | Card charts after the selected date | 2026 lines continue to Nov | Honesty: sample data, not a forecast | **End the 2026 line at the selected date**; months after it show only the 5-yr avg / normals. |
| A5 | Open card's pill | In both shots the pill of the open card is gone from the row | Same ("the open card's pill hides") | Agree. |
| A6 | "Sample data" on the Field report | Not shown | "show 'Sample data' on every card" | **Add it** to the report and the popover. |
| A7 | Mute toggle | Not shown | Required, persisted | **In the layer bar** after reset. My placement; no image reference. |
| A8 | Field polygons | Drawn on real field edges | Use lib/farms polygons, else APPROXIMATE placeholders | No polygons exist for this farm. `lib/farm-view/fields.ts` with placeholders, a code comment saying APPROXIMATE, and the popover says "Approximate outline". |
| A9 | Field report position | Over fields at the top (top 452) | "over the farm buildings, not over fields" | Bottom-anchored (bottom 186) matches the image at 900 tall. Whether it covers fields depends on the camera; set the initial camera so the farmyard sits under it. |
| A10 | Newsreader / Geist | Shown | Required | Not loaded today. Add via `next/font/google` (fetched at build time, self-hosted after; works with `OFFLINE=1` at runtime). |
