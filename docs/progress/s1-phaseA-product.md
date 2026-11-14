# S1 Phase A (PRODUCT): multi-farm registry, 5 new pins, regional rotations

Plan: `~/.claude/plans/pasted-content-id-c071-section-1-linear-wand.md` (Decisions, Facts and caveats, Phase A).
Branch `fe/S1-cesium-globe`. Not committed (orchestrator commits). I did not edit `Globe.tsx`, `components/viewer/cesium/**`, `types.ts` or `lib/farms/traced/**`.

## What was built
- **Farm registry** in `apps/web/lib/farms/`. It replaces `lib/farms.ts` and `lib/twin/agassiz.ts`; both are deleted, and git history keeps them.
  - `index.ts` exports:
    - `FARMS`: the 5 pins, as `FarmInfo` (= `Farm` + an optional card `note` {text, url?, linkText?}).
    - `farmById`.
    - `twinConfig(farmId)`: returns the twin for "twin"-tier farms, else undefined. It is built lazily and cached.
    - The types `TwinSpec` / `TwinConfig`: fields, simBbox, simAreaLabel, phases, overlayMask, rotationSet, cropLabels, labels, attribution, outlineSource, outlineDate, and the resolved rotations.
  - One file per farm: `cornell.ts`, `beltsville.ts`, `lancaster.ts`, `oakville.ts`, `mead.ts`. Each starts with a comment saying what was verified and where. Unverified points carry `TODO(verify)`.
  - To make an explore farm a twin, add a `<id>Twin()` spec and set `tier: "twin"`. No component changes are needed.
- **Pins**:

  | id | tier | coordinates | basis |
  |---|---|---|---|
  | `cornell-ruminant` | twin (hero) | OSM relation 6483196 point | approximate |
  | `usda-barc` | twin | Wikipedia point | approximate; source is now the ARS BARC page |
  | `lancaster-intercourse` | explore | village centre | approximate |
  | `ucdavis-oakville` | explore | neighbouring point | approximate; UC Davis plot is TODO(verify) |
  | `unl-mead` | explore | AmeriFlux US-Ne3 tower | verified |

  - Lancaster: `minRangeM: 250`, owner "Private working farmland (area only)", card note "Private working farmland, area only. No owners or addresses are shown.", and the source is the Wikipedia page for Intercourse, PA.
  - Mead: the card note links to AmeriFlux US-Ne3 (in-ground flux/soil data).
- **Rotations generalised** (`lib/twin/rotations.ts`): `ROTATION_SETS` = `ny-dairy` and `md-grain`, with 3 rotations each. Ids are always `rot_existing` (baseline), `rot_cover`, plus one regional third, so the store defaults fit every farm. `rotationById(rotations, id)` now takes the set. The ranking, explanation and bare-month logic are unchanged. `CROP_LABELS` holds generic names; each twin gives regional `cropLabels` for the same crop looks.
  - **NY dairy (Cornell)**:
    - Corn silage, two years (baseline).
    - Corn silage + winter rye cover.
    - Corn silage / oats + alfalfa–grass / hay (3 years).
    - Labels: corn = Corn silage, legume = Alfalfa–grass hay, cereal = Oats (small grain), cover = Winter rye cover crop.
  - **MD grain (Beltsville)**:
    - Corn / soybean (baseline).
    - Corn / soybean + rye cover.
    - Corn / wheat / double-crop soybean.
    - Labels: corn = Grain corn, legume = Soybean, cereal = Winter wheat, cover = Cereal rye cover crop.
  - Scores are team assumptions (basis "assumed", relative within one set). With equal weights the baseline is never first: NY ranks forage 15, cover 14, baseline 8; MD ranks cover 15, wheat 14, baseline 10. The season months and the regional climate lines are `TODO(verify)` (Extension guides, NASA POWER).
- **Components now read the current farm**:
  - `useTwin()` / `useCropLabels()` in `components/farm/shared.tsx` read `twinConfig(store.farmId)`.
  - `TwinPanel` gets labels and attribution from the config.
  - `ComparePanel`, `CompareTray` and `Inspector` get rotations, phases, sim label and outline source from the config.
  - `GlobeHome` gets simBbox, overlayMask and the season crops from the config.
  - `share.ts` checks fields and rotations against that farm's own twin.
  - Nothing imports a farm file; `farms.test.ts` scans `components/` and `app/` to enforce this.
- **Store**:
  - New `showCropFills` (default false).
  - New `selectFarm(id)`: picking a different farm resets the per-farm twin state (mode, field, A/B, divider, year, month, fills). Priorities are kept, because they belong to the user, not the farm.
- **Design change (fields invisible by default)**:
  - Compare tray has a "Show crops on map" checkbox (off by default). It sends `showCropFills` to the globe, in Compare only.
  - The tray now reads "Crops are illustrative, not farm records. Hover a field to see its name and crop · in the calendar, outlined = bare soil · …".
  - Explore says "Hover a field to see its name and crop. Click it, or pick one under Fields & layers…". The left panel says the same.
  - The month picker and "Fields show Year N" still drive `cropByField`.
- **Copy**:
  - FarmCard shows the note and link; explore farms read "Simulation not available for this farm yet. You can still fly in and look around." and the button says "Fly in", not "Open twin".
  - FarmList heading is "Research farms and farmland".
  - About step 1 explains twin vs explore farms.
  - The farm-view bar for explore farms shows the farm note.
  - Methods has a new "Farms on the globe" section: per pin, the operator, approximate/published location with a basis chip, the source, and a twin note. The OSM row now covers the Cornell pin. There is a new "FieldTwin traced field outlines" row (basis assumed). The Agassiz mention was removed from NASA POWER. The Limits section mentions approximate pins.
- **Provenance**: a new `tracedOutlines` source. The field-area popover uses the twin's `outlineSource` / `outlineDate`.

## Files
- New: `apps/web/lib/farms/{index,cornell,beltsville,lancaster,oakville,mead}.ts`, `apps/web/lib/farms/farms.test.ts`.
- Deleted: `apps/web/lib/farms.ts`, `apps/web/lib/farms.test.ts`, `apps/web/lib/twin/agassiz.ts`.
- Edited:
  - `apps/web/lib/{store,store.test,share,share.test,provenance}.ts`
  - `apps/web/lib/twin/{rotations,twin.test}.ts`
  - `apps/web/components/farm/{shared,TwinPanel,ComparePanel,CompareTray,Inspector}.tsx`
  - `apps/web/components/globe/{GlobeHome,FarmCard,FarmCard.test,FarmList,AboutPanel}.tsx`
  - `apps/web/app/methods/page.tsx`

## Traced data wiring (RENDER output in `lib/farms/traced/`, read-only for me)
- **Cornell**: `CORNELL_TRACED` supplies 3 fields traced by eye on Google 3D (11.6 / 5.3 / 20.6 ha), a 1300 m square and the framing.
  - Names and crops: f1 "North hay field" (alfalfa–grass hay, phase 2), f2 "Barn field" (corn silage, phase 0), f3 "South field" (corn silage, phase 1).
  - Credit: "Field outlines traced by FieldTwin on Google 3D imagery (approximate)"; source `tracedOutlines`.
- **Beltsville**: `BELTSVILLE_TRACED` supplies 3 OSM ways (12.8 / 14.0 / 16.6 ha), a 1300 m square and the framing.
  - Names and crops: f1 "Barn field" (grain corn, phase 0), f2 "East field" (soybean, phase 1), f3 "South field" (winter wheat, phase 1).
  - Credit: "Field outlines: © OpenStreetMap contributors, ODbL"; source `osm`.
- **Explore farms**: the framings come from `traced/framings.ts`. Lancaster also uses `LANCASTER_MIN_RANGE_M` (250), and its radius stays 1500 m (≥ 1300 m is needed).
- **Mead**: its card adds "The 3D imagery is flat here; it reads best from above." (RENDER rated Google 3D 2/5 at Mead.)
- **Not yet supplied**: building masks (`overlayMask` is `[]` for both twins).
- The temporary `tracePending.ts` placeholder was used only until the files landed. It is deleted.

## Results (apps/web)
- `corepack pnpm typecheck`: pass. `corepack pnpm lint`: pass.
- `corepack pnpm test`: 145/146. The only failure is the known `lib/api/client.test.ts` CRLF test. New or updated tests:
  - farms registry: 5 ids, twins, Agassiz gone, Lancaster privacy, only Mead verified.
  - Twin geometry: inside a ~1.3 km square sim area; labels, attribution and rotations present.
  - The "no component imports a farm file" scan.
  - Both rotation sets: 3 each, baseline + cover, cover less bare, baseline not first by default.
  - Share link validated per farm (an NY rotation is rejected on Beltsville; explore farms keep no field or rotation).
  - `selectFarm` resets per-farm state and keeps priorities.
  - FarmCard for Mead and Lancaster.
- `pnpm build` was not run (instruction).
- Browser check at 1440×900 on the shared dev server, with 2 Google loads. Screenshots in `.playwright-mcp/`:
  - `phaseA-product-globe.png`: 5 pins and the list.
  - `phaseA-product-lancaster-card.png`: privacy note, area only, approximate.
  - `phaseA-product-cornell-twin.png`: Explore mode with 3 fields, regional crop names, traced credit.
  - `phaseA-product-cornell-compare.png`: NY rotations, "Show crops on map" toggle, hover copy.
  - `phaseA-product-beltsville-twin.png`: twin opens with the OSM credit and state reset to Explore. Tiles were still streaming at capture.
  - No console errors. Playwright snapshots and logs from this session were deleted.

## Acceptance
- Pass:
  - Data-driven registry; nothing hard-codes Agassiz (scan test).
  - 5 pins with sourced comments and the cards are correct.
  - Cornell and Beltsville open the twin with fields; the 3 explore farms keep "Simulation not available for this farm yet".
  - Lancaster copy and min range.
  - Mead AmeriFlux link.
  - Regional rotations reuse the ranking.
  - Share-link farm validation; store resets per farm.
  - Methods farm rows mark approximate coordinates.
  - "Show crops on map" toggle (off by default) and hover-label copy.
- Not verified:
  - That hover labels and crop fills look right on the map (RENDER).
  - Lancaster 250 m min zoom in the browser (RENDER clamp).
  - Oakville and Mead fly-in views.

## Known gaps / for the next prompt
- `TODO(verify)`:
  - Season months for NY and MD (Extension guides).
  - NY and MD climate lines (NASA POWER).
  - The NRCS wording.
  - The Cornell, Beltsville and Oakville pins.
  - The UC Davis plot: `https://wine.ucdavis.edu/node/571` appeared in search but returned 403 to our fetch, so the page is unread.
- The rotation scores are team assumptions. Swap them for modelled metrics when the backend lands.
- The field names and crops were picked by us. Run them past a NY dairy adviser and a MD grain adviser before the demo.
- The FarmCard line "not from coordinates published by the operator" reads oddly for private farmland. Consider farm-specific wording.
- `showCropFills` is not in the share link. The contract lists no key for it; add one only if wanted.
- The explore-farm card button now says "Fly in" instead of "Open twin".

> 2026-11-14 (FARM-SCOUT): the Lancaster County / Intercourse PA farm was removed from the app. Mentions above are historical.
