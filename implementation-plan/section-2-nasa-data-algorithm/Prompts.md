# Section 2 Prompts: NASA data and algorithm (PRD v0.3 build order)

Run in order, one per Claude Code session. S2-01 (kickoff) must be done by both owners before anything else. Each data prompt is tagged **[S2-A]** (data), **[S2-B]** (algorithm), or both.

The prompts follow the build order in PRD §12 (D-36): terrain → storms → hazards → calendars and rotations → recommendations and tables → scenarios → backtest, Lite, seed, offline. **Each prompt ends with the Agassiz farm (D-33) working end to end on real data so far, while every other route keeps serving fixtures.**

Where to find the detail:
- Per-dataset detail (why, access, steps, needs, outputs, fallback): `../Databases.md`, **DB-1 to DB-14**.
- Features: PRD §4.1, **F1 to F44**.
- Schema changes: `../contract-request-v1.1.md`.

Read the sections a prompt names; do not re-derive them.

## Rules for every prompt (Claude reads these once)

1. **Read** in this order, and nothing else unless the prompt lists it:
   - `CLAUDE.md`
   - this folder's `PRD.md` §0, plus the sections the prompt names
   - the `../Databases.md` sections the prompt names
   - the last 3 entries of `progress.md`
2. **Root PRD:** never open it whole. Use `grep -n "### BE-08" prd.md`, then `sed -n '<start>,<end>p' prd.md` for that card only.
3. **Never invent** dataset names, URLs, parameters, variable names, fill values or constants. Look them up, cite the URL in a code comment, or mark `TODO(verify)`. Record each verified fact in `data-sources.md` and in the matching `Databases.md` row.
4. **Contract:** `packages/contracts/openapi.yaml` is the contract (D-31). Never edit it.
   - If a prompt needs a field that isn't there yet, write a contract request (like `../contract-request-v1.1.md`) and implement internally until the integrator applies it.
   - Real responses must pass `fixtures_lib.contract.validate_response`.
5. **Swap points:** replace fixtures only behind the existing swap points in `services/api/app/services/*.py` (`terrain.py`, `weather.py`, `simulations.py`, `sites.py`, `crops.py`). Routes in `routers/` don't change.
6. **New modules** go in `services/api/app/`: `ingest/`, `fusion/`, `calendar/`, `terrain/`, `engine/`, `markers/`.
7. **Engine purity:** `engine/` and `markers/` take arrays and return arrays. No network, file I/O, clock or LLM.
8. **Determinism and offline:** same inputs give byte-identical outputs. With `OFFLINE=1`, ingest refuses the network and reads `data/cache/` or `data/seed/` only.
9. **Secrets and files:** Earthdata credentials live in `.env` only. Never commit `.env`, `data/cache/`, or imagery whose license forbids redistribution.
10. **Honesty:** historical odds and relative comparisons only (D-04, D-23). Every number carries units and a basis label.
11. **Finish** by doing all of these, then stop:
    - run `make test` and show the results
    - list which acceptance items pass or fail
    - append an entry to `progress.md`
    - update `PRD.md` and `../Databases.md` (with a change-log row) if a decision or fact changed

`progress.md` entry format (max 10 lines): `## S2-xx name | date | commit`, then Built / Files / How to run / Gaps / Next prompt must know.

Commit directly to `main` with the prompt ID in the message (e.g. `S2-03: …`). Run `git pull --rebase` before you start and before you push.

---

## S2-01 Kickoff: verify the data (both owners) — step 0

**Goal:** every P0 dataset verified for the Agassiz square, accounts working. No pipeline code.

**Read:**
- `PRD.md` §0, §3, §4.1, §5, §11, §15
- `../Databases.md` fully
- `../contract-request-v1.1.md`
- `../section-1-web-experience-3d-ui/PRD.md` §0 and §7

**Task:**
- (a) Open the **official 2026 challenge page** in a browser and copy its Resources list into `data-sources.md`. Add anything that fits a role in `Databases.md` §1.
- (b) For each P0 row (DB-1 to DB-8) record:
  - exact product name and version
  - variables and units
  - resolution and time coverage
  - access method and **a working sample request URL**
  - license and attribution text
  - rate limits
  - coverage of the Agassiz square (49.2482, −121.7637)
- (c) Confirm **LidarBC coverage** of the square (open item 1).
- (d) Verify the **IMERG half-hourly** product name and access (D-35, open item 14).
- (e) Decide **SMAP L4 vs L3** (DB-5).
- (f) Create Earthdata accounts, run one real download each, and write `.env.example` with variable names only.
- (g) Confirm the **Nov 2021** event dates. Check whether its flooding reached the Agassiz square; if not, pick a Sumas Prairie backtest square (open item 15).
- (h) Define the 3 curated rotations with the owner. Reuse the contract IDs `rot_existing`, `rot_cover`, `rot_forage` that Section 1 already uses.
- (i) Write `prior-art.md` from PRD §13.

**Done when:**
- every P0 row is verified with a sample request, or has a drop reason and a fallback
- `data-sources.md`, `prior-art.md` and `.env.example` exist
- open items 1–5, 7, 11, 13–15 are resolved or assigned
- `progress.md` entry appended

## S2-02 Contract hand-off and engine skeleton [S2-B] — step 0

**Read:**
- `PRD.md` §6.1, §9, §10
- `../contract-request-v1.1.md`
- `packages/contracts/README.md`
- `services/api/app/services/*.py` (signatures only)

**Task:**
- Walk the integrator through `../contract-request-v1.1.md` and agree any edits. Record the outcome in `progress.md`. The integrator applies it; you don't.
- Create the empty module packages from rule 6, each with one test.
- Write `engine/hazard.py` and `engine/exposure.py` skeletons with the **invariant tests** from PRD §10, on tiny synthetic arrays.

**Done when:**
- the contract request is acknowledged by the integrator
- the invariant tests pass on synthetic data
- `make test` is green

## S2-03 Real terrain for Agassiz [S2-A] — step 1 (F1–F4, F9)

**Read:**
- `PRD.md` §6.4
- `../Databases.md` DB-1, DB-2
- root cards BE-01 and BE-04
- `packages/contracts/fixtures_lib/terrain.py` (reuse helpers)
- contract `TerrainPackage`, `LayerName`, `LayerLegend`

**Task:**
- Write the terrain adapter: LidarBC for Agassiz, NASADEM as fallback and for Lite. Steps: clip the `sim_bbox` plus a buffer, reproject, resample to the grid agreed with S1-A (open item 12).
- Compute: priority-flood fill, slope, D8, flow accumulation, depressions, and **TWI**.
- Produce the layer PNGs and legends: `slope`, `flow_accumulation`, `depressions`, plus `wetness_index` once v1.1 lands.
- Serve the real package through `services/terrain.py` for `terr_agassiz`, setting `dsm_includes_vegetation` where relevant. Every other terrain id stays on fixtures.

**Done when:**
- synthetic tilted-plane, bowl and ridge-valley tests pass
- Agassiz drainage follows visible ditches
- the package validates against the contract and loads in Section 1's viewer
- the license for redistributing the derived products is confirmed

## S2-04 Weather ingestion: POWER, IMERG, SMAP [S2-A] — step 2a

**Read:**
- `../Databases.md` DB-3, DB-4, DB-5, §3
- `PRD.md` §6.2, §8
- `data-sources.md`

**Task:**
- Write three cache-first ingest modules: `ingest/power.py`, `imerg.py` and `smap.py`.
- Download IMERG **daily and half-hourly** (D-35) for the farm's cells.
- Cache raw files in `data/cache/`. Log request URLs. Retry with backoff.
- Replace the verified fill values with missing and report the missing share.
- With `OFFLINE=1`, refuse network calls and read the cache only.
- Pre-download everything for Agassiz now (D-03).

**Done when:**
- daily tables exist for Agassiz, plus half-hourly IMERG for 2000 onward
- a test with the network blocked still loads from cache
- sample requests are recorded

## S2-05 Real storm library and storm replay [S2-A + S2-B] — step 2b (F11, F15, F22)

**Read:**
- `PRD.md` D-34, D-35
- root cards BE-06 and BE-08
- `services/api/app/services/weather.py` and `simulations.py`
- contract `Storm`, `SimulationRequest`, `RotationResult`, `Metrics`
- `packages/contracts/fixtures_lib/ftw1.py` (format only)

**Task:**
- **Storm library:**
  - rolling 1–3 day totals
  - the top **8** distinct storms, at least 7 days apart, 1981 onward, plus **Nov 2021**
  - for each storm: rank, `rank_of`, antecedent wetness, `named_event`
  - the hyetograph from IMERG half-hourly (`synthetic: false`) for storms from 2000; the assumed profile for older storms
- **Simulation engine:** SCS-CN runoff with an antecedent adjustment, D8 time-stepped routing with ponding, a relative erosion index, about 60 FTW1 frames, a risk PNG and metrics, all on the real Agassiz terrain.
- **Caching and serving:** cache by input hash. Serve through `services/weather.py` and `services/simulations.py` for Agassiz.
- New `Storm` fields wait for v1.1; keep them internal until it lands.

**Done when:**
- a ranking test on a synthetic series with known events passes
- the BE-08 invariant tests pass
- the three rotations differ visibly on at least two real storms
- the frames decode with Section 1's FTW1 reader
- the Section 1 storm replay plays a real Agassiz storm

## S2-06 Fusion, hazard calendar, hazard catalog, climate fingerprint [S2-B] — step 3 (F10, F12–F14, F16)

**Read:**
- `PRD.md` §6.2, §6.7 (trends only)
- `../Databases.md` DB-3, DB-4, DB-5
- contract-request §3 and §4 (`HazardCalendar`, `HazardCatalog`, `climatology`)

**Task:**
- **Fusion:** per-season quantile mapping, POWER→IMERG for rain and POWER→SMAP for wetness, with before/after diagnostics.
- **Thresholds:** site percentiles.
- **Hazard calendar:** the `wet_hit` and `dry_hit` matrices, then `J_wet[52]` and `J_dry[52]` (the joint count, not a product), with circular smoothing.
- **Hazard catalog:** `heavy_rain_wet_ground`, `multi_day_heavy_rain`, `dry_spell`, `heat_spell`, `late_frost`. Each gets years with an event out of years total, peak weeks, and its worst storm id. Heat and frost thresholds are site percentiles, labeled `assumed`.
- **Climatology:** weekly medians and p90 for rain, weekly medians for tmin and tmax, and growing-season stats (state the GDD base).
- **Trends:** Theil-Sen on the wet and dry indices.
- Write `hazard.json`. Serve the new endpoints once v1.1 lands, and extend `/weather/summary` for Agassiz.

**Done when:**
- the 95th and 99th rain percentiles move closer to IMERG after mapping
- raising `q_rain` never raises `J_wet` (test)
- the fallback path is tested
- the output is deterministic

## S2-07 Crop calendars from HLS and AAFC [S2-A] — step 4a (F6–F8)

**Read:**
- `PRD.md` §6.3, §6.5
- `../Databases.md` DB-6, DB-7, DB-8

**Task:**
- Clip the AAFC crop inventory to field patches (`fields.geojson`), and compare them with Section 1's OSM field outlines for Agassiz.
- Sample HLS: windowed reads, quality mask, NDVI, weekly median across years, gap-fill, and a **valid-observation count per week**.
- Compute `Bare_crop[52]` and the stage dates. Fall back to a textbook calendar, labeled `assumed`, where data is too thin.
- Write FAO-56 Kc values with table references into `data/reference/fao56_kc.json`. S2-B reviews every value.
- Produce `cover_class` for Agassiz and the real cover calendars behind `services/crops.py`.

**Done when:**
- median green-up and harvest weeks fall inside the agronomic windows you cite
- observation counts are reported
- every Kc value has a source
- no imagery is committed

## S2-08 Rotation comparison, bootstrap, sensitivity [S2-B] — step 4b (F18, F21)

**Read:**
- `PRD.md` §6.1, §6.6, §10
- contract-request §4 (`RotationComparison`)
- S2-06 and S2-07 progress entries

**Task:**
- Build rotation calendars from the crop calendars.
- Compute `WinterExposure` and `SummerExposure` per rotation and zone, keeping the 52-week products.
- Year bootstrap: B = 1000, with the seed derived from the input hash. It gives ranges and rank stability.
- One-at-a-time sensitivity over the parameters listed in §6.6.
- Write `exposure.json`, `bootstrap.json` and `sensitivity.json`, plus the table in `algorithm.md`.
- Serve `GET /sites/{id}/compare` once v1.1 lands.

**Done when:**
- all §10 invariants pass on real tables
- the same seed gives identical bytes
- the sensitivity table names any assumption that flips a ranking

## S2-09 Zones, recommendations, analytics [S2-B, with S2-A] — step 5 (F5, F17, F24–F32)

**Read:**
- `PRD.md` §6.4 (zones), §6.8, §7, §9.2
- contract-request §4 (`Zone`), §5 (`Insight`) and §6 (layers)

**Task:**
- **Zones:** 0.5–2 ha zones clipped to fields, with the terrain factor `T(z)`, icon points and outlines. Serve them on `GET /sites/{id}/zones`.
- **Optimizer:** the bounded optimizer from §6.8 produces `opportunity` pins (F24, F27, F28).
- **Pin classification:** `winter_wet`, `summer_dry`, `protected` (F29). Merge neighbouring pins, score them, cap at 5, and attach `active_weeks`.
- **Text:** template text only. The "why?" payload carries sources and caveats.
- **Layers:** `planting_suitability` (F25, P0), then `irrigation_priority`, `water_received` and `soil_moisture_relative` (P1).
- **Serving:** serve pins through `GET /terrain/{id}/insights`.

**Done when:**
- every pin number equals a value in `exposure.json`
- there is at least one `opportunity` pin on Agassiz
- no text makes an absolute guarantee
- runtime calls take under 1 s
- the support-not-replace line is present

## S2-10 Field Shift scenarios [S2-B] — step 6 (F19; groundwork for F20, F23, F39)

**Read:**
- `PRD.md` §6.7
- contract-request §7

**Task:**
- Compute per-year wet and dry indices, Theil-Sen trends with confidence intervals, and importance-weighted analog years for `baseline`, `wetter_winters`, `drier_summers` and `both`.
- Add a "trend not significant" flag.
- Thread `scenario` through the hazard calendar, compare, pins and simulations.
- Write `scenarios.json`.
- Write a v1.2 contract request for the what-if builder (F20) and the season challenge (F39) if time allows.

**Done when:**
- scenario exposures are monotonic and sane in tests
- every scenario response says "built from observed years, not a forecast"

## S2-11 Backtest and Lite mode [S2-A + S2-B] — step 7a (F15 evidence, F41)

**Read:**
- `PRD.md` §6.9, §10
- `../Databases.md` DB-2, DB-3, DB-6, DB-10, DB-12

**Task:**
- **Backtest:** build the Nov 2021 observed mask from the HLS water index (where cloud allows), SMAP change, and RADARSAT only if open access is confirmed. Score `winter_wet` zones by hit rate and IoU **against an area-matched random baseline**, and report the result as is.
- **Lite mode** for the `tier: explore` sites: live POWER (cached per location), NASADEM terrain and zones, a textbook calendar, no fusion or bootstrap, and "Lite mode: fewer data sources" in every caveat. Write the v1.2 request for a dropped-pin endpoint.

**Done when:**
- `backtest.json` and an honest write-up exist
- every explore pin returns terrain, storms and pins within the interactive budget
- Lite never shows rank stability

## S2-12 Seed, offline, provenance, write-up [S2-A + S2-B] — step 7b (F34)

**Read:**
- `PRD.md` §8, §12
- `../Databases.md` §3, DB-13, DB-14

**Task:**
- **`make seed`** builds `data/seed/agassiz/`: terrain, layers, storms, simulations, hazards, calendars, exposure, bootstrap, scenarios, pins and provenance. Sites 2 and 3 follow if time allows.
- **Provenance test:** it fails if any dataset in a seed table (or a DB-14 visual source) is missing from provenance or lacks license and attribution.
- **Offline test:** run with `OFFLINE=1` and the network blocked.
- **Smoke script:** end to end.
- **Write-up:** a one-page "How we use NASA data", accurate to the code, plus the not-used list from `Databases.md` §4.

**Done when:**
- with the network off, Agassiz completes the full journey from globe to farm, storm, pins and compare
- the smoke script passes from a clean checkout
- both owners and the integrator have reviewed the write-up
