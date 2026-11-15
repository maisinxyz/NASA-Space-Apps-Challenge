# Active work — 2026-11-15 afternoon (Claude Code, on `main`)

**Status: items 6–7 done.** Items 1–2 are done and pushed (0373889). Reserved until this section says done: `services/api/app/services/copilot.py` and its tests (Gus), and every file containing the old product name (rename).

1. **"Digital twin" → "Explorable"** (done, pushed): explorable farms are labelled "Explorable"; "Enter digital twin" → "Enter farm"; "3D Digital Twin Unavailable" → "3D view unavailable". Internal ids (`tier: "twin"`, `Twin.tsx`, test ids) and the "Stardew Earth" product name unchanged.
2. **Synthetic data → "No data"** (done, pushed): features that showed synthetic/placeholder values now show "No data"; all "synthetic"/"illustrative" labels removed. UBC/KPU live engine results unchanged. Twin chat preview ("Ask Gus preview") removed entirely. Features now showing "No data":

| Farm(s) | Feature | Before | Now |
|---|---|---|---|
| Non-site farms (Cornell, Beltsville, explore-only) | Ask Gus preview chat (`Twin.tsx`, deleted) | Fabricated answers | Removed; real Ask Gus on UBC/KPU |
| All farms, Now mode | Condition cards: rainfall, soil moisture, crop vigor, heat & frost (`farm-view/Cards.tsx`) | Fake values (64 mm, 41%…) | No data |
| All farms | Vigor/moisture layer legend (`Cards.tsx`) | Fake gradient | No data |
| Cornell, Beltsville | Scenario runs: readouts, map effect, play/clock (`lib/twin/scenarios/runSource.ts`) | Fabricated readouts | No data / "No run yet" |
| Farms without an engine forecast | Future pills, lens cards, soil health panel, what-if scores, compare view, strategy text + flags (`components/farm-future/`, `lib/farm-future/data.ts`) | Modelled fixture values | No data, 0 flags |
| All farms, Future mode | Timeline overlays (temp, rain, frost-free, uncertainty, crop stages) | Fixture overlays | No data; date slider kept |
| All farms, Future mode | Map heat/rain/frost tints (`MapEffects.tsx`) | Fixture tints | Not rendered |
| Cornell, Beltsville | Field list crop label (`farm/TwinPanel.tsx`) | Crop swatch | No data · area |
| Cornell, Beltsville | Map hover crop names, crop fills (`viewer/cesium/twin.ts`) | "Corn (illustrative)", crop colours | "Crop: No data", neutral fill |
| Cornell, Beltsville | Compare tray crop calendars, cover calendar (`farm/shared.tsx`, `CompareTray`) | Made-up sequences | No data |
 The sr-only "supports, and does not replace, local agronomic expertise" line stays.
3. **Map credits:** Cesium ion and Google Maps logos stay. Google's 3D Tiles terms require them, and Cesium's free tier requires the Cesium logo. Removing the Cesium logo needs a paid plan or loading Google tiles directly; not planned.
4. **Playwright** (full run against production build + live API, 19 min): 43 passed, 31 failed, 71 skipped. Failures are mostly specs for the old UI: old `.fv-toolbar` layout (9), synthetic preview features (4), Cornell / old Future lens menu (8), mobile/non-3D (3, out of desktop scope), and controls timing out at 30s (7: mute, sound toggle, keyboard camera, press feedback, hidden-panel restore, missing observations), which may be moved selectors or real bugs. Next: update/delete stale specs, flag real bugs, re-run only the failing specs.
5. **API:** restarted on merged code with `CORS_ORIGINS=http://localhost:3003,http://localhost:3000`; Gus answers live (Groq, OpenRouter fallback).

6. **Gus answers: scoped, farmer-friendly, summarised** (done, `services/api/app/services/copilot.py`). Problem: the system prompt ordered Gus to quote exact p50/p10–p90 values, and the context dumped every metric plus the glossary, so answers repeated data and drifted. Fix: new prompt (answer the question first, 2–4 short plain sentences, at most 2 rounded numbers, no jargon unless asked, stay on this farm, decline off-topic); server computes a compact summary (change since year 0, direction, best/worst strategy) instead of raw p-values; glossary only when a term is asked; the fixed "reconstructed demo data" prefix removed. Response contract unchanged. Rotations are named for farmers ("your current rotation (barley, field pea, winter wheat)") instead of ids. Eval: `cd services/api && uv run python scripts/gus_eval.py` (API on :8000; 10 chats/min rate limit).
7. **Rename to "Stardew Earth"** (done). Packages `stardew-earth-web`/`-api`/`-contracts`, contract 1.4.1, 4 docs renamed (`docs/stardew-earth-v4-prd*.md`), fixtures regenerated, localStorage keys `stardew-earth:*` (saved settings reset once). Replaces every "Stardew Earth" / "stardew-earth" / "Stardew Earth" in UI text, metadata, package names, API title, logger names, contracts text, docs and scripts. Repo name and internal `twin` ids unchanged. Done when `git grep -i "stardew-earth\|Stardew Earth"` returns nothing. Note: "Stardew" is a game trademark; check before using it on a product or domain.

---

# Active follow-up — 2026-11-15 (Claude Code)

**Status: items 1, 2, 4 done; item 3 (Playwright) still running.** Owner: Claude Code session on branch `codex/launch-latest-20261114`. Reserved until this section says done: `apps/web/components/hero/`, `apps/web/components/globe/GlobeChrome.tsx`, `apps/web/components/farm/ScenarioPanel.tsx`, `services/api/app/core/config.py`, `services/api/app/main.py`, `.env.example`, `apps/web/e2e/farm-view/`.

1. **Remove yellow text.** Replace `#ffc857` / amber text (FarmPopup "Digital twin" badge and note, GlobeChrome, RestingHero gradient, HeroEarth hover, ScenarioPanel badge) with the app accent `#a3bfe9` or neutral white. Chart and map data colours unchanged.
2. **Deployable to Vercel or any domain.** API reads `CORS_ORIGINS` (comma list) and optional `CORS_ORIGIN_REGEX` (e.g. `https://.*\.vercel\.app`); default stays `http://localhost:3000`. Web uses existing `NEXT_PUBLIC_API_BASE`. Document in `.env.example` and a deploy section here.
3. **Playwright.** Run full suite against a production build; fix specs made stale by the desktop repair; record remaining failures as caused-by-repair vs pre-existing.
4. **Gus keys.** `GROQ_API_KEY` (primary) and `OPENROUTER_API_KEY` (fallback when Groq is missing or errors) are read from the API process env, then repo-root `.env` (`services/api/app/services/copilot.py`). Same model `openai/gpt-oss-120b` on both. Never commit them.

### Deploy (Vercel or any domain)

- **Web (Vercel):** import the repo, set Root Directory `apps/web`. Env: `NEXT_PUBLIC_API_BASE=https://<api-host>/api/v1` (live is the default mode). Build runs `prebuild` (fixture, MapLibre worker, Cesium, font sync) automatically.
- **API (any Python host, e.g. Render/Fly/Railway):** from `services/api`, `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Env: `GROQ_API_KEY` and/or `OPENROUTER_API_KEY` (Gus), `CORS_ORIGINS=https://<your-web-domain>` (comma list), optional `CORS_ORIGIN_REGEX=https://.*\.vercel\.app` for preview deploys.
- **Local:** put `GROQ_API_KEY=...` in repo-root `.env` (git-ignored). Web on :3000 needs no CORS change; another port needs `CORS_ORIGINS=http://localhost:<port>`.

---

# Active desktop website repair — 2026-11-15

**Owner: Claude Code session (took over from Codex 2026-11-15). Status: verified and pushed; reservations released.**
Other contributors: do not edit the reserved areas below until this notice releases them. This is a coordination reservation, not an enforced lock. Backend model/schema changes remain with their owner. No messages have been sent to other contributors.

## Approved scope and resources

Desktop browser website only. No phone layout, mobile navigation, bottom sheet, or phone acceptance work. Keep the existing workflow. Rename the user-facing farm bot to **Gus** (including buttons, accessible names, errors and introductions); preserve API endpoint and internal copilot identifiers.

Base: latest fetched GitHub main `4e67563` (first-year planting comparison), rebased with existing local documentation commit, without conflicts. Preserve the incoming PlantingComparison component and its backend-driven flow.

Design references: [Felt interface](https://help.felt.com/getting-started/tour-the-interface), [Felt irrigation planning](https://felt.com/gallery/irrigation-upgrade-planning), [FieldView field maps](https://www.climate.com/static/global/assets/static/docs/how-to-view-field-maps-in-fieldview-website-892dee50.pdf). Adapt layout patterns, retain existing components/style. Worker reference: [MapLibre setWorkerUrl](https://maplibre.org/maplibre-gl-js/docs/API/functions/setWorkerUrl/). Test resource: existing Vitest, pytest and Playwright suites, plus real HTTP responses and backend contracts.

## Reserved files and task ownership

- Map/asset agent: `apps/web/components/map2d/Map2D.tsx`, `apps/web/scripts/sync-maplibre.mjs`, `apps/web/scripts/sync-mocks.mjs`, development fixture watcher/runner, package scripts, `.gitignore`, map/asset tests. Explicitly set the installed MapLibre worker URL before map construction, copy its runtime into a versioned public path at startup/build; validate browser worker initialization. Repair missing mock copies and keep development copies current.
- Gus agent: `apps/web/lib/copilot/`, `apps/web/components/copilot/`, Gus labels in `farm-future/SoilHealth.tsx`, `apps/web/lib/api/client.ts` and related client tests. Restore failed drafts without duplicate history; farm-scope chat and reject stale replies; expose honest context/provider errors. Live API default, retain explicit mock/offline overrides. API schemas and model calculations unchanged.
- Data agent: `apps/web/components/farm-future/RotationComparison.tsx`, `apps/web/components/farm-forecast/ForecastPanel.tsx`, `apps/web/lib/forecast/store.ts`, forecast selectors/tests. Correct whole-farm vs field scores/flags/metrics, no field fallback for missing rollup, add loading/retry/stale/source status and invalidate pending loads on reset. Preserve first-year planting entry.
- Root integration: `apps/web/components/farm-view/`, future controls/legend/layout (except SoilHealth source owned above), rotation planner mounting/state integration, `GlobeHome.tsx`, browser regression tests, this handoff and README startup instructions. Coordinate before crossing another agent's ownership.

## Exact UI changes

1. Compact vertical left menu: Compare rotations, Plan rotations, Ask Gus, 2D/3D view, Map tools. Constrain the title/location to the sidebar; eliminate duplicate entry controls.
2. One active details workspace, no independently stacked planner/Gus/forecast/drawer. Compact inspector for details, wider workspace for planning/comparison; retain contextual question links and return context.
3. Initial concise farm values: soil organic matter index (starting year = 100), irrigation need, bare-soil weeks; selected rotation/year and actual source. Missing data says unavailable. No invented health grades or percentages.
4. Charts, full field list, flags, crop roles and evidence expand on demand. Move 2D reset/projection/drawing into Map tools. Reserve timeline and attribution regions to prevent overlap.
5. Desktop acceptance at 1280/1440 widths, short laptop height and zoom. Phone work explicitly excluded.

## Bug evidence and acceptance

- Worker default miscompiles to main library under Turbopack; genuine worker initializes runtime while main library does not. Capture exact app console error and verify actual polygon render/click after fix, in dev and production.
- `/mock/copilot/chat_reply.json` returns 404 while canonical fixture exists. Restore synchronization; fixture is a placeholder, never claim a real Gus reply from it. Live provider requires existing server credentials; absent provider shows recoverable unavailability.
- Whole-farm comparison currently combines rollup numbers with first-field evidence; selected-field forecast scorecard currently remains farm-wide. Tests must intentionally differentiate fields and rollup.
- Old results must not masquerade as new after farm/input changes or failed refresh. Planner must remount/reset by site. Gus must not claim edited planner inputs are part of its reconstructed default forecast context.
- Audit visible buttons by outcome: navigation, comparison, first-year planting, planner inputs/run, field scope/year/scenario, Gus send/retry/close, map draw/analyze/reset/projection, lens/details/timeline, back/reset. Report external-service blockers rather than marking untested controls passing.
- Verify live frontend/API together; test changed inputs against returned values, units/ranges, API failures/retry, and farm switching during in-flight requests. Run typecheck/lint/unit suites and targeted backend/browser tests. Build separately from the active dev server. Capture desktop screenshots and final GitHub comparison.

## Progress

- [x] Read-only subagent audits completed; no product changes before latest GitHub integration.
- [x] GitHub update incorporated without conflicts.
- [x] Scope revised: desktop only; bot renamed Gus in task specification.
- [x] Worker/fixture repairs and regression tests.
- [x] Gus/client reliability and naming.
- [x] Backend display correctness and status handling.
- [x] Desktop workspace integration and button audit.
- [x] Verification evidence/screenshots. Reservations released on commit.

### Changes made (2026-11-15)

- **MapLibre worker:** `scripts/sync-maplibre.mjs` copies `maplibre-gl-worker.mjs` to `public/maplibre/<version>/` on predev/prebuild (git-ignored); `Map2D.tsx` calls `setWorkerUrl` before constructing the map. New map-init failure alert (`map2d-init-failed`) with Retry and Back to 3D, separate from the imagery-failure notice.
- **Fixtures:** `scripts/sync-mocks.mjs` mirrors all canonical fixtures (fixes 404 on `/mock/copilot/chat_reply.json`); `scripts/dev.mjs` runs a Node `fs.watch` fixture watcher that stops with the dev server. Asset tests in `scripts/tests/`.
- **Gus:** user-facing bot renamed Gus (buttons, aria labels, errors, intro); API paths and internal `copilot` identifiers unchanged. Live API is the default; `NEXT_PUBLIC_API_MODE=mock` and `NEXT_PUBLIC_OFFLINE=1` still override. Mock replies labelled "Placeholder sample, not a reply from Gus". Failed questions restore the draft without duplicating history; Send becomes Retry. Conversation resets per farm and late replies are dropped. 503/context errors show an honest "Gus is unavailable" message. Intro states Gus sees the default forecast context, not edited planner inputs.
- **Forecast/comparison data:** whole-farm view uses rollup metrics only, labels the representative field plan, groups flags by field (`flagsByField` in `lib/forecast/select.ts`), shows farm rank only for Whole farm. Selected field uses its own scores. Missing rollup shows Unavailable (0 stays 0). Loading/error states label retained results as stale with Retry. Reset invalidates pending requests. Source badge shows live/prebuilt/mock. Soil label: "Soil organic matter (index, starting year = 100)"; bare-soil weeks added.
- **Desktop layout:** 256px left sidebar with Compare rotations, Plan rotations, Ask Gus, 2D/3D, Map tools (`desktop-workspace.ts`); old `rail-view`/`rail-rotations`/`rail-campus` tabs removed. One workspace open at a time (`lib/farm-view/workspace.ts`). `FarmOverview.tsx` shows soil index, irrigation need, bare-soil weeks, rotation/year and source. Planner remounts per site (`key={siteId}`). Ask Gus now renders for UBC (was gated on stale store farm id).
- **Tests:** FarmView tests updated for the new menu; e2e specs renamed to Gus; new `lib/forecast/store.lifecycle.test.ts` (out-of-order, failed refresh + retry, reset), field-vs-rollup tests with deliberately different values, copilot stale-reply and error tests.

### Verification (2026-11-15)

- `tsc --noEmit` clean; `eslint` 0 errors; `vitest run` 596/596; `npm run test:assets` 5/5; `npm run build` OK.
- Production build on :3003 + live API on :8000, Chromium at 1440x900: UBC and KPU load; 2D map initializes with no worker errors and KPU field polygons render; live forecast POSTs return 200; Gus `/copilot/chat` returns 503 without `GROQ_API_KEY` and the panel shows the honest "Gus is unavailable" message with Retry.
- API CORS allows only `http://localhost:3000` (hard-coded in `services/api/app/core/config.py`); run the web app on :3000 for live mode.
- Full Playwright suite not re-run (stopped for time). Known stale specs: `audit-regressions.spec.ts` overlap tests use `.fv-toolbar`, which no longer exists (was already missing before this repair); mobile/non-3D specs are out of desktop scope.
- Open: no keyboard path for `farm-view/Timeline.tsx` handle, `ForecastPanel` chart year click, or Map2D corner drawing; Gus "return to result" action not added.

---

## Historical handoff (superseded where current code/active instructions differ)

# Stardew Earth frontend handoff

Written 2026-11-14 from the state of `main` after S2-W (sky and weather) and S2-G (ground layers) landed. Audience: the next developer or Claude Code session picking up the frontend. The backend and data pipeline belong to another owner and are not covered here.

## What Stardew Earth is

A website for NASA Space Apps 2026, challenge "Adapting Farms with NASA Data". It helps farmers explore crop-rotation options for soil health and resilience. A 3D digital twin of a real farm (Cesium over Google Photorealistic 3D Tiles) lets a user compare at least three rotations, including the existing one, and replay climate scenarios on the land. The tool supports, and does not replace, local agronomic expertise. Results are relative comparisons. No yield, profit or absolute soil-loss numbers appear anywhere.

## How to run it

1. Pull `main`.
2. Copy `apps/web/team-test.env` to `apps/web/.env.local`. It holds a shared Cesium ion token, for testing only (see Security).
3. In `apps/web`: `corepack pnpm install`, then `corepack pnpm dev`. Open http://localhost:3000. The first start copies Cesium files and takes a few minutes.
4. Dev pages: `/dev/scenarios` (scenario effects on the Cornell farm, fixture data), `/dev/trace` (click the 3D map to trace field outlines and copy a start view), `/dev/cesium` (renderer test bench). Press the backtick key, or add `?perf=1`, for the performance readout.
5. Checks: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test`. Do not run `pnpm build` while a dev server runs: it overwrites `.next` and the server returns 500.

Without a token the app falls back to a plain offline map with no terrain and no 3D.

## Product state

- **Home:** globe with 3 pins. Click a pin for a card, then "Open twin" or "Fly in".
- **Farms** (`apps/web/lib/farms/`, one data file per farm, no component hard-codes a farm):
  - Cornell University Ruminant Center, Harford NY: full twin (hero).
  - Beltsville Agricultural Research Center, MD: full twin.
  - Oakville Grade area, Napa CA: explore only.
  - All coordinates are approximate and flagged `TODO(verify)`. Cornell fields are traced by eye, Beltsville fields come from OpenStreetMap (ODbL). Crops are illustrative. Agassiz, Mead (Nebraska) and Lancaster County PA (Intercourse) were removed. Eleven scouted farms passed the Google 3D check and are explore-only pins (`lib/farms/pinned.ts`): Wageningen Unifarm, UBC Farm, Hokkaido University farm, UTokyo ISAS, Agroscope Reckenholz, UIUC South Farms, Waite Campus Adelaide, Helsinki Viikki, INTA Castelar, NTU Farm Taipei, Pirque vineyards (Chile). Other candidates and verdicts: `docs/farm-scouting/FARMS.md`.
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
