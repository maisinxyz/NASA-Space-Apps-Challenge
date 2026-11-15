# Grok Session A PRD: Earthdata ingestion for every curated site

Status: 2026-11-15. You are **Session A** of three parallel sessions. Your job: turn the new Earthdata access into real, licensed, weekly seed layers for **all curated sites** (Beltsville, Harford, Oakville, UBC Farm, and KPU Langley once Session C registers it), so the rest of the backend can stop running on POWER and SoilGrids alone.

## Shared facts (identical in all three PRDs; read first)

**Three Grok sessions run at the same time:** Session A (`docs/grok-A-earthdata-ingest.md`), Session B (`docs/grok-B-exposure-climate-engine.md`), Session C (`docs/grok-C-kpu-horticulture-twin.md`). They are designed so **no session ever waits for another**. When something another session produces is not on `main` yet, your code must already handle its absence (the loader returns `None`, the site is not registered yet), you continue, and you re-check with `git pull --rebase` at your next workstream boundary.

**Rules (from `CLAUDE.md` and `docs/backend-forecast-prd.md`; they override anything below):**
- Backend only. Never create or edit anything under `apps/web/`.
- Never invent endpoints, fields, enum values, dataset names, URLs, constants, coordinates, yields or licences. Unverified value = `TODO(verify)` plus a source URL in a comment. Missing data = `null`, a gap record or `data_mode: limited_data`, never a made-up number.
- Every number in a response carries `unit`, `basis` (`measured | derived | modeled | assumed | relative`) and `confidence`. Absolute estimates (yield, income, fertilizer, soil loss) are allowed (team decision D1) and carry p10/p50/p90.
- Deterministic: same request, same bytes. No unseeded randomness, no wall-clock in outputs, no LLM calls.
- `OFFLINE=1` must work for every curated site from `data/seed/` with the network blocked. Network access happens only in seed-building scripts, never on a request path.
- Contract (`packages/contracts/openapi.yaml`, v1.2.0) does not change. If you truly need a new field, stop with `BLOCKED` and ask the team lead.

**State of `main` on 2026-11-15** (read the notes in `docs/progress/` before coding): the forecast backend W0 to W10 is built and tested (engine `services/api/app/twin/`, routes `features`, `climate-outlook`, `exposure`, `crop-catalog`, `forecast`, `forecast/sensitivity`). Four curated sites: `site_usda_barc`, `site_cornell_ruminant`, `site_ucdavis_oakville`, `site_ubc_farm`. Known gaps this round fixes: satellite layers missing (FT-W2, no credentials then); zones empty (no DEM); `cmip6_delta` still a linear ramp (FT-W9); crop catalog has most planting windows, Kc, `reference_yield` and Ky as `null` (FT-W5); `SITE_PRESETS` has no entry for UBC Farm, so its existing rotation falls back to corn and soybean; KPU Langley is not a backend site yet. Background for KPU: `docs/kpu-langley-twin-prd.md` (superseded by these three files for task assignment).

**Earthdata token (now available):**
- It is in the repo-root `.env` as `EARTHDATA_TOKEN` (git-ignored). Read it from the environment (`os.environ`, or load `.env` in the script). Send it only to NASA Earthdata hosts as `Authorization: Bearer <token>`, and re-add the header when a download redirects.
- **Never print, log, commit, or write the token** into any file, sidecar, fixture, progress note or test output. Do not commit `.env` or the `EarthDataToken*.txt` file in the repo root (both git-ignored; `git add` only explicit paths you own, never `git add -A` or `git add .`).
- Token expiry: 2027-01-14.
- Access verified on 2026-11-15 by a 256-byte ranged download of the newest granule (HTTP 206). This proves access only; no data values were read:

| Product (CMR short name, version) | Host | Result |
| --- | --- | --- |
| `HLSL30`, `HLSS30` (v2.0, MGRS tile `T10UDV` covers UBC Farm) | data.lpdaac.earthdatacloud.nasa.gov | OK |
| `MOD13Q1` 061 | data.lpdaac.earthdatacloud.nasa.gov | OK |
| `ECO_L3T_JET` 003, `ECO_L2T_LSTE` 002 (tile `10UDV`) | data.lpdaac.earthdatacloud.nasa.gov | OK |
| `NASADEM_HGT` 001 (`n49w124`) | data.lpdaac.earthdatacloud.nasa.gov | OK |
| `SPL4SMGP` 008, `SPL3SMP_E` | data.nsidc.earthdatacloud.nasa.gov | OK |
| `GPM_3IMERGDF` 07, `GRACEDADM_CLSM0125US_7D` | data.gesdisc.earthdata.nasa.gov | OK (was 403 until the team lead authorized the GES DISC application; re-tested OK 2026-11-15) |
| `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` | archive.podaac.earthdata.nasa.gov | OK |

**Seed file contract shared by Session A (writes) and Session B (reads).** Existing loaders in `services/api/app/features/seeds.py` stay compatible:
- Weekly layers: `data/seed/<site_id>/<layer>.json.gz` where `<layer>` is `ndvi`, `smap`, `ecostress`, `grace` (and `imerg` if added). JSON object with: `site_id`, `layer`, `variable`, `unit`, `basis`, `product` (`short_name`, `version`), `native_resolution_m`, `spatial_method` (for example "mean of valid 30 m pixels within 150 m of the site point"), `retrieved_on`, and `weekly`: a list of `{ "year": int, "values": [52 numbers or null], "n_obs": [52 ints] }`. Weeks are 7-day blocks from 1 January; days 358-366 fold into week 51 (existing pipeline convention). A week with no valid observation is `null` with `n_obs` 0. Nothing is gap-filled.
- DEM: `data/seed/<site_id>/dem.json.gz` with `elevation` (2-D list, metres), `res_m`, `origin` (lon, lat of the upper-left cell centre), `crs`, `shape`, `product`, `native_resolution_m`, `bare_earth` (true/false/unknown), `retrieved_on`.
- Every file has a sidecar `<layer>.meta.json` with the existing `SIDECAR_FIELDS` (source name, URL, product version, retrieved on, licence, attribution, resolutions, processing notes). When a file exists, delete the matching `<layer>.gap.json`.

**File ownership (a session edits only its own files; anything else goes as a dated note in `docs/progress/forecast-requests.md`):**

| Session A | Session B | Session C |
| --- | --- | --- |
| `scripts/seed_satellite/**`; `data/seed/*/{ndvi,smap,ecostress,grace,imerg,dem}.*`; new loader functions appended to `app/features/seeds.py` (do not change existing signatures); `services/api/pyproject.toml` and `uv.lock` (dependency adds, e.g. `h5py`); new tests `tests/test_satellite_*.py`; `.env.example` (names only) | `app/features/pipeline.py`, `app/features/zones.py`; `app/services/{features,climate_outlook,exposure}.py`; `app/twin/{climate,exposure,water,run,weather_ensemble}.py`; `app/twin/explain/**`; `scripts/seed_cmip6/**`; `data/seed/*/cmip6_delta.*`; tests `tests/test_features.py`, `test_exposure.py`, `test_climate_outlook.py` (logic only), `test_twin_water.py`, `test_twin_explain.py`, new `tests/test_cmip6.py` | `app/features/config.py` (site list and sources); `data/seed/site_kpu_langley/{power_daily,soil,station_gap}.*`; `scripts/build_seed.py`; `packages/contracts/fixtures/features/*`; `app/rotation/config.py` (`SITE_PRESETS`); `data/seed/crops/**`; `scripts/build_catalog_v2.py`; `app/twin/{catalog,generate,score,nitrogen,soil,pest}.py`; site lists in `tests/qa/**` and `test_climate_outlook.py`; new `tests/test_kpu_langley.py`, `test_crop_catalog.py`; `docs/data-and-methods.md`, `docs/todo-verify.md`; `scripts/smoke_forecast.py`, `scripts/build_forecast_fixtures.py` |

Other people's uncommitted changes may be in the working tree (frontend sessions). Leave them alone.

**Stop rules (no WAITING state in this round):**
1. `SESSION <X> FINISHED` after your last workstream, with a 5-line summary.
2. `SESSION <X> BLOCKED: <question>` only for a decision, a credential or a fact you cannot verify. Before blocking, finish every other workstream you can.

After **each workstream**: run your tests (`cd services/api && uv run pytest -q`, or the venv if `uv` is missing) and show the result; write `docs/progress/FT-<ID>.md` (built, files, how to run, results, gaps, notes for the other sessions); `git pull --rebase`; `git add` your files by path; commit `FT-<ID>: <summary>`; push; print `<ID> DONE`; continue.

## Your workstreams (in order)

### EA1: Downloader core (no data yet)
- `scripts/seed_satellite/edl.py`: token from the environment, `Authorization: Bearer` on every NASA Earthdata request including redirects, CMR granule search by short name, version, point or small bounding box and date range, ranged and full downloads into `data/cache/earthdata/` (git-ignored; add the folder to `.gitignore` only if it is not already covered by `data/cache/`), retries with backoff, a polite concurrency cap, and a clear error when the token is missing or rejected (never echo the token).
- Read the site list from `app.features.config.CURATED_SITES` at run time; `--sites` limits the run. A site that is not registered yet is skipped with a message, not an error.
- Tests with no network: URL building, redirect header handling, missing-token error, week bucketing.

### EA2: Vegetation (NDVI, and EVI if cheap)
- Source: HLS v2.0 (`HLSL30`, `HLSS30`). Compute NDVI from the surface-reflectance bands, applying the product's Fmask quality flags (confirm band names and Fmask bit meanings in the HLS user guide; record the URL). If a ready vegetation-index product (`HLSL30_VI`, `HLSS30_VI`) is simpler, verify its NDVI band name first (FT-W2 could not).
- Sample a small footprint around each site point (state the radius; pixels must be inside the farm where possible) and aggregate to weekly mean NDVI with `n_obs`. Record cloud-free scene counts per year.
- Record length: as far back as HLS allows for the tile (`TODO(verify)` start years from LP DAAC); keep runs bounded (for example 2016 to 2025) and document the choice.
- Optional longer history: `MOD13Q1` 061 (250 m, 16-day) as a separate `basis: measured` series with an explicit mixed-pixel warning for small farms. Only if time allows.

### EA3: Soil moisture
- Source: `SPL4SMGP` 008 (9 km, 3-hourly, modeled assimilation) for root-zone and surface moisture; `SPL3SMP_E` as an optional cross-check. Read HDF5 with `h5py`; find the EASE-Grid 2.0 cell containing the site point (verify the grid definition from NSIDC documentation and record it). Aggregate to weekly means. `basis: modeled` for L4. Bound the volume: daily subsets or the 3-hourly files for one time step per day; document what you sampled.
- Record `native_resolution_m` (about 9000) so Session B shows that one pixel covers the whole farm.

### EA4: Evapotranspiration
- Source: `ECO_L3T_JET` 003 (70 m tiles; tile `10UDV` covers UBC). Confirm the ET variable name and units in the product guide. Weekly mean of valid observations with `n_obs` (ECOSTRESS revisits irregularly; many weeks will be `null`, which is fine). Check whether each US site and KPU Langley have tiles; if a site has none, write a gap record.

### EA5: Elevation
- Source: `NASADEM_HGT` 001 (1 arc-second). Clip a grid about 1 km around each site point, write `dem.json.gz` with `bare_earth: false` (NASADEM is a surface model that can include canopy and buildings; say so in the sidecar). Optional, if you can verify access and licence: Natural Resources Canada HRDEM (CanElevation, 1 m lidar-derived, AWS `ca-central-1`) for the two BC sites as `dem_hrdem.json.gz` with `bare_earth: true`, plus a note for Session B. Do not mix the two in one file.

### EA6: IMERG rainfall and GRACE groundwater (access now authorized)
- Access to GES DISC (`GPM_3IMERGDF` 07, `GRACEDADM_CLSM0125US_7D`) and PO.DAAC (`TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4`) was verified on 2026-11-15, so build these layers like the others; if a download still returns 403, write the gap record and ask only after EA1 to EA5 and EA7 are done.
- `imerg.json.gz`: IMERG Final daily precipitation (0.1 degree), weekly totals (sum of daily mm) with `n_obs` days; confirm the variable name (expected `precipitation`; verify in the product guide), units and the Final-run latency (`TODO(verify)`). It serves as an independent rainfall cross-check for POWER at each site (Session B reads it for uncertainty).
- `grace.json.gz`: pick the groundwater or terrestrial-water-storage variable you can verify (the data-assimilation product `GRACEDADM_CLSM0125US_7D` is weekly but its name says US coverage, so confirm it covers the Canadian sites before use; otherwise use the PO.DAAC mascon grid, which is monthly: store it in a `monthly` list and document that it is not weekly). `native_resolution_m` must reflect the true effective resolution (coarse; regional context only).
- Both layers appear as honest regional context; Session B must not score with them.

### EA7: Run, document, hand over
- Run EA2 to EA6 for every registered site. Pull at the start of EA7; if Session C has registered `site_kpu_langley`, include it; if not, finish the other four and leave a one-line command in your progress note so the run can be repeated.
- Sidecars complete (existing `sidecar_problems` test must pass); gap records removed where data now exists; `.env.example` gets the name `EARTHDATA_TOKEN=` (no value).
- Progress note includes, per site and layer: years covered, weeks with data, cloud-free scene counts, native resolution, and every `TODO(verify)`.

## Done when
- `load_ndvi`, `load_smap`, `load_ecostress`, `load_grace`, `load_dem` return data (plus `imerg.json.gz`) for UBC Farm and the three US sites (and KPU Langley if registered), or a gap record that says exactly why not.
- Every file is reproducible from the scripts with the token, and `OFFLINE=1` tests pass without the network.
- No token anywhere in git (`git log -p` and `git grep` for `eyJ` return nothing new).

## Session A brief (paste into Grok)
```text
You are SESSION A of 3 Grok sessions working in parallel on the Stardew Earth backend. Your PRD is docs/grok-A-earthdata-ingest.md; read it fully, then CLAUDE.md, docs/progress/FT-W2.md and services/api/app/features/seeds.py. Do EA1 to EA7 in order. Never wait for another session. Never print, log or commit the Earthdata token. Edit only the files your PRD gives you. After each workstream: tests, progress note docs/progress/FT-<ID>.md, git pull --rebase, git add your files by path, commit "FT-<ID>: ...", push, print "<ID> DONE". Stop only with SESSION A FINISHED or SESSION A BLOCKED: <question>.
```
