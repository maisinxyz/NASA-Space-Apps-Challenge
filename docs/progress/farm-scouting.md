# FARM-SCOUT: farm scouting and pins (2026-11-14, second session)

The first session (commits 872717c..21ffecd) could not render Google tiles from its sandbox. This session ran the check on a team laptop, where Cesium ion and Google Photorealistic 3D Tiles load (tier A, surface google). Full results: `docs/farm-scouting/FARMS.md`.

## Result

- **PASS, now pins (9):** `wur-unifarm`, `ubc-farm`, `hokudai-farm`, `utokyo-isas`, `agroscope-reckenholz`, `uiuc-south-farms`, `waite-adelaide`, `helsinki-viikki`, `inta-castelar`. With Cornell, Beltsville and Napa: 12 pins, at least 500 km apart (tested).
- **WEAK, no pin (1):** `up-hatfield` (blurred patch with spike artefacts over the trial fields).
- **FAIL at stage 1 (4):** `iari-pusa`, `cimmyt-el-batan`, `cip-la-molina`, `esalq-piracicaba` (buildings or ground read flat).
- **Not checked (13):** capped by the user at 15 sites (Cornell plus 14 candidates) to keep the run fast. They stay as `not-validated` candidates.
- Target was 15 PASS. Reached 9 within the cap. Run the remaining 13 candidates with `/dev/farms-check` to add more.

## Gap-fill round (same day, later)

- **New pins:** `pirque-vineyards` (Chile) and `ntu-farm` (Taipei, new file) passed. The globe now has 14 pins.
- **Failed, flat or broken:**
  - Kadoorie Farm, Hong Kong.
  - 7 unchecked candidates in Africa, Colombia, India and the Philippines.
  - 13 probed city campuses in Africa, Asia and Brazil (details in FARMS.md).
  - Africa has no pin: no African farm checked had real Google 3D.
- **Kadoorie bug:** the farm-view orbit put the camera at -7215 m on Kadoorie's hillside. This is the same bug that sinks a -89° camera. The review routine should fix `orbitFromCamera` / `applyOrbit` in `components/globe/Globe.tsx`, then recheck Kadoorie.
- **Pin designs:** a teammate's merge (`d14fc66`) added per-farm pin designs (`Farm.pin`). Pinned farms got one of the 3 existing designs:
  - `grape-cluster`: vineyards (Pirque, Waite).
  - `silo-pair`: barns (UIUC, Hokudai, Reckenholz, INTA).
  - `plot-grid`: trial plots (WUR, UBC, UTokyo, Helsinki, NTU).
- **New dev hook:** `window.__ftFarmsCheck.probe(lon, lat)` checks any point without writing a farm file.
- **Lint:** fails on 1 error in the teammate's `components/hero/Pin3D.tsx`, not touched here: `useId` is called conditionally (react-hooks/rules-of-hooks). Tell them.

## What changed

- **Unvalidated farms are no longer bundled into the app.**
  - New `lib/farms/pinned.ts` imports each PASS farm file by itself. `lib/farms/index.ts` (the registry) builds `FARMS` from it.
  - `lib/farms/candidates/index.ts` (all 27) is now imported only by `/dev/farms-check`.
  - Shared types and `CANDIDATE_DATASETS` moved to `lib/farms/datasets.ts`.
  - Pins, the farm card, "Fly in" (explore view) and the Methods dataset list all read `FARMS` / `pinnedCandidateDatasets()`. No component changed.
- **Verdicts:** each candidate file has `validation`: 9 `pass`, 1 `weak`, 4 `fail`, 13 `not-validated`.
- **`/dev/farms-check` changes:**
  - OSM buildings now come from the OSM API 0.6 bbox call (about 1 s), because Overpass gave HTTP 504 or took 30-210 s. Overpass is kept as a fallback.
  - New **relief grid** metric (no OSM needed).
  - **Numbers only (fast)** mode: fly in, wait for tiles, sample, no dwell. About 1.5 min per site instead of 3.
  - `window.__ftFarmsCheck.run(ids)` / `view(id, range, pitch)` / `cam()` hooks for scripted checks.
- **Screenshots:** 10 oblique PNGs in `docs/farm-scouting/<id>-oblique.png`, about 1000 px wide and under 400 KB.
- **Tests:**
  - `lib/scouting/check.test.ts` is new.
  - `candidates.test.ts`: pins = `pinned.ts`, all `pass`.
  - `farms.test.ts`: dev pages may import the candidate list.
  - `FarmCard.test.tsx`: HTML-escaped `&` in farm names.

## Did the numeric method work?

Mostly yes.
- **Controls:** relief on Cayuga Lake water read 0 % (flat), and Cornell read 25 % / p90 11.8 m.
- **Cornell building metric:** could not be checked, because OSM maps only 1 building near the pin.
- **Agreement with screenshots:** every farm with a high building share (53-95 %) looked 3D in its screenshot.
- **Detail proxy:** the smallest tile geometric error was unreliable. It read 4109 m at Reckenholz, which looked sharp.
- **Rejected without screenshots:** the four 0-22 % farms were dropped on numbers alone, as the funnel prescribes.

## Screenshot budget

12 taken:
- 10 obliques, used for the verdicts.
- 2 top-downs of WUR, unusable. At pitch -89° the farm-view orbit puts the camera underground, and a direct camera set is reset to -30° by the orbit. So no top-down shots exist. This is a farm-view camera bug for the later review routine (`components/globe/Globe.tsx` `setCamera` / `orbitFromCamera`).

## How to run

- `apps/web`: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test`.
  - Typecheck: clean.
  - Lint: 0 errors. The 2 warnings in `GlobeHome.tsx` predate this work.
  - Tests: 374/374 pass.
- **Check more farms:**
  1. `corepack pnpm dev`, then open `/dev/farms-check`.
  2. In the console, run `window.__ftFarmsCheck.run(["imidra-encin", ...])`, or press **Numbers only (fast)** to check all sites.
  3. For each site worth keeping, take one oblique shot. If it passes, set `validation: "pass"` and add the farm to `pinned.ts`.

## Known gaps

- Pins are approximate (`coordsVerified: false`). Most were cross-checked against OSM Nominatim (within about 1 km).
  - Helsinki: pin is on the campus buildings, not the fields.
  - Waite: pin is on woodland; trial plots lie about 400-500 m NE.
  - UIUC: the barns are north of the pin.
  - Move these pins with `/dev/trace` (Copy framing).
- Dataset URLs for the pinned farms all answered HTTP 200 on 2026-11-14. The licence wording is still from search results (`TODO(verify)` where marked).
- The Google Map Tiles policy page was not read in this session (user's decision). The open question about height sampling as "derived" content remains.
- Crops on the new farms are not modelled: they are explore-only, with no twin.

## Full twins first (ranked)

1. `wur-unifarm`: AHN 0.5 m lidar (CC0), BRP crop parcels (CC0), sharp 3D.
2. `ubc-farm`: CanElevation HRDEM, dense 3D.
3. `agroscope-reckenholz`: swissALTI3D, arable trials beside 3D farm buildings.
4. `hokudai-farm`: large fields, sharp 3D, cold climate.
5. `uiuc-south-farms`: USGS 3DEP 1 m, Corn Belt; move the pin to the barns first.

## When done, tell

Frontend owners (Track owners table in `Prompts.md`):
- The globe now has 12 pins.
- The registry reads `lib/farms/pinned.ts`.
- Do not hard-code farm counts: use `FARMS.length`.
