# Section 2 Prompts: NASA data and algorithm (PRD v0.3)

Two people work **in parallel lanes** and never wait on each other:

- **Lane A (Data, S2-A):** download, cache, clean and derive tables.
- **Lane B (Algorithm, S2-B):** turn tables into hazards, exposures, pins and scenarios.

The lanes meet only through **seed tables** whose schemas B freezes in the first hour (S2-B1). B builds every step on **synthetic tables** first, then re-runs it on A's real tables when they land. A never needs B's code to produce its tables.

## How to run a prompt (paste this, nothing more)

```text
Run prompt S2-XX. Read implementation-plan/section-2-nasa-data-algorithm/Prompts.md: only "Shared rules" (sed -n '/^## Shared rules/,/^## Lane owners/p') and the S2-XX card (sed -n '/^### S2-XX /,/^##/p'). Follow them.
```

Replace `XX` with the card ID. Use one fresh session (`/clear`) per card. If a card says "split", run each part in its own session.

## Shared rules

**R1 STEP 0 (coordination).** Read the Lane owners table below. Print three lines:
- `PULL`: run `git pull --rebase`.
- `NEEDS`: for each ID in the card's **Needs**, check `ls docs/progress/s2-<id>.md`. A missing hard need → name its owner and STOP. A missing soft need (marked `~`) → continue on synthetic tables.
- `TELL`: the owners named in the card's **Tell**.

**R2 Read budget.** Read only `CLAUDE.md`, the card's **Read** list, and the progress notes of the card's **Needs**. For large docs, grep for the heading and read that range only:
- root `prd.md` card: `grep -n "### BE-08" prd.md`, then `sed -n 'a,bp'`
- `../Databases.md` row: `sed -n '/^#### DB-3/,/^#### /p'`
- this folder's `PRD.md` section: `sed -n '/^### 6.2/,/^### /p'`
- contract schema: `grep -n "  Storm:" packages/contracts/openapi.yaml`, then read ~40 lines

For code, read signatures before bodies (`grep -n "def \|class "`). Never read the whole repo, `Prompts.md`, root `prd.md` or `openapi.yaml`.

**R3 Ownership.** Edit only the paths in the card's **Owns**, plus your own `docs/progress/s2-<id>.md`, tests next to them, and dependency lines in `services/api/pyproject.toml`. If you need another lane's file changed, say so in your progress note and in TELL.

**R4 Facts.** Never invent dataset names, URLs, parameters, variable names, fill values, licenses or constants. Look each one up on the web and cite the URL in a code comment and in `data-sources.md`. If you can't verify it, write `TODO(verify)` and pick the card's **Fallback**.

**R5 Contract.** `packages/contracts/openapi.yaml` is the contract (D-31). Never edit it.
- v1.1 fields not yet applied: compute them, keep them internal, and serve only the v1.0.0 shape.
- New needs: append a `## <feature>` section to `implementation-plan/contract-request-v1.2.md` (create the file if missing; never edit another lane's section).
- Every served response must pass `fixtures_lib.contract.validate_response`.

**R6 Swap points.** Real data replaces fixtures only inside `services/api/app/services/*.py`, and only for the Agassiz ids (`site_agassiz`, `terr_agassiz`; use the ids the integrator applied in v1.1 if they differ). Every other id keeps serving fixtures. Routers don't change unless the card adds a v1.1 route.

**R7 Tables, not imports.** Lane A writes tables; lane B reads them. Neither imports the other's ingest or engine internals.
- All seed I/O goes through `services/api/app/tables.py` (`load(site, name)`, `save(site, name, obj)`, `has(site, name)`).
- Real tables live in `data/seed/<site>/`. Synthetic tables live in `data/synth/<site>/` and are used **only by tests**, never served.

**R8 Purity and determinism.** `engine/` and `markers/` take arrays and return arrays or dicts: no network, file I/O, clock or LLM. Seeds come from a hash of the inputs. JSON is written with sorted keys and fixed float rounding. The same inputs give byte-identical outputs.

**R9 Offline and secrets.** With `OFFLINE=1`, ingest code raises on any network call and reads `data/cache/` or `data/seed/` only. Credentials live in `.env` only. Never commit `.env`, `data/cache/`, or raw imagery whose license forbids redistribution (ship derived tables instead).

**R10 Honesty.** Outputs are historical odds and relative comparisons, never forecasts (D-04, D-23). Every number has units and a basis label (`measured | derived | modeled | assumed | relative`). Text is templated, never LLM-written. No yield, profit or absolute soil-loss figures.

**R11 Finish** (in this order, then stop):
1. Run the tests (`make test`, or `cd services/api && uv run pytest -q` while iterating) and show the result.
2. Tick each **Done when** item: pass or fail.
3. Write `docs/progress/s2-<id>.md` (≤ 12 lines): Built / Files / How to run / Gaps / Next must know / Contract requests.
4. If a decision or fact changed, edit `PRD.md` or `../Databases.md` and add a change-log row.
5. Commit to `main` as `S2-<id>: …`, then `git pull --rebase` and push.
6. Print the TELL message, ready to paste.

**R12 Blocked?**
- **On the other lane:** keep going on synthetic tables (R7) and write "re-run on real when <id> lands" in your progress note.
- **On the contract:** compute the data, keep it internal, and ping the integrator (R5).
- **On data access:** take the card's **Fallback**, label it in the caveats, and tell the other lane.
- **Over time:** P0 first, in PRD §12 order. The stretch cards (A9, B8) run only after the freeze checks pass.

## Lane owners (fill in names; Claude reads this table)

| Lane | Owner | Contact |
| --- | --- | --- |
| A Data (S2-A) | ___ | ___ |
| B Algorithm (S2-B) | ___ | ___ |
| Integrator | ___ | ___ |
| S1-A Rendering | ___ | ___ |
| S1-B Product UI | ___ | ___ |

---

## Plan at a glance

### Order and cross-lane needs

- **Lane A:** A1 → A2 terrain → A3 weather → A4 fields + HLS → A5 zones → A6 backtest obs → A7 Lite → A8 seed/offline → A9 stretch
- **Lane B:** B1 schemas → B2 storms + sim → B3 hazards → B4 exposure → B5 pins → B6 scenarios → B7 backtest + write-up → B8 stretch
- **Hard needs across lanes:**
  - A7 and A8 need B5 (the entry point)
  - every B card needs B1 (the schemas)
- **Soft needs** (B runs on synthetic tables until they land):
  - B2 ~A2, ~A3
  - B3 ~A3
  - B4 ~A4
  - B5 ~A5
  - B7 ~A6

### Schedule (event: Sat Nov 14 09:00 to Sun Nov 15 23:59; pre-building allowed, D-03)

| When | Lane A | Lane B | Sync point (both + integrator, 10 min) |
| --- | --- | --- | --- |
| Day −2 | A1, A2 | B1, B2 (synthetic) | End of B1: table schemas frozen; contract v1.1 handed to the integrator |
| Day −1 | A3 (start bulk downloads first), A4 | B2 on real terrain, B3 | A2 + A3 merged → B re-runs B2 and B3 on real tables |
| Sat AM | A4 finish, A5 | B4 | A4 merged → B4 on real calendars |
| Sat PM | A6, A8 (first pass: Agassiz seed) | B5 | **Section 1 swaps Agassiz to live** (S1-14) |
| Sun AM | A7 | B6, B7 | Backtest number agreed; write-up drafted |
| Sun PM | A8 final, A9 if time | B7 final, B8 if time | **Freeze at Sun 21:00**; offline rehearsal |

### Feature coverage (backend side of PRD §4.1)

| Prompt | Features | DB |
| --- | --- | --- |
| A2 | F1, F2, F3 (layer), F4, F9 | DB-1, DB-2 |
| A4 | F6, F7 (table), F8 | DB-6, DB-7 |
| A5 | zones (F30 data), F5, F17 | DB-1, DB-5, DB-4 |
| A6 | F15 (observed evidence) | DB-6, DB-5, DB-10 |
| A7 | F41 | DB-2, DB-3 |
| A8 | F34, F36 (sources), F42 (sites 2–3) | DB-13, DB-14 |
| A9 | F43, DB-11 | DB-9, DB-11 |
| B2 | F11, F13 (worst-storm replay), F15 (story storm), F22 | DB-3, DB-4 |
| B3 | F10, F12, F13, F14, F16 | DB-3, DB-4, DB-5 |
| B4 | F18, F21 (table), F31, F32 (data) | DB-6, DB-8 |
| B5 | F3 (pin), F24, F25, F26, F27, F28, F29, F30, F36 | engine |
| B6 | F19, F20, F23 (inputs), F39 (data) | engine |
| B7 | G3 validity, F15 score, write-up | DB-10 |
| B8 | F44, `M(z)` | engine |

FE-only items (F33, F35, F38, F40) and F37 (cell footprints) are Section 1's. F37 needs only a v1.2 request, written in A8.

---

## Lane A: Data

### S2-A1 Verify data, open accounts, start downloads

- **Needs:** none. **Tell:** B (verified names and units), integrator (accounts and licenses).
- **Read:** `PRD.md` §0, §5, §11, §15; `../Databases.md` §1 Table 1, §5, and the DB-1…DB-8 rows; `PRD.md` §13.
- **Owns:** `implementation-plan/section-2-nasa-data-algorithm/data-sources.md`, `prior-art.md`, `.env.example`, `../Databases.md` (verified facts only).
- **Do:**
  1. Open the official 2026 challenge page (URL in PRD §0). Copy its Resources list into `data-sources.md`. Flag any listed dataset that fits a DB role better than ours.
  2. For DB-1…DB-8, record in `data-sources.md`:
     - product name and version
     - variables and units
     - resolution and coverage
     - access method and a **working sample request URL**
     - license and attribution text
     - rate limits
     - whether it covers the Agassiz square (PRD §11)
  3. Resolve these open items:
     - #1 LidarBC coverage
     - #4 Nov 2021 dates
     - #5 RADARSAT access
     - #11 SMAP L4 vs L3 (agree with B)
     - #14 IMERG half-hourly short name
     - #15 whether the backtest square is Agassiz or Sumas Prairie
  4. Create Earthdata accounts and run one real download per Earthdata product. Write `.env.example` with variable names only.
  5. Write `prior-art.md` from PRD §13 (5–8 entries; add any new public entries for this challenge you find).
  6. Start the long downloads now, in the background: POWER 1981→present, IMERG daily (and half-hourly around the top-rain days if the volume is too large), SMAP, HLS tiles. Write them into `data/cache/` with a `scripts/s2_download.sh` (owned here) that is resumable.
- **Fallback:** a product that can't be verified gets a drop reason and the fallback named in its DB row.
- **Done when:**
  - every DB-1…DB-8 row is verified or has a drop reason
  - the three files exist
  - the open items above are resolved or assigned with an owner
  - downloads are running

### S2-A2 Real terrain package for Agassiz (step 1)

- **Needs:** A1. **Tell:** S1-A (grid and package ready), B (`terrain` table ready).
- **Read:** `PRD.md` §6.4 items 1–2; DB-1, DB-2; root cards BE-01 and BE-04; `packages/contracts/fixtures_lib/terrain.py` and `encoding.py` (signatures); contract `TerrainPackage`, `LayerName`, `LayerLegend`; `services/api/app/services/terrain.py`.
- **Owns:** `services/api/app/ingest/dem.py`, `services/api/app/terrain/`, `services/api/app/services/terrain.py` (Agassiz branch only), `data/seed/agassiz/terrain/`.
- **Do:**
  1. DEM adapter: LidarBC for Agassiz with NASADEM as the fallback (the fallback is also Lite's path). Clip `sim_bbox` plus a buffer, reproject, and resample to the grid agreed with S1-A (open item #12; until it's agreed, use the grid size of the existing fixture).
  2. Hydrology, in `terrain/`, as pure functions on arrays: priority-flood fill, slope, aspect, D8, flow accumulation, depression depth, `TWI = ln(a / tan β)` (guard against flat cells and record the guard value).
  3. Layer PNGs and legends using the contract encodings: `slope`, `flow_accumulation`, `depressions` (v1.0.0), plus `wetness_index` (internal until v1.1).
  4. Save the `terrain` table through `tables.save` (arrays + transform + CRS + stats).
  5. Serve the package for `terr_agassiz` through `services/terrain.py`, with `dsm_includes_vegetation` set honestly. Add a provenance entry per source.
  6. Make `get_layers` and the layer PNG route serve **any** layer found in `data/seed/agassiz/terrain/layers/` (`<name>.png` + `<name>.legend.json`), and expose `terrain.layers.write(site, name, array, legend)`. Later cards (A4, A5, B5) then only drop files and never edit `services/terrain.py` for layers.
- **Fallback:** if LidarBC doesn't cover the square, use NASADEM and add the caveat "30 m terrain" to the provenance.
- **Done when:**
  - tilted-plane, bowl and ridge–valley tests pass (flow direction, fill depth, TWI ordering)
  - Agassiz drainage follows visible ditches in a hillshade PNG saved to `docs/`
  - the package validates and loads in Section 1's viewer
  - the license for redistributing derived terrain is recorded

### S2-A3 Weather ingestion: POWER, IMERG, SMAP (step 2a)

- **Needs:** A1. **Tell:** B (`weather_daily` real; it replaces synthetic in B2 and B3).
- **Read:** DB-3, DB-4, DB-5; `../Databases.md` §3; `PRD.md` §6.2 item 1; `data-sources.md` rows for those three.
- **Owns:** `services/api/app/ingest/{power,imerg,smap,_http}.py`, `data/seed/agassiz/weather_*`.
- **Do:**
  1. One cache-first module per source over a shared `_http.py`: httpx, retry with backoff, request-URL log, and an `OFFLINE=1` guard.
  2. Replace verified fill values with NaN and report the missing share per variable.
  3. Area-average IMERG and SMAP over the POWER cell footprint, and also keep the farm's own cell.
  4. Write the table `weather_daily` with columns per B1's schema, dated 1981→present: POWER rain, tmin, tmax, wetness; IMERG rain from 2000; SMAP from 2015. Add a `units` and `source` map.
  5. Write `weather_30min` as IMERG half-hourly windows of ±3 days around every candidate storm day (the top 30 days by 3-day total from 2000; B2 picks from these).
- **Fallback:**
  - IMERG doesn't cover 49°N, or can't be downloaded: the rain columns stay POWER-only, and B is told to skip rain fusion.
  - SMAP fails: wetness stays POWER-only, with a caveat.
- **Done when:**
  - both tables exist for Agassiz
  - a network-blocked test still loads from cache
  - missing shares and sample URLs are recorded in `data-sources.md`

### S2-A4 Fields, crop map and measured HLS calendars (step 4a)

- **Needs:** A1, A2. **Tell:** B (`calendars` and `fields` real), S1-B (field labels).
- **Read:** `PRD.md` §6.3; DB-6, DB-7; `services/api/app/services/crops.py` (signatures).
- **Owns:** `services/api/app/ingest/{hls,aafc}.py`, `services/api/app/calendar/`, `data/seed/agassiz/{fields.geojson,calendars.json,ndvi_history.json}`, the `cover_class` layer.
- **Do:**
  1. Clip the AAFC inventory to the square, for every year available. Vectorize it into `fields.geojson` (crop per field per year). Compare the result with Section 1's OSM field outlines, and note any mismatch.
  2. Pick up to N same-class fields nearby (same climate) per crop. Do windowed HLS reads, apply the quality mask, compute NDVI, take the weekly median across years, and gap-fill linearly. Keep a **valid-observation count per week**.
  3. Per crop, store `bare[52]` (NDVI < `τ_bare`; get `τ_bare` from B1's defaults, cite it) and the stage dates (green-up, peak, senescence, harvest).
  4. A crop with too few observations falls back to a textbook calendar, labeled `assumed`, with its source cited.
  5. Write `ndvi_history.json` (per field, about 10 years) for F7. Add a v1.2 request section for F7.
  6. Render the `cover_class` layer for Agassiz.
- **Fallback:** if HLS can't be fetched in time, every crop uses the textbook calendar (`assumed`), and the caveat goes into `calendars.json`.
- **Done when:**
  - median green-up and harvest weeks fall inside cited agronomic windows
  - per-week observation counts are stored
  - no imagery is committed

### S2-A5 Zones, terrain factor inputs and water layers (step 5a)

- **Needs:** A2, A4 (soft: if A4 isn't merged, use Section 1's OSM field outlines). **Tell:** B (`zones` real), S1-A (outlines and icon points).
- **Read:** `PRD.md` §6.4 items 3–6; DB-5 (redistribution); contract-request §4 (`Zone`) and §6 (layers).
- **Owns:** `services/api/app/terrain/zones.py`, `services/api/app/fusion/downscale.py`, `data/seed/agassiz/zones.geojson`, the layers `soil_moisture_relative` and `water_received`.
- **Do:**
  1. Zones: place pour points on the flow network at a target contributing area, delineate sub-catchments, clip them to fields, and merge slivers so zones are 0.5–2 ha. Store per zone: area, mean TWI, a slope–length term, the crop, an icon point (pole of inaccessibility, inside the polygon), and a simplified outline in lon/lat.
  2. F5: SMAP weekly climatology redistributed by TWI within its 9 km cell. Use a relative index only and label it `relative`. State that SMAP is 9 km.
  3. F17: water received per zone per year, as rain plus run-on from upstream flow accumulation (relative). Render both layers with legends.
- **Fallback:** if zone delineation is unstable, use a regular grid of ~1 ha cells clipped to fields (`caveat: grid zones`).
- **Done when:**
  - zone sizes fall in range
  - every icon point is inside its polygon
  - zones follow drainage on the curated site
  - the layers validate against the v1.1 legend shapes

### S2-A6 Backtest observation mask: Nov 2021 (step 7a, data)

- **Needs:** A1, A2. **Tell:** B (`backtest_obs` ready for B7).
- **Read:** `PRD.md` §10 (backtest row); DB-6, DB-5, DB-10; A1's note on open items #4 and #15.
- **Owns:** `services/api/app/ingest/backtest.py`, `data/seed/<backtest_site>/backtest_obs.*`.
- **Do:** build the observed wet/flooded mask on the zone grid for the event window:
  - an HLS water index on clear-sky scenes before and after the event
  - the SMAP change, as a coarse sanity check
  - RADARSAT only if A1 confirmed open access
  - per pixel: the source, the date, and a cloud-confidence value
- **Fallback:** if no scene is usable, write `backtest_obs` with `status: "no usable observation"` and the reason. B7 reports it honestly.
- **Done when:** the mask exists or the documented no-data status does, and the sources and dates are listed.

### S2-A7 Lite mode for explore pins (step 7, F41)

- **Needs:** A2, A3, B5 (the engine entry point). **Tell:** S1-B, integrator (the v1.2 Lite endpoint request).
- **Read:** `PRD.md` §6.9; DB-2, DB-3; `PRD.md` §11 (the explore-pin row); B5's progress note (the entry function).
- **Owns:** `services/api/app/lite/`, `data/seed/lite/<site>/`, and the v1.2 section "Lite mode endpoint".
- **Do:**
  1. `lite.build(lon, lat, fields)` runs: live POWER (cached per location), NASADEM terrain → zones (A2/A5 code), the textbook calendar, percentile thresholds, B's pure engine with no fusion or bootstrap, then pins.
  2. Every caveat includes "Lite mode: fewer data sources". `rank_stability` is null.
  3. Pre-build the 7 explore pins into `data/seed/lite/` so they work offline.
  4. Write the v1.2 request for `POST /lite/...` (body: location, field polygons, crop per field; response: same shapes, `mode: "lite"`).
- **Done when:**
  - each explore pin returns terrain, storms and pins within the interactive budget (cached < 1 s; a cold live fetch is reported)
  - Lite never shows rank stability

### S2-A8 Seed, offline, provenance, smoke test (step 7b, F34)

- **Needs:** A2–A5, B5. Run it first on Sat PM, again at the freeze. **Tell:** everyone (seed ready; offline rehearsal time).
- **Read:** `PRD.md` §8; `../Databases.md` §3, DB-13, DB-14; root card BE-11 or BE-12 (grep for "OFFLINE").
- **Owns:** `scripts/s2_seed.py`, the `seed` target in `Makefile`, `scripts/smoke_s2.sh`, `data/seed/agassiz/provenance.json`, `services/api/tests/test_offline.py`, `test_provenance.py`, and the v1.2 section "F37 cell footprints".
- **Do:**
  1. `make seed` rebuilds everything in `data/seed/agassiz/` from `data/cache/` in pipeline order, calling each lane's entry functions. Never fetch here.
  2. `provenance.json`: every dataset in any seed table plus the DB-14 visual sources, each with source, license, attribution and URL. A test fails if one is missing.
  3. Offline test: block sockets, set `OFFLINE=1`, and walk every Agassiz route.
  4. Smoke script: clean checkout → `make seed` (from the committed seed, or skip) → `make dev` → curl the full journey (sites → terrain → storms → simulation → hazards → compare → insights).
  5. Write the F37 cell-footprint v1.2 request: the POWER, IMERG and SMAP cell polygons and HLS pixel size, derived from the tables.
  6. If time: sites 2–3 (F42), using the same pipeline with NASADEM.
- **Done when:**
  - network off + `OFFLINE=1` → the Agassiz journey completes
  - the smoke script passes from a clean checkout
  - the provenance test passes
  - the seed is byte-identical on a rerun

### S2-A9 Stretch (only after A8 passes): ECOSTRESS check, soil texture

- **Needs:** A8. **Tell:** B.
- **Read:** DB-9, DB-11.
- **Owns:** `services/api/app/ingest/{ecostress,soil}.py`, `data/seed/agassiz/{ecostress,soil}.json`.
- **Do:**
  - F43: ECOSTRESS ET summary over summer-dry zones. It is an independent check and never feeds a score.
  - Soil hydrologic group per zone, as an optional `T(z)` modifier input.
  - A v1.2 section for each.
- **Done when:** the tables exist with provenance, and nothing in the P0 path changed.

---

## Lane B: Algorithm

### S2-B1 Table schemas, synthetic tables, contract hand-off, engine skeleton (step 0)

- **Needs:** none. Run it in parallel with A1, in the first hour. **Tell:** A (schemas frozen; file names), integrator (contract v1.1 walkthrough).
- **Read:** `PRD.md` §0, §6.1, §6.2 item 4, §8, §10; `../Databases.md` §3; `../contract-request-v1.1.md` (headings, then §4); `packages/contracts/README.md`; `services/api/app/services/*.py` (signatures).
- **Owns:** `services/api/app/tables.py`, `services/api/app/engine/`, `services/api/app/markers/` (stubs), `services/api/app/{ingest,fusion,calendar,terrain,lite}/__init__.py`, `data/synth/agassiz/`, `scripts/s2_synth_tables.py`, `services/api/app/engine/params.py`, `data/reference/rotations_agassiz.json`.
- **Do:**
  1. In `tables.py`, define Pydantic models for every seed table, then freeze them:
     - `terrain`, `weather_daily`, `weather_30min`, `fields`, `calendars`, `zones`, `hazard`, `exposure`, `bootstrap`, `sensitivity`, `scenarios`, `optimizer`, `pins`, `backtest_obs`, `provenance`
     - each table has: units per field, a `basis`, `sources[]`, `caveats[]`, `version`
     - also write `load`, `save` and `has` (deterministic JSON, R8)
  2. `params.py`: every tunable (`q_rain`, `q_wet`, `n_dry`, `q_dryrain`, `q_drywet`, `τ_bare`, smoothing width, T(z) weights, B, the stability cut-off) with its default, its sensitivity range, its basis, and a citation or `TODO(verify)` (open item #6).
  3. `scripts/s2_synth_tables.py`: writes a deterministic synthetic set to `data/synth/agassiz/`, with known answers (e.g. one obvious wet week, one bare-in-winter rotation, a bowl zone).
  4. Engine skeleton `engine/{hazard,exposure}.py` with the PRD §10 invariant tests on tiny arrays (zero bare → zero winter exposure; adding cover never raises it; raising `q_rain` never raises `J_wet`; non-negative; deterministic).
  5. With the owner, define the 3 curated rotations (open item #7) under the contract ids `rot_existing`, `rot_cover`, `rot_forage`, as crop sequences in `data/reference/rotations_agassiz.json`.
  6. Walk the integrator through `../contract-request-v1.1.md`. Record any agreed edits in your progress note. The integrator applies it; you don't.
- **Done when:**
  - schemas and synthetic tables are committed
  - invariant tests pass
  - `make test` is green
  - A has acknowledged the schemas (any schema change after this needs a ping to the other lane plus a `version` bump)

### S2-B2 Storm library and storm replay on real terrain (step 2, F11, F15, F22)

- **Needs:** B1; ~A2, ~A3 (start on synthetic tables and the fixture terrain, then switch). **Tell:** S1-A and S1-B (real storms and frames for Agassiz).
- **Read:** `PRD.md` D-34, D-35; root cards BE-06 and BE-08; `services/api/app/services/{weather,simulations}.py`; contract `Storm`, `Hyetograph`, `SimulationRequest`, `RotationResult`, `Metrics`; `packages/contracts/fixtures_lib/ftw1.py` (format only).
- **Owns:** `services/api/app/engine/{storms,sim}.py`, the Agassiz branches of `services/{weather,simulations}.py`, `data/seed/agassiz/{storms.json,simulations/}`.
- **Split:** B2a storms; B2b simulation.
- **Do:**
  - **B2a storm library:**
    1. Rolling 1–3 day totals over `weather_daily`.
    2. The top 8 distinct storms (≥ 7 days apart, 1981→present) plus Nov 2021.
    3. Per storm: rank, `rank_of`, antecedent wetness percentile, `named_event`.
    4. Hyetograph from `weather_30min` for storms from 2000 (`synthetic: false`); the assumed profile, cited, for older storms. v1.1 fields stay internal until applied (R5).
  - **B2b simulation:**
    1. SCS-CN runoff with an antecedent adjustment.
    2. D8 time-stepped routing with ponding.
    3. A relative erosion index.
    4. About 60 FTW1 frames, a risk PNG, metrics, and an evidence bundle per rotation (`rot_existing`, `rot_cover`, `rot_forage`).
    5. Cache by input hash. Use a grid-size fallback with a caveat.
    6. CN values per cover class are cited or marked `assumed`.
- **Done when:**
  - a ranking test on a synthetic series with known events passes
  - the BE-08 invariant tests pass
  - the three rotations differ visibly on ≥ 2 real storms
  - frames decode with Section 1's FTW1 reader
  - simulation responses validate

### S2-B3 Fusion, hazard calendar, hazard catalog, climate fingerprint, trends (step 3)

- **Needs:** B1; ~A3. **Tell:** S1-B (hazards and `climatology` ready), A (fusion diagnostics, for the write-up).
- **Read:** `PRD.md` §6.2, §6.7 items 1–2; DB-3, DB-4, DB-5 ("method" lines only); contract-request §3 and §4 (`HazardCalendar`, `HazardCatalog`).
- **Owns:** `services/api/app/fusion/qmap.py`, `services/api/app/engine/{hazard,catalog,climatology,trends}.py`, the summary branch of `services/weather.py`, the new routes in `routers/sites.py` (only once v1.1 is applied), `data/seed/agassiz/hazard.json`.
- **Do:**
  1. Fusion: empirical quantile mapping per season, POWER→IMERG (rain) and POWER→SMAP (wetness), with before/after diagnostics (error at p50, p95, p99).
  2. Thresholds as site percentiles, taken from `params.py`.
  3. The year × week matrices `wet_hit` and `dry_hit` (the joint count, not a product), giving `J_wet[52]` and `J_dry[52]` with circular smoothing.
  4. Catalog: `heavy_rain_wet_ground`, `multi_day_heavy_rain`, `dry_spell`, `heat_spell`, `late_frost`. Each gets years with an event out of years total, peak weeks, and a worst storm id (from B2). Heat and frost thresholds are percentiles, labeled `assumed`.
  5. Climatology (F10, F16): weekly rain median and p90, tmin and tmax medians, frost dates, frost-free days, GDD (state the base).
  6. Trends (F14): Theil–Sen on the yearly wet and dry indices, with a confidence interval and a significance flag.
  7. Extend `/weather/summary` for Agassiz within v1.0.0. Serve `hazard-calendar` and `hazards` once v1.1 lands.
- **Fallback:** if A3 reports no IMERG or SMAP, skip that mapping and add the caveat "not bias-corrected to IMERG/SMAP". The fallback has its own test.
- **Done when:**
  - p95 and p99 rain move closer to IMERG after mapping
  - the `q_rain` monotonicity test passes
  - the fallback is tested
  - output is byte-identical on a rerun
  - the routes validate

### S2-B4 Crop coefficients, rotation calendars, exposure, bootstrap, sensitivity (step 4b)

- **Needs:** B3; ~A4. **Tell:** S1-B (compare ready), A (`exposure` for the seed).
- **Read:** `PRD.md` §6.1, §6.3 item 7, §6.5, §6.6; DB-8; contract-request §4 (`RotationComparison`); `services/api/app/services/crops.py`; the rotation fixtures (`ls packages/contracts/fixtures/rotations`).
- **Owns:** `data/reference/fao56_kc.json`, `services/api/app/engine/{rotations,exposure,bootstrap,sensitivity}.py`, the Agassiz branch of `services/crops.py`, `data/seed/agassiz/{exposure,bootstrap,sensitivity}.json`, the `compare` route (once v1.1 is applied), `implementation-plan/section-2-nasa-data-algorithm/algorithm.md` (create it).
- **Do:**
  1. FAO-56 Kc per crop, with table and row cited. Crops not in FAO-56 get a stated proxy crop, labeled `assumed`.
  2. Rotation calendars for `rot_existing`, `rot_cover`, `rot_forage` (from `data/reference/rotations_agassiz.json`, B1): `Bare_r[52]` and `Sens_r[52]` averaged over the cycle.
  3. `WinterExposure` and `SummerExposure` per rotation × zone, keeping the 52-week products (for F21 and `active_weeks`).
  4. Year bootstrap (B from `params.py`; the seed comes from the input hash): p10–p90 ranges and pairwise rank stability, stored as summaries only.
  5. One-at-a-time sensitivity over every `params.py` range. Record which parameter flips a ranking.
  6. Real cover calendars behind `/rotations/presets` for Agassiz. Serve `compare` once v1.1 lands.
  7. Write `algorithm.md`: the equations, the parameter table, the sensitivity table, and what is ours vs standard (PRD §13).
  8. Write v1.2 sections for F21 (year replay: weekly products per year) and F32 (confidence panel: sensitivity table).
- **Done when:**
  - all §10 invariants pass on real tables
  - the same seed gives identical bytes
  - the sensitivity table names any flipping parameter
  - the bootstrap runs in < 60 s offline

### S2-B5 Pins, optimizer, suitability layers, zone table (step 5)

- **Needs:** B4; ~A5. **Tell:** S1-A and S1-B (pins, zones and layers live), A (the entry point for Lite and the seed).
- **Read:** `PRD.md` §6.4 item 4, §6.8, §7, §9.2; contract `Insight` and its evidence bundle; contract-request §4 (`Zone`), §5, §6; `services/api/app/services/terrain.py` (`get_insights`).
- **Owns:** `services/api/app/engine/{terrain_factor,optimizer}.py`, `services/api/app/markers/`, the insights branch of `services/terrain.py`, the `zones` route (once v1.1 is applied), the layers `planting_suitability` and `irrigation_priority`, `data/seed/agassiz/{optimizer,pins}.json`.
- **Do:**
  1. `T(z)`: rank-normalized TWI and slope–length, weights from `params.py`, field mean = 1, labeled `relative`.
  2. Optimizer over the §6.8 search space. Keep Pareto improvements only (tolerance from `params.py`), rank them by reduction × area, and require stability ≥ the cut-off. Outputs:
     - F24: opportunity pins
     - F27: a buffer strip along flow paths
     - F28: the latest protective cover-crop seeding week, as `active_weeks`
  3. Classify `winter_wet`, `summer_dry`, `opportunity`, `protected` (F29). Merge neighbouring zones, score by severity × area × fixability, cap at 5 (`all=true` returns everything), and attach `active_weeks` (weeks covering 80% of the sum). F3: a ponding-hollow pin from depressions.
  4. Templated text: headline ≤ 60 characters, one action, and the "why?" (metric, value, units, basis, comparison, rank stability, sources, caveats). Always include the support-not-replace line. No absolute claims ("lower relative exposure", never "prevents").
  5. Layers: F25 `planting_suitability` (water-tolerant vs drought-tolerant per zone) and F26 `irrigation_priority`.
  6. Serve pins through `GET /terrain/{id}/insights` (v1.0.0 kinds until v1.1). Expose `markers.build(site, rotation, scenario)` as the single entry point for A7 and A8.
- **Done when:**
  - every pin number equals a value in `exposure.json` or `optimizer.json` (test)
  - Agassiz has ≥ 1 `opportunity` pin
  - a banned-phrase test passes ("prevent", "guarantee", "will", "yield", …)
  - runtime calls take < 1 s
  - responses validate

### S2-B6 Field Shift scenarios and what-if (step 6)

- **Needs:** B5. **Tell:** S1-B (the scenario switch is live), integrator (v1.2 sections).
- **Read:** `PRD.md` §6.7, §6.8 (search space only); contract-request §7.
- **Owns:** `services/api/app/engine/{scenarios,whatif}.py`, `data/seed/agassiz/scenarios.json`, the `scenario` threading in your own service branches (hazard, compare, insights, simulations), and the v1.2 sections for F20 and F39.
- **Do:**
  1. Importance-weight the real years toward the B3 trend, extrapolated by the horizon in `params.py`, giving `baseline`, `wetter_winters`, `drier_summers` and `both`. Nothing is synthesized. Report the effective sample size per scenario.
  2. A trend that isn't significant still runs, with the caveat "trend not significant at this site".
  3. Every scenario response carries "Scenario built from observed years (1981–present), not a forecast."
  4. F20 what-if: `whatif.evaluate(site, zone, change)` reuses the optimizer's evaluator (vector sums, ms) and returns the new exposures. Write the v1.2 request.
  5. F23: document that priority sliders only re-sort the pins client-side. Expose the two axes per pin so the client can do it.
  6. F39 season challenge: produce random real-decade replays from bootstrap indices (seeded), scored as soil protected vs baseline. Write the v1.2 request.
- **Done when:**
  - `wetter_winters` never lowers `J_wet` relative to baseline (test)
  - weights sum to 1
  - the effective sample size is reported
  - every scenario response has the not-a-forecast line

### S2-B7 Backtest score, validity pack, "How we use NASA data" (step 7)

- **Needs:** B5; ~A6. **Tell:** everyone (backtest number and write-up ready for review).
- **Read:** `PRD.md` §1, §4 G1–G3, §10, §13; A6's progress note; `algorithm.md`; `data-sources.md` (headings).
- **Owns:** `services/api/app/engine/backtest.py`, `data/seed/<backtest_site>/backtest.json`, `docs/how-we-use-nasa-data.md`, `algorithm.md` (validation section).
- **Do:**
  1. Score the `winter_wet` zones against `backtest_obs`: hit rate and IoU vs an **area-matched random baseline** (≥ 1000 seeded draws), reported with its percentile.
  2. Report the number as is, with its limits (cloud, resolution, flood vs saturation). If A6 found no usable observation, say so.
  3. Validity pack in `algorithm.md`: the invariant list, the fusion diagnostics, calendar sanity, terrain sanity, bootstrap stability, the sensitivity table, and the backtest.
  4. Write the one-page `docs/how-we-use-nasa-data.md` from the code, not the plan: each dataset, its one-sentence job, its basis, and the "considered and not used" list (`../Databases.md` §4).
- **Done when:**
  - `backtest.json` is reproducible
  - every claim in the write-up points to a file or test
  - both owners and the integrator have reviewed it

### S2-B8 Stretch (only after B7): nitrate-leaching overlap, dry-side terrain modifier

- **Needs:** B7. **Tell:** S1-B.
- **Read:** `PRD.md` D-06, §6.1 (`M(z)`).
- **Owns:** `services/api/app/engine/{nitrate,moisture_mod}.py`.
- **Do:**
  - F44: a winter overlap of bare soil × wet weeks × recharge-prone zones (relative), plus a v1.2 section.
  - `M(z)` from convexity and TWI for the summer axis, behind a param that defaults to 1.
- **Done when:** both exist and are tested, and with defaults the P0 outputs are byte-identical.

