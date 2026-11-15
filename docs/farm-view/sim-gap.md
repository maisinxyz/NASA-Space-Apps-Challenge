# Simulation farms on the new FarmView: gap list + "Simulation" tab spec

Owner: Phyllis (design/tech lead). Builder: Oscar. Decision: D5 (hive/farm-view/DECISIONS.md).
Today `GlobeHome.tsx` (~line 728) renders `TwinPanel` when `inTwin` and `FarmView` otherwise. Target: **always FarmView**. Old panels stay in the repo as the source of logic/components to reuse; only the `TwinPanel` mount goes.
Tokens: `lib/farm-view/tokens.ts`. Base spec: `docs/farm-view/design-spec.md`.

## 1. Old full-twin feature → new UI

| # | Old feature (file) | New home | Status |
|---|---|---|---|
| 1 | Back to globe (dock) | "‹ Globe" link | Exists |
| 2 | Reset view (dock, key R) | Reset icon in layer bar | Exists. Keep the R key (TourController). |
| 3 | Field list, click = select field (TwinPanel LeftBody) | Field report rows | **Rewire**: rows come from `twin.fields` on sim farms (see §4 Q1). Row click = select field (`twinFieldId`) + fly + popover. |
| 4 | Field card: area (derived), crop A/B (assumed), bare-soil months, cover calendar (Inspector FieldCard) | Field popover (area, crop) + "Details" button → Simulation tab › Field | **Rewire** popover; calendar is MISSING (goes in the tab) |
| 5 | Hover a field → name + crop tooltip (Globe.tsx) | Unchanged (map code) | Exists |
| 6 | Esc closes the inspector | Esc closes the one pop-up slot | Exists in spec |
| 7 | Mode switch Explore / Simulate / Compare / Evidence, keys 1–4 | Explore = FarmView default. The other three = sections of the Simulation tab. Keys: 1 closes the tab, 2/3/4 open it on that section. | MISSING |
| 8 | Scenario picker: 7 scenario cards grouped by family (ScenarioPanel ScenarioCards) | Tab › Scenarios | MISSING |
| 9 | Scenario detail: rotation select, "Real event" (disabled), What-if inputs (slider, −/number/+, per-input reset, Reset inputs), colour key + basis, readouts + basis, wet-spell / trends extras, effect caption, "What a real run needs" | Tab › Scenarios › detail. Reuse `SimulateBody`'s internals restyled. | MISSING |
| 10 | Scenario clock: Play/Pause (Space), step ◀ ▶, time slider + label, speed 1×/2×/4× (ScenarioClock) | Sticky footer of the tab + mini Play/Pause on the collapsed tab pill. **Not** the date timeline: different time axis (hours / months / years). | MISSING |
| 11 | Compare: rotation A/B selects, Swap, year select, split Show A / 50-50 / Show B, "Show crops on map", bare-months calendar, Difference map (disabled) (CompareTray) | Tab › Compare | MISSING |
| 12 | On-map A/B divider handle (DividerHandle) | Stays on the map whenever `twinMode === "compare"`, panel open or not | MISSING (mount it from FarmView) |
| 13 | Rotation ranking: priorities, constraints, results, climate (Fe1Panel via ComparePanel) | Tab › Compare, under the tray controls ("Rank rotations" disclosure) | MISSING |
| 14 | Evidence cards per rotation + evidence note (EvidenceBody) | Tab › Evidence | MISSING |
| 15 | Map surface Photoreal 3D / Terrain only | Tab › Map | MISSING |
| 16 | Height exaggeration 1–3× | Tab › Map | MISSING |
| 17 | Detail High / Medium / Low | Tab › Map | MISSING |
| 18 | Look filter (true colour / thermal / vegetation / night) | Tab › Map | MISSING |
| 19 | NASA layers "coming soon" (disabled) | Dropped: the layer bar is the layers UI now. | Drop (no feature lost) |
| 20 | Share link (dock) | Tab header, link icon button | MISSING |
| 21 | Hide panels (dock, key H) | Key H hides all FarmView chrome except the title + honesty line; also a button in Tab › Map | MISSING |
| 22 | Field outline labels + attribution chips, always visible (TwinPanel top centre) | Small caption line under the subtitle | MISSING (must keep: attribution) |
| 23 | "Loading 3D detail…" status (`pending > 0`) | Same caption line, `role="status"` | MISSING |
| 24 | Explore info: owner, field count, model area note (`simAreaLabel`) | Tab › Map, "About this twin" block | MISSING |
| 25 | "This tool supports, and does not replace, local agronomic expertise." (GlobeHome, bottom centre) | Moves: its current spot (bottom 48, centred) collides with the Twin button and timeline. Put it under the title block (caption line 2). | **Move** |
| 26 | "Synthetic demo data" badge + note (fixture runs) | Tab header + collapsed pill whenever a fixture scenario is on the map | MISSING (must keep) |

## 2. "Simulation" tab spec

**Shown only on sim farms** (`inTwin`). Explore-only farms keep today's FarmView unchanged.

### Collapsed (default)
- Glass pill button at **left 40**, top = 12 below the title block including its caption lines (≈ 132 without them; see Q2). Height 36, padding-x 14, radius pill, `pillLabel` type.
- Content: icon (sliders, 14) · "Simulation" · chevron-right 14. `aria-label="Open simulation"`, `aria-expanded="false"`, `data-testid="sim-tab"`.
- When a scenario is on the map: label becomes the scenario name, plus a 28 px round Play/Pause icon button (`aria-label` "Play scenario" / "Pause scenario") and, for fixture runs, a "Synthetic demo data" chip (amber outline, `caption` type). When `twinMode === "compare"`: label "Comparing A / B".
- Press, tap sound, focus ring: as every FvButton.

### Open
- Glass card, **left 40, top = the pill's top, width 360, bottom 186** (fills the Field report's column; 582 tall at 900, 402 at 720). Radius 16, padding 16, content scrolls inside (`overflow-y: auto`, `overscroll-behavior: contain`).
- **Opening it collapses the Field report to its tab; closing it restores the report's previous state.** (They share the left column.)
- It is part of the **one-pop-up slot**: `{kind:'sim', section}`. Opening it closes any card, popover or Twin; opening any of those closes it. Esc and clicking empty map close it. Closing never stops a run or leaves Compare: the map keeps the scenario / split; the collapsed pill shows it.
- Motion: opens from the cursor like cards (200 ms enter / 160 ms exit, `ease.out`, origin = click point); sound `pop` on open, `close` on close.
- Header (sticky, 40 tall): "Simulation" in `reportTitle` (Newsreader 22), right side: Share icon button (link, `aria-label="Copy share link"`, success ring + success sound on copy, inline status "Link copied" / "Link is in the address bar" for 4 s, `aria-live="polite"`), close button (chevron-left, `aria-label="Close simulation"`).
- Fixture runs: under the header, the "Synthetic demo data" chip + `SYNTHETIC_NOTE`, always visible while `runSource === "fixture"`.
- Section switch (segmented, same look as the layer bar, height 32): **Scenarios · Compare · Evidence · Map**. Choosing Scenarios/Compare/Evidence calls the existing `setMode("simulate" | "compare" | "evidence")`. Map does not change mode. `role="tablist"`. Keys 2/3/4 open the tab on Scenarios/Compare/Evidence; 1 closes it and `setMode("explore")`.
- **Scenarios**: the 7 scenario cards by family (one row each: glyph, label, summary, time + output chips), stagger 30 ms. Detail view replaces the list (back link "‹ All scenarios"): plain meaning, duration, `EMPTY_RUN_MESSAGE` when `runSource === "none"`, Rotation select (rotation-dependent only), Real event select (disabled, keep copy), What-if inputs (keep slider + −/number/+ + reset, all with BasisChip), Colour key + BasisChip, Readouts with units + BasisChip, ScenarioExtras, effect caption, "What a real run needs" disclosure. A "Show on map" button sets layer to Satellite (see rule below), success ring.
- **Scenario clock**: sticky footer of the Scenarios section when a scenario is chosen: Play/Pause (Space when focused), ◀ ▶ step, slider + label, speed 1×/2×/4×. Reuse `ScenarioClock` logic; restyle with tokens. Same disabled state and reduced-motion rule (no autoplay) as today.
- **Compare**: rotation A select, B select, Swap, year select, split segmented Show A / 50·50 / Show B, "Show crops on map" switch + its note, Difference map (disabled + note), bare-months calendar; then a disclosure "Rank rotations" containing `Fe1Panel` unchanged (it may need its own max width check at 328 px inner width; report if it breaks).
- **Evidence**: `EvidenceBody` content (sticky evidence note, one card per rotation, support sentence).
- **Map**: Surface (Photoreal 3D / Terrain only), Height exaggeration slider + "1× = true scale.", Detail (High/Medium/Low) + note, Look select + "Illustrative styling, not sensor data.", Hide panels button (key H), About this twin (owner, field count, model area note).
- Inputs on glass: sliders use `accent-color: color.ink`; selects are glass pills (height 32, `body` type, chevron icon); every control gets the press/tap feedback. No new colours.

### Map layer vs scenario overlay (rule)
Scenario overlays and the Crop vigor / Soil moisture layers can't both paint the fields. Choosing Crop vigor or Soil moisture hides the scenario overlay and pauses the clock (the scenario stays selected). "Show on map" in the scenario, or Play, switches the layer bar to Satellite and shows the scenario again. Compare's split works with any layer.

### Field popover on sim farms
Adds: Area (ha, `derived` chip), Crop shown (A, and B in Compare, `assumed` chip), and a "Details" text button that opens the tab on a **Field** view (reuses `FieldCard`: bare-soil months, cover calendar, sources) with a back link. Closing returns to the previous section.

## 3. Honesty labels that must survive (CLAUDE.md, PRD §2.4, §6.7)
- "Synthetic demo data" + `SYNTHETIC_NOTE` wherever a fixture run is on screen (tab header and collapsed pill).
- `EMPTY_RUN_MESSAGE` when there's no run source; nothing painted on the map then.
- BasisChip on every number: readouts, inputs (`assumed` default), colour key (`def.basis`), area (`derived`), crops (`assumed`), bare-soil months (`derived`).
- "Results are relative comparisons between options, not predictions." on the scenario list. No yield, profit or absolute soil-loss figures anywhere.
- Effect caption and "What a real run needs" per scenario.
- "Illustrative styling, not sensor data." (Look) and "1× = true scale." (exaggeration).
- "Crops are illustrative, not farm records." (Compare).
- Evidence note + support sentence in Evidence.
- Field outline attribution and labels always visible (caption line), plus SourceFooter in the Field view.
- "This tool supports, and does not replace, local agronomic expertise." always visible on sim farms (caption line under the title).
- New-UI "Sample data" stays on every card, the report and the popover.
- Subtitle on sim farms: "<place> · Simulation available" (drop "Explore only…"). With fixture runs the Synthetic badge carries the honesty, not the subtitle.

## 4. Open questions for god (defaults Oscar should build if no answer)
- Q1. The new report, pills and cards show Zürich sample numbers (`sample.ts`). On sim farms, field names must come from `twin.fields`. **Default:** report rows = `twin.fields` names; Moisture and NDVI cells show "–" with the summary line "No field measurements for this farm yet."; pills and cards keep farm-level sample values labelled "Sample data". No invented per-field numbers.
- Q2. Caption lines under the title (attribution, loading, support sentence) push the Simulation pill down to ~top 172. **Default:** pill top = bottom of the caption block + 12, measured at runtime; the open panel's top follows it.
