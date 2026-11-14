# FieldTwin frontend handoff

Written 2026-11-14 from the state of `main` after S2-W (sky and weather) and S2-G (ground layers) landed. Audience: the next developer or Claude Code session picking up the frontend. The backend and data pipeline belong to another owner and are not covered here.

## What FieldTwin is

A website for NASA Space Apps 2026, challenge "Adapting Farms with NASA Data". It helps farmers explore crop-rotation options for soil health and resilience. A 3D digital twin of a real farm (Cesium over Google Photorealistic 3D Tiles) lets a user compare at least three rotations, including the existing one, and replay climate scenarios on the land. The tool supports, and does not replace, local agronomic expertise. Results are relative comparisons. No yield, profit or absolute soil-loss numbers appear anywhere.

## How to run it

1. Pull `main`.
2. Copy `apps/web/team-test.env` to `apps/web/.env.local`. It holds a shared Cesium ion token, for testing only (see Security).
3. In `apps/web`: `corepack pnpm install`, then `corepack pnpm dev`. Open http://localhost:3000. The first start copies Cesium files and takes a few minutes.
4. Dev pages: `/dev/scenarios` (scenario effects on the Cornell farm, fixture data), `/dev/trace` (click the 3D map to trace field outlines and copy a start view), `/dev/cesium` (renderer test bench). Press the backtick key, or add `?perf=1`, for the performance readout.
5. Checks: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test`. Do not run `pnpm build` while a dev server runs: it overwrites `.next` and the server returns 500.

Without a token the app falls back to a plain offline map with no terrain and no 3D.

## Product state

- **Home:** globe with 4 pins. Click a pin for a card, then "Open twin" or "Fly in".
- **Farms** (`apps/web/lib/farms/`, one data file per farm, no component hard-codes a farm):
  - Cornell University Ruminant Center, Harford NY: full twin (hero).
  - Beltsville Agricultural Research Center, MD: full twin.
  - Farmland near Intercourse, Lancaster County PA: explore only. Private working farmland, area only, no owners or addresses, closest zoom 250 m.
  - Oakville Grade area, Napa CA: explore only.
  - All coordinates are approximate and flagged `TODO(verify)`. Cornell fields are traced by eye, Beltsville fields come from OpenStreetMap (ODbL). Crops are illustrative. Agassiz and Mead (Nebraska) were removed.
- **Twin modes** (bottom dock, keys 1 to 4): Explore, Simulate, Compare, Evidence. Dark glass panels float over a full-screen map: left "Fields & layers", right inspector, bottom dock and clock.
- **Fields are invisible on the map.** Hover shows a label with name and crop. Click gives a faint outline. Crop colours show only with "Show crops on map" (Compare).
- **Compare:** A/B split on one camera with a draggable divider and button alternatives, existing rotation pinned as baseline, priority sliders, "why X is first" sentence, bare-month calendar. The sentence "Priorities change how options are ranked; they do not change scenario results." must stay.
- **Share link:** the URL hash stores farm, mode, field, A/B rotations, divider, surface, look, camera, scenario, inputs and detail.
- **Surface:** Google 3D by default. "Terrain only" is a lighter surface. Google detail is weak in farmland, which is why farms were chosen near cities and universities.
- **Look filters** (thermal, vegetation, night) are captioned "illustrative styling".
- **Methods page** lists every source with licence and attribution. Learn page, "My farm" panel, extra rotation criteria and "ask your adviser" markers are planned and not built.

## Scenario system (the current work)

Ten scenarios, defined in `apps/web/lib/twin/scenarios/registry.ts`: storm, wet-spell, flood-zones, drought, heat-wave, frost, bare-soil, veg-stress, multi-year, trends. Each has plain-language copy, inputs, data needs, basis and a legend. The shared contract is `apps/web/components/globe/types.ts` (AtmosphereState, GroundLayerSpec, DetailLevel, FarmTwinProps weather, groundLayers, detail) and `apps/web/lib/twin/scenario.ts`.

Two owners split the visuals:

- **Sky and weather (S2-W):** `components/viewer/cesium/weather/**` and `lib/twin/scenarios/atmosphere/**`. Depth-aware post-process pass with low cloud slab, cloud shadows, rain, fog, haze, shimmer, frost, lightning limiter (at most one flash per 3 s, off with reduced motion) and an automatic detail step-down. Notes: `docs/progress/s2-W.md`.
- **Ground (S2-G):** `components/viewer/cesium/ground/**` and `lib/twin/scenarios/ground/**`. One GroundPrimitive with an uber material, baked field and height textures, NASA GIBS WMTS imagery layer (MERRA-2 monthly 2 m air temperature for trends), per-scenario evaluators, a "too wet to work" readout and a trends chart panel (written, not mounted). Notes: `docs/progress/s2-G.md`.
- **Simulate screen:** `components/farm/ScenarioPanel.tsx`, `useScenarioRun.ts`, clock in `lib/twin/scenarios/clock.ts`. Notes: `docs/progress/s2-step0-scenarios-product.md`.

**Rule that matters:** the run source (`lib/twin/scenarios/runSource.ts`, `runSourceFor`) is per farm. Full-twin farms (`tier: "twin"`: Cornell, Beltsville) run scenario effects from fixture inputs, always badged "Synthetic demo data" (approved by the user 2026-11-14). Explore-only farms stay `"none"`: Simulate shows "This scenario runs when the backend delivers data for this farm." and no effect renders. Other mock data must never reach the demo (CLAUDE.md).

## Performance

MSAA is off (it was the largest cost), FXAA stays. While the camera moves, tile detail drops and returns after 1 s idle. The camera ground-height query runs at 5 Hz. In the automated test browser the farm view rose from about 43 to about 66 fps. That browser is slower than a real one and measured with forced renders. Scenario effects add cost: the high tier costs about 5 to 6 ms on an integrated GPU. 60 fps is not guaranteed while tiles stream or effects are on. Measure on the demo laptop in a normal browser before claiming any number.

## Known issues and gaps

- **Tests:** 305 of 318 pass. 12 failures are `lib/twin/scenarios/registry.test.ts` ("composeFrame(...) is a clear sky with no ground layers until the owners fill it in"). The owners have since filled the evaluators, so the assertion is stale. Rewrite it to check the evaluators' output. The 13th failure is the old `lib/api/client.test.ts` SSE fixture: `packages/contracts/fixtures/scans/sse_success.txt` has CRLF line endings on Windows. Fix with a `.gitattributes` rule forcing LF on fixtures.
- **Viewer crash on cleanup (S2-G finding):** `GlobeHome.tsx` moves `.cesium-widget-credits` into another parent. `CesiumWidget.destroy` then removes it from its original parent and throws `NotFoundError` at `Globe.tsx`, masking the real error. Fix: pass `creditContainer` at construction or restore the node before destroy, and keep the original error.
- **Visual approval still pending:** NASA imagery draping over Google tiles was not confirmed visible. Field-edge alignment, roads, frost crust, cracks and low-spot water need a full-square visual check. The NASA credit collides with the bottom dock.
- **A/B weather:** no contract field exists for the right-side atmosphere. `compareWeather` is dropped: the climate-shift scenario it was meant for was removed.
- **Sky:** reduced motion is only unit-tested. Low tier clouds look grainy at slab edges. The sun is stylised, not an ephemeris.
- **Data caveats:** coordinates approximate, crops and rotation scores are team assumptions that need a NY and a MD adviser, some season months and climate sentences are `TODO(verify)`, Oakville's source page returned 403. Overpass (OpenStreetMap) was unreachable for several days, so building footprints for roof masking (`overlayMask`) are empty and trees can still be painted by overlays.
- **Not done from the challenge brief:** Learn page and glossary, expanded rotation criteria (organic matter, nitrogen, pest break, forage, market), priority profiles, crop-role chips, "My farm" constraints panel, "ask your adviser" markers, conditions charts and stress strip, NASA layers drawer with time slider, vulnerability layers, what-if input preview chart, backend data contract document. Mount the trends chart panel.
- **Not verified:** keyboard-only walkthrough, screen reader, 200% zoom, widths below 1440 px, share-link camera restore on the live homepage.

## Backend contract (not built)

The backend owner delivers terrain, storm, water frames, risk and diff layers, rotation metrics and provenance. `packages/contracts` already defines terrain, FTW1 water frames, storms and simulations. The frontend expects those shapes and must not invent endpoints or fields. Needed data, in plain terms: daily rainfall for the farm (NASA POWER verified for Agassiz earlier), an elevation map (USGS 3DEP 1 m lidar covers all US candidate sites), soil moisture, vegetation index, minimum temperature. Real events (for example the wettest 3 days) come from the backend, and the frontend only shows an event picker. Ground layers from the backend arrive as `GroundLayerSpec.overlay` canvases.

## Rules to keep

- Every number carries unit and a basis label (measured, derived, modeled, assumed, relative, synthetic). Spelling stays "modeled".
- Curated farms show "Approximate location" until coordinates are verified. Private farmland is described by area only.
- Never invent URLs, dataset ids, layer ids or constants. GIBS layer ids come from the live capabilities document.
- Same inputs give the same outputs. `OFFLINE=1` serves seed data only.
- Google attribution and the NASA, Cesium and OpenStreetMap credits stay visible.
- Work happens on `main`. `git pull --rebase` before work and before pushing. Small commits that name the prompt id. No attribution lines in commit messages.

## Security

`apps/web/team-test.env` holds a Cesium ion token and is committed on `main` at the owner's request, for testing only. Anyone who can see the repository can see the token and spend its allowance. Before the repository is shared publicly, delete the token in the Cesium ion dashboard, create a new one, restrict its allowed URLs, and remove the file (the old token stays in git history, so rotation is the real fix). Never commit `.env.local`.

## Suggested next steps

1. Fix the stale registry test and the CRLF fixture rule so the suite is green.
2. Fix the credits-container crash on viewer cleanup.
3. Visual acceptance of S2-G on Google and Terrain surfaces.
4. Build the brief-coverage items: Learn page, expanded rotation criteria, "My farm" panel, adviser markers, NASA layers drawer, conditions view.
5. Write the backend data-contract document and agree shapes with the backend owner.
6. Measure fps on the demo laptop and set Detail defaults.
7. Test the wording with a real farmer or adviser; all wording so far is unvalidated.
