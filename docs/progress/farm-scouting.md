# FARM-SCOUT: farm scouting and pins (2026-11-14)

> **3D VALIDATION DID NOT RUN. All 27 new candidates are NOT VALIDATED and need a visual check by a person.** The sandbox network policy blocks Cesium ion (`api.cesium.com`, `assets.ion.cesium.com`: proxy 403 on CONNECT). The app viewer in headless Chromium (SwiftShader WebGL) loaded `/dev/farms-check` but fell back to tier C, so no Google tile was ever streamed. Overpass, openstreetmap.org, NASA POWER, Wikipedia and developers.google.com were blocked too. The numeric sampling method is therefore **untested**: no numbers were measured and no screenshots were taken. No new pin is on the public home globe.

## What was built

- **Lancaster County removed** (Intercourse PA): `lib/farms/lancaster.ts`, its registry entry and pin, its framing in `traced/framings.ts`, its `/dev/trace` preset, its tests (`farms.test.ts`, `FarmCard.test.tsx`, `runSource.test.ts`) and the `types.ts` comment. HANDOFF farm list updated. Historical progress notes got a removal line.
- **27 candidate farm files**, one per farm, in `apps/web/lib/farms/candidates/<id>.ts`.
  - Each file holds a `FarmInfo` (same `Farm` schema, no new fields) plus scouting facts: privacy, expected 3D, elevation and boundary dataset ids, and `validation`.
  - All are explore tier, `coordsVerified: false`, with a TODO(verify) location and a source URL taken from search results.
  - The one private site (Pirque vineyards) is area only, with the privacy note and `minRangeM: 250`.
- **Registry flag:** `validation: "pass"` in a candidate file is the switch. `FARMS` in `lib/farms/index.ts` = Cornell, Beltsville, Oakville + `passedCandidates()`.
  - Pins, the farm card, "Fly in" (explore view) and the Methods page all read `FARMS`, so a passed farm needs no component change.
  - All 27 are `"not-validated"` now, so the globe still shows 3 pins.
- **Methods page:** a section "Open data for the newer farm pins" lists the datasets of pinned candidates. It is hidden while none are pinned. `CANDIDATE_DATASETS` holds name, URL, licence and attribution.
- **Dev helper `/dev/farms-check`** (`app/dev/farms-check/`, helpers in `lib/scouting/check.ts`). It flies the app's own viewer through Cornell (known-3D control) and all candidates. For each one it:
  - shows an oblique view (-30°, 350 m) and a top-down view (-89°, 1000 m) for 5 s each;
  - fetches OSM buildings from Overpass;
  - samples `scene.sampleHeightMostDetailed` at each centroid, against the local mesh ground and against World Terrain;
  - records the smallest visible tile geometric error, and an open-ground flat control.

  It prints a table, offers "Copy markdown", and exposes `window.__ftFarmsCheck`. It stores no tiles.
- **Tests:** `lib/farms/candidates/candidates.test.ts` covers:
  - unique ids and Lancaster gone;
  - only "pass" candidates become pins;
  - per-farm schema and privacy;
  - every pair at least 500 km apart, so pins do not cluster at globe zoom;
  - dataset URLs;
  - the stage-1 maths, camera placement and Overpass parsing.
- **Docs:** `docs/farm-scouting/FARMS.md` has the ranked table, reserves, rejected sites, datasets, the policy notes and the validation steps.

## How to run

- `apps/web`: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test`.
  - Result: typecheck clean.
  - Lint: 0 errors, 2 existing warnings in `GlobeHome.tsx`, not from this work.
  - Tests: 362/362 pass.
- **Validate:** follow "How to validate" in `docs/farm-scouting/FARMS.md`. It needs a machine with Cesium ion access: `corepack pnpm dev`, then `/dev/farms-check`, then **Run all**. That takes about 1 min per site.

## Results

- **Passed / weak / failed:** none. Nothing was measured, so all 27 are NOT VALIDATED.
- **Needs a person's visual check:** all 27.
- **Did the numeric method work:** unknown, because it never ran against real tiles. Check it on Cornell first, as FARMS.md says.

## Realistic number

27 candidates were written, against a target of 15 PASS. Google's rural detail is weak, and every location is approximate, so a pass rate of about 55 to 70 % is plausible. That would give roughly 15 to 19 passes. The 12 researched reserves in FARMS.md can replace failures. Full twins for all of them by Sunday is not realistic: each twin needs traced fields, a framing and rotations. Pin the passing ones as explore-only, and build full twins for the top 5 first.

## Build full twins first (if they pass)

1. `wur-unifarm`: AHN4 0.5 m lidar (CC0), BRP crop parcels (CC0), real field boundaries.
2. `agroscope-reckenholz`: swissALTI3D, sits inside Zürich.
3. `uiuc-south-farms`: USGS 3DEP 1 m, Corn Belt rotation (maize-soybean).
4. `ubc-farm`: CanElevation HRDEM, inside Vancouver.
5. `waite-adelaide`: ELVIS lidar, vineyards, Mediterranean climate.

Next in line: `helsinki-viikki`, `utokyo-isas` (MAFF fude parcels), `iari-pusa`, `cimmyt-el-batan`.

## Known gaps

- Coordinates for 21 of 27 sites are from memory. The other 6 come from search results: cgiar.org, tbs-sct.gc.ca, and Wikipedia for CIP. All are TODO(verify).
- No candidate has a framing: the default framing is used, so the view centres on the pin. Set a framing in `/dev/trace` before passing a farm.
- Licences come from search snippets; the pages were not opened. Check each one, especially NLS Finland, GUGiK, MAFF, the AHN official page and the HRDEM OGL version.
- **Google policy:** the full Map Tiles policy page was not readable here. Before using or publishing the height-sampling numbers, read whether sampling tile heights counts as "derived" content (see FARMS.md).
- **Not pushed?** `git push` returned 403: the Claude GitHub App has no access to this repository for the organization. If these commits are not on `origin/main`, push them from a machine with access.

## When done, tell

Frontend owners (Track owners table in `Prompts.md`): the farm registry now has a `candidates/` folder. Lancaster is gone. Nobody should hard-code farm counts in tests: use `FARMS.length`.
