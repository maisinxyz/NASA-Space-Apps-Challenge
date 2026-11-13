# s1-C3 (product/UI): Farm twin screen for Agassiz

Branch `fe/S1-cesium-globe`. Owner: PRODUCT. Nothing committed. The 3D side (Globe.tsx) is owned by RENDER.

## What was built
- In farm view, a farm with tier "twin" and field data (only Agassiz) now shows the twin overlay instead of the old farm bar. Top-left: Back to globe, Reset view, farm name, and the mode tabs Explore / Simulate / Compare / Evidence (WAI-ARIA tabs, arrow keys work). On the right is a docked panel per mode. The farm list is hidden in twin view. Explore-only farms behave as before.
- The panel header always shows "Approximate field boundaries" and "Illustrative field layout and crops (not farm records)". The footer shows "Field outlines: © OpenStreetMap contributors, ODbL".
- **Explore:** a "Photorealistic 3D" toggle ("Uses Google 3D tiles"), a vertical exaggeration slider (1–3×, step 0.5), the selected field (name, area in ha marked *derived*, current crop marked *assumed*) and a field list. Picking a field in the list or on the map sets `twinFieldId`.
- **Simulate:** a "Climate scenarios arrive with real NASA data" empty state, plus the scenario / rotation / play / timeline controls, disabled. No storm and no water is drawn. `lib/twin/scenario.ts` holds the `ClimateScenario` interface (id, kind `storm|heat|drought|frost`, label, basis, durationMin, legend, `render(tMin, rotationId, canvas)`) and an empty `SCENARIOS` list.
- **Compare:** four priority sliders (0–5) re-rank three rotation columns. Each column shows its rank, the four scores 1–5 (marked *assumed* and *relative*), a month-by-year cover calendar with bare months outlined, and "Bare: x of y months (z %)" (*derived*). "Show on fields" paints that rotation on the 3D fields for a chosen rotation year and month (SeasonPicker). "Show current crops" clears it. The support-not-replace line is at the bottom.
- **Evidence:** the support-not-replace line, then one card per rotation (reuses `components/lab/EvidenceCardView`) with Why / Evidence / Benefits / Information gaps / Risks to review locally.

## Decisions
- **Fields:** taken from real OSM `landuse=farmland` ways. Query (2026-11-13, overpass-api.de, OSM base 2026-11-13T19:28:05Z): `way["landuse"~"^(farmland|meadow|orchard)$"](around:1500,49.2482,-121.7637);out geom;`. It returned 13 ways. I kept the 8 whose centroid is within about 1.2 km of the centre; none overlap. Area is a planar shoelace estimate. The field names are made up.
- **Crops (illustrative):** grass f1/f7, alfalfa f2, berries f3, silage corn f4/f8, winter wheat f5, rye cover f6.
- **Rotations:** these reuse the contract fixture IDs `rot_existing`, `rot_cover`, `rot_forage`, so no new IDs were invented. Names: "Silage corn / winter wheat" (existing), "Silage corn / winter wheat + rye cover", "Silage corn / alfalfa / alfalfa". Monthly timing follows the season windows in `fixtures/crops.json`, which are themselves `to_verify`. Bare months: 11/24, 3/24, 12/36.
- **Rotation on fields:** fields in rotation (f2, f4, f5, f6, f8) are offset by a phase year (`ROTATING_FIELDS`). Grass and berry fields keep their crop.
- **Evidence:** general principles only, with no studies or URLs. TODO(verify) marks: the NRCS soil-health wording, the wet-winter claim (check against NASA POWER in C6), and the planting months.
- **Store:** new keys `twinMode`, `twinFieldId` (separate from `selectedFieldId` so the /simulate page is untouched), `twinRotationId`, `twinYear`, `twinMonth`, `priorities`, `photoreal`, `exaggeration`. The Reset key clears all of them.

## Files
New: `apps/web/lib/twin/{agassiz.ts,rotations.ts,scenario.ts,twin.test.ts}`, `apps/web/components/farm/{TwinPanel.tsx,ComparePanel.tsx,shared.tsx}`, this note.
Edited: `apps/web/components/globe/GlobeHome.tsx`, `apps/web/lib/store.ts`, `apps/web/lib/store.test.ts`.
Not touched: `Globe.tsx`, `components/viewer/**`, `components/globe/types.ts`, `packages/contracts/**`, `FarmCard.tsx`, `FarmList.tsx`, `AboutPanel.tsx`.

## Results (apps/web)
- `corepack pnpm typecheck`: pass. `corepack pnpm lint`: pass.
- `corepack pnpm test`: 125/126. The one failure is the known `lib/api/client.test.ts` SSE CRLF fixture.
- Browser at 1920×1080 on the running dev server: all four modes render, fields draw, "Show on fields" changes the field tints in 3D, and there are no console errors.

## Known gaps / next
- The Methods page does not list OSM yet. It is driven by provenance data and is outside this card: C7 should add "OpenStreetMap (field outlines), ODbL, © OpenStreetMap contributors".
- Scores are hand-assigned (*assumed*). Swap them for modelled metrics once C4/C6 produce them.
- `overlays` is not passed yet (no scenarios exist). When the first real scenario lands, wrap `render()` output in a `GroundOverlay` and bump `version`.
- Not checked: keyboard-only pass over the whole panel, screen reader, widths below about 1400 px (the Compare panel is 44rem wide).

## For RENDER
- `fields` is the module constant `AGASSIZ_FIELDS`, so the reference is stable. `cropByField` is `useMemo`'d, and it is `undefined` while no rotation is shown, so fall back to `field.crop`.
- `photoreal` and `exaggeration` are sent only in twin view; otherwise the values are `false` and `1`.
- Selection: `onSelectField(id|null)` writes `twinFieldId`, and the panel list writes the same key.

## C3b: fewer fields + simulation square (not committed)
- **Fields:** the twin now shows 3 adjacent OSM fields (real rings unchanged): f4 Centre field (35.5 ha, silage corn, rotating, phase 0), f2 North paddock (8.2 ha, alfalfa, rotating, phase 2) and f3 Berry block (3.9 ha, berries, perennial). f4 is the large rotating field, f2 touches it on the north at a different rotation stage, and f3 sits in a bay of f4. So one square shows neighbours at different stages. f1, f5-f8 are dropped. `ROTATING_FIELDS` is now `{ f2: 2, f4: 0 }`.
- **Square:** `AGASSIZ_SIM_BBOX = [-121.77543, 49.24461, -121.75617, 49.25719]` in `lib/twin/agassiz.ts`. It is 1.4 km by 1.4 km in metres (the lon span is divided by cos 49.25 deg). `GlobeHome` passes it as `simBbox` in twin view only. `SIM_AREA_LABEL` is "Simulation area (~1.4 km square)".
- **Explore panel:** the photoreal toggle is gone. It shows the square label and "The thin outline on the map marks where simulation layers apply; they only cover this area." The exaggeration slider stays. Nothing says the outside is muted.
- **Removed:** the `photoreal` store key, its reset test entry and the GlobeHome prop. There was no tier "A" copy in my files.
- **Tests:** `twin.test.ts` now expects 2-3 fields and checks that every ring point is inside the square and that the width/height ratio is within 3% of 1 (1.0-1.5 km). `cropByField` for Compare is unchanged, so "Show on fields" drives f2/f4 (f3 keeps berries).
- **Board:** added backlog card C3c "field drill-down" to `s1-cesium-board.md`.
- **Results:** typecheck errors are only in RENDER files (`viewer/cesium/Spike.tsx`, `tiles.ts`, `tiles.test.ts`: tier "A" and `photoreal`, still being removed). None in my files. Lint passes. Tests 126/127; the one failure is the known `client.test.ts` CRLF issue.
- **Not checked:** browser view of the 3-field twin (the Playwright check was not done).
