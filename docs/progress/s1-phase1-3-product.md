# S1 Phases 1–3 (PRODUCT): twin workspace HUD, provenance, honest comparison, share link

Plan: `~/.claude/plans/pasted-content-id-c071-section-1-linear-wand.md` (UPDATE, Decisions, Audit gaps, Phases 1–3, 6).
Branch `fe/S1-cesium-globe`. Not committed (orchestrator commits). The RENDER agent owns `Globe.tsx`, `components/viewer/cesium/**` and `types.ts`; none of those were edited here.

## What was built
- **Workspace HUD** (`components/farm/TwinPanel.tsx`). In the Agassiz twin the header collapses to a 40 px slim bar with: FieldTwin / farm name, the support-not-replace sentence, badges, Methods & data, About, Presenter. The globe then fills `100dvh - 2.5rem`. Dark glass panels (`.glass` in globals.css) float over the map:
  - Top centre, always visible (also with panels hidden): "Approximate field boundaries", "Illustrative field layout and crops (not farm records)", the OSM credit, and a "Loading 3D detail…" pill while `onLoadProgress.pending > 0`.
  - Left, 300 px, "Fields & layers": the field list (swatch, crop, area), area/crop basis chips, a Photoreal 3D / Terrain only toggle, height exaggeration (1× = true scale), a Look select captioned "Illustrative styling, not sensor data.", and a disabled "NASA layers: NASA regional context — coming soon" group.
  - Right, 360 px inspector: the click-to-inspect field card when a field is selected (with "← Back to <mode> Esc"), otherwise the mode body (Explore overview, Simulate empty state, Compare, Evidence).
  - Bottom command dock, centred and lifted above the Cesium/Google credit line: Explore 1 / Simulate 2 / Compare 3 / Evidence 4, Reset view, Back to globe, Share link, Hide panels H, plus an aria-live "Link copied" status.
  - Both panels collapse (−/+). Compare and Evidence fold the left panel on entry (it can be reopened). H hides all panels.
- **Provenance** (`lib/provenance.ts`, `components/ui/Provenance.tsx`). `ValueMeta` holds basis (contract enum + `synthetic`), unit, sourceId, observedAt, updatedAt, spatialResolution, qualityNote. A `SOURCES` registry holds osm, illustrativeCrops, rotationCalendar and teamScores. The components are `<BasisChip>` (delegates to ui/BasisChip, adds synthetic), `<Value>` (value + unit + chip + hover/focus popover with source, dates, resolution and limitation, linked through `aria-describedby`) and `<SourceFooter>`. They are used in the field card, the ranking and the left panel.
- **Honest comparison**:
  - Right inspector (`components/farm/ComparePanel.tsx`):
    - "Why X is first" with one generated sentence (`explainRanking`).
    - A ranking list with the existing rotation pinned on top as "Existing · baseline". All 3 rotations are always shown with their rank. Each metric shows dots plus words ("higher than / similar to / lower than existing"), and each rotation shows bare-soil months (derived, with source).
    - Priorities: sliders 0–5 defaulting to 3, − / number / + inputs, and Reset. The exact line "Priorities change how options are ranked; they do not change scenario results." is shown.
    - "Income suitability" is renamed to "Economic fit (proxy)".
  - Bottom tray (`components/farm/CompareTray.tsx`):
    - A and B rotation selects. Picking the other side's rotation swaps them. There is also a Swap button, and a "Fields show Year N" select.
    - The bare-months calendar for the A and B years. The month labels are buttons that set the month on both sides.
    - Show A / 50 / 50 / Show B buttons, as the non-drag alternative.
    - A disabled "Difference map" checkbox with "Difference map appears when a simulation scenario is loaded".
  - On-map `DividerHandle`: a draggable knob (role=slider; arrows ±5 %, Home/End) with "A · Existing rotation" / "B · <name>" labels. `GlobeHome` passes `compare={{ right: { cropByField: B season }, divider }}` and `cropByField` = A season, in Compare only. Other modes show current crops.
- **Share link** (`lib/share.ts`). The hash holds `farm, m, f, a, b, d, s, l, cam` (camera rounded). It is written by Share link (replaceState + clipboard). On load, `GlobeHome` decodes it and only valid values reach the store. Unknown farms are ignored. The camera is applied with `setCamera` 4.5 s after the viewer is ready in farm view (0.8 s with reduced motion). This is a fixed wait (`ponytail:` comment); there is no "landed" callback in the contract.
- **Keyboard / a11y**:
  - 1–4 switch modes, H hides panels, Esc deselects the field (or closes the inspector when no field is selected), and R resets (unchanged). None of these fire in text inputs or while a dialog is open.
  - A "Skip the 3D map" link jumps to the dock.
  - Targets are at least 24 px (`min-h-7`/`size-6`). Focus rings come from globals.css, and the surface toggle shows a ring through `has-[:focus-visible]`. Reduced motion is respected.
- **Evidence**: a sticky "Decision support, not agronomic advice: talk to a local agronomist or adviser before changing a rotation." note, then the three cards in the order Why, Evidence, Benefits, Information gaps, Risks (reuses `components/lab/EvidenceCardView`).
- **Methods**: a new section "Farm twin: map, 3D and weather sources" with Google Photorealistic 3D Tiles via Cesium ion (personal/non-commercial plan, Google attribution), Bing Maps Aerial via ion, Cesium World Terrain, OpenStreetMap (ODbL, https://www.openstreetmap.org/copyright) and NASA POWER (API docs URL from prd.md; ~0.5° / ~55 km reanalysis grid; checked working at Agassiz). Licence details we could not confirm show as "not yet verified" on screen and carry `TODO(verify)` only in code comments, because check-build fails on the marker in the bundle. No URLs were invented.

## Files
- New: `apps/web/lib/{provenance.ts,provenance.test.ts,share.ts,share.test.ts}`, `apps/web/components/ui/{Provenance.tsx,Provenance.test.tsx}`, `apps/web/components/farm/{Inspector.tsx,CompareTray.tsx}`.
- Edited: `apps/web/components/farm/{TwinPanel.tsx,ComparePanel.tsx,shared.tsx}`, `apps/web/components/globe/GlobeHome.tsx`, `apps/web/components/Header.tsx`, `apps/web/components/ui/SupportBanner.tsx` (adds `data-support-banner`), `apps/web/app/globals.css`, `apps/web/app/methods/page.tsx`, `apps/web/lib/store.ts(+test)`, `apps/web/lib/twin/{rotations.ts,agassiz.ts,twin.test.ts}`.
- Store: `twinRotationId` was removed. New keys: `compareA` (rot_existing), `compareB` (rot_cover), `divider` (0.5), `look` ("none"), `panelsHidden`, `leftOpen`, `rightOpen`. `priorities` now defaults to 3/3/3/3. New `TWIN_MODES` and `useChrome` (`twinFarm`, which drives the slim header). `twinFields()` moved to `lib/twin/agassiz.ts`.

## Results (apps/web)
- `corepack pnpm typecheck`: pass. `corepack pnpm lint`: pass.
- `corepack pnpm test`: 128/129. The only failure is the known `lib/api/client.test.ts` CRLF test. The new tests cover ranking explanation, vsBaseline, default weights and label, share encode/decode/validation, provenance formatting and the Provenance components.
- `pnpm build` was not run (instruction).
- Browser (own Playwright tab, 2 twin loads): screenshots in `.playwright-mcp/`: `phase1-1920-{explore,compare,evidence}.png` and `phase1-1440-{explore,compare,simulate,evidence}.png`.
  - Measured panel coverage at 1920×1080 in Compare was 26 % (map 74 % visible). At 1440×900 in Compare it was 35.0 % (map 65 %, right at the limit). Explore at 1440 was 24 %.
  - No horizontal overflow in the panels. Cesium/Google credits are unobstructed bottom-left.
  - A share-link reload restored mode, B rotation and divider. The keyboard split moved 50 → 45. Share link wrote the hash and showed "Link copied". H hid the panels and kept the notes. There were no React errors in the console; the only errors were ion tile `ERR_NETWORK_IO_SUSPENDED` from a background tab.

## Acceptance (from the brief)
- Pass:
  - Slim header in the twin.
  - Glass left/right/dock panels within the width limits.
  - Map ≥ 65 % at both sizes (at the limit for 1440 Compare).
  - Loading pill. Honesty notes, OSM credit and the support line always visible. Attribution clear.
  - Provenance components used on every number in the twin.
  - Baseline-pinned ranking with words + dots. Renamed label. Equal default weights with ± and Reset. The exact priorities sentence. The explanation sentence, with tests.
  - Calendar with month labels in the tray. A/B selects with swap. Divider drag + keyboard + buttons. Season drives both sides. Diff placeholder without a fake diff.
  - Share link encode/restore. Keys 1–4/H/R/Esc. Skip link.
  - Evidence order and note. Methods rows.
- Not verified:
  - That `setCamera` from a share link lands correctly, which depends on the RENDER implementation. The split rendering of different crops left and right was visible, but correctness is RENDER's.
  - Screen reader pass, 200 % zoom, widths < 1440, Presenter-mode layout.

## Known gaps / for the next prompt
- The farm pin label ("Agassiz Research and Development Centre, Canada") still draws over the twin map. That is RENDER's area (hide the pin label in farm view?).
- The left panel auto-folds on every mode switch to Compare/Evidence (simple rule; remembers nothing).
- The share-link camera uses a fixed 4.5 s delay. A `onLanded` / fly-in-complete callback in `types.ts` would be cleaner (contract change, orchestrator).
- `components/lab/EvidenceCardView` heading says "Risks to review locally" (not my file; wording is fine but could become "Risks needing local review").
- The ranking scores are still team assumptions; swap them for modelled metrics when C4/C6 land (the basis chip changes with them).
- Unvalidated wording (no farmer test yet, plan decision 2): "Economic fit (proxy)", "bare soil months", "Height exaggeration", "Look" filter names, "Show as B", "Decision support, not agronomic advice…", "higher/similar/lower than existing", "Why X is first". Keep for the 5-task farmer test script.
- Methods `TODO(verify)` items: Google/ion plan terms, Bing via ion terms, Cesium World Terrain licence text, NASA POWER citation wording.
