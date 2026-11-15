# Grok Session B PRD: Use the new data in the backend (features, exposure, zones, uncertainty, future climate)

Status: 2026-11-15. You are **Session B** of three parallel sessions. Your job: make the backend actually use satellite data, elevation and real future-climate deltas, for every curated site, and show the results honestly. Session A is producing the seed layers at the same time; you build against the seed file contract below and test with small synthetic fixtures inside your tests (never shipped as data).

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

### EB1: Feature table with satellite layers
- In `app/features/pipeline.py` and `app/services/features.py`, when `load_ndvi` / `load_smap` / `load_ecostress` return data, add the feature series the contract already defines (`ndvi`, `ndvi_anomaly`, `smap_anomaly`, and `sources_agree`; read `packages/contracts/openapi.yaml` `FeatureTable` and rotation-A notes for their exact meaning). Anomalies against each layer's own climatology over its own record (state the years). `sources_agree` compares POWER `GWETROOT`-based wet/dry weeks with SMAP using the existing `smap_agree_share` threshold. When a loader returns `None`, keep today's output exactly (tests must prove both paths).
- `data_mode` and `limited_data` follow what is actually present.

### EB2: Exposure and zones
- `app/twin/exposure.py`: bare-field windows cross-checked against NDVI where weekly NDVI exists (state the threshold as assumed, `TODO(verify)`), with the cloud-free count shown; vulnerable seasons can use SMAP dryness and ECOSTRESS ET as supporting evidence.
- `app/features/zones.py`: from `load_dem`, compute slope and a simple low-point (cold-air pocket) indicator and build erosion-risk and frost-pocket zones as GeoJSON polygons within the DEM clip. Water-stress hotspots: if moisture data is coarser than the farm (SMAP, about 9 km), return one farm-level value with a `resolution_note`, never sub-pixel polygons. If `bare_earth` is false, add a caveat that canopy and buildings may raise the surface. Prefer `dem_hrdem` if Session A provides it.
- Empty result plus caveat when there is no DEM (today's behavior).

### EB3: Uncertainty and validation
- `app/twin/explain/uncertainty.py`: build the `uncertainty.layers` rows from the real sidecars (native resolution, record years, `n_obs` coverage, confidence), so confidence rises only where data exists.
- Add a hindcast check: compare the engine's weekly root-zone water state with SMAP root-zone moisture (correlation and bias over overlapping weeks) and modeled crop ET with ECOSTRESS ET where present. Report it as numbers in `uncertainty` with units and `basis: derived`; do not tune the model silently. If you change a coefficient in `app/twin/water.py` because of this check, record before and after in the progress note and keep it labelled `assumed`.
- Rainfall cross-check: when `imerg.json.gz` exists, compare weekly POWER rainfall with IMERG (bias and correlation over overlapping weeks) and report it in `uncertainty` (`basis: derived`); this replaces the missing local-station check for sites that have no station series. GRACE is regional context only; show it, never score with it.
- Review flags (`app/twin/explain/flags.py`): replace "satellite layer missing" flags by data-quality flags where data now exists (few cloud-free scenes, coarse pixel, non-bare-earth DEM).

### EB4: Future climate deltas (`cmip6_delta`)
- Decision D2 (team): use NASA NEX-GDDP-CMIP6 if it has daily precipitation, maximum and minimum temperature at usable resolution and a licence that allows use; otherwise pick another verified source and record why. Verify the dataset location (it is reported to be on the AWS Open Data registry; `TODO(verify)` the bucket, file layout and licence), the variable names (`pr`, `tasmax`, `tasmin` expected; verify), and which models and scenarios exist.
- `scripts/seed_cmip6/build.py`: for each curated site point, extract a historical baseline period and a near-future period (for example 2031 to 2040; document the choice) for a small fixed ensemble of models (document which and why) and at least two scenarios (for example SSP2-4.5 and SSP5-8.5), and store per-season temperature and precipitation deltas with the model spread in `data/seed/<site>/cmip6_delta.json.gz` plus sidecar. Network only in this script.
- `app/twin/climate.py` and `app/twin/weather_ensemble.py`: when `climate_source: cmip6_delta` and the file exists, apply the stored per-year (ramped to the target decade) seasonal deltas instead of the linear slider ramp; expose named presets built from them (the scenario names must match what the contract's scenario field accepts; if a new preset name is needed, write it in `forecast-requests.md` and keep using the existing names). Without the file, keep today's fallback and label it.
- If the dataset cannot be verified, finish EB1 to EB3 and EB5, then `BLOCKED` with the question.

### EB5: Performance and offline
- Loading new seeds must keep the budgets: climate outlook cold < 1 s, forecast cold < 1.5 s, cached forecast < 100 ms. Cache loaded seeds in-process. `OFFLINE=1` tests still pass for all sites.

## Done when
- With synthetic fixtures in tests: every new path is covered (data present, data absent, coarse pixel, non-bare-earth DEM).
- With Session A's real seeds (pull at EB5): UBC Farm returns NDVI and SMAP features, zones from the DEM, and uncertainty rows with real coverage; if Session A's seeds are not on `main` yet, say so in the progress note and leave the exact command to re-run the checks.
- `cmip6_delta` uses stored deltas for every curated site, or a documented BLOCKED reason.

## Session B brief (paste into Grok)
```text
You are SESSION B of 3 Grok sessions working in parallel on the Stardew Earth backend. Your PRD is docs/grok-B-exposure-climate-engine.md; read it fully, then CLAUDE.md, docs/progress/FT-W3.md, FT-W4.md, FT-W6a.md, FT-W8.md, FT-W9.md and services/api/app/features/seeds.py. Do EB1 to EB5 in order. Never wait for another session: build against the seed file contract and test with synthetic fixtures in your tests. Never print or commit the Earthdata token. Edit only your files. After each workstream: tests, progress note, git pull --rebase, git add your files by path, commit "FT-<ID>: ...", push, print "<ID> DONE". Stop only with SESSION B FINISHED or SESSION B BLOCKED: <question>.
```
