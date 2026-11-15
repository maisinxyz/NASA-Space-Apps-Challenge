# Grok Session C PRD: KPU Langley horticulture twin, presets, crop catalog and yields

Status: 2026-11-15. You are **Session C** of three parallel sessions. Your job: add **KPU Langley, School of Horticulture** as the second BC twin (the name is decided: "Horticulture"), give both BC twins a realistic existing rotation, fill the crop catalog gaps, and add yield inputs (approved by the team lead), then extend QA to five sites.

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

### EC1: Register `site_kpu_langley` (do this first; Session A picks it up for satellite runs)
- Add to `CURATED_SITES` in `app/features/config.py`: `name: "KPU Langley, School of Horticulture"`, `lat`, `lon`, `farm_id: "kpu-langley"` (matches the web pin file `apps/web/lib/farms/candidates/kpu-langley.ts`), `address`, `source_url`, `coord_source_url`, `coord_note`. Get the campus address from a KPU page and the point from the BC address geocoder (`https://geocoder.api.gov.bc.ca/addresses.json`), exactly as FT-W1 did for UBC; record the query, timestamp, precision and the Open Government Licence - British Columbia attribution. The web pin uses OpenStreetMap way 538627375 (49.109162, -122.645172); use that only as a fallback and say so.
- Seeds: `SEED_SITES=site_kpu_langley uv run --project services/api python scripts/build_seed.py` (generalize the script's UBC-only branches so any site id works) for POWER daily 1991-2024 and SoilGrids, sidecars complete, plus `station_gap.json` for the nearest ECCC station (identity only, same redistribution caveat as UBC). Feature-table fixture in `packages/contracts/fixtures/features/site_kpu_langley.json`. New `tests/test_kpu_langley.py` modelled on `tests/test_ubc_farm.py`.
- **Weather-cell check:** compare the POWER payload header coordinates and the first year of `T2M` for KPU Langley and UBC Farm. If identical, add a flag to the site entry (for example `shares_power_cell_with: "site_ubc_farm"`) and a sentence in the progress note, so Session B's uncertainty rows can show it (write a note in `forecast-requests.md`).
- **Mock conflict check:** an uncommitted or recent change may list `site_kpu_langley` and `site_ubc_farm` as "(mock)" entries in `packages/contracts/fixtures/sites.json` and a mock zones fixture. Real curated data must never be replaced by mock data in the demo (`CLAUDE.md`). Do not edit those fixtures; check what `/sites/site_kpu_langley/...` returns after registration and, if a mock answer wins over the curated path for any route, write a note in `forecast-requests.md` and tell the team lead in your progress note.

### EC2: Existing-rotation presets for both BC twins
- Add `SITE_PRESETS` entries for `site_ubc_farm` and `site_kpu_langley` in `app/rotation/config.py` using catalog crop ids: a small-farm vegetable rotation with a cover crop, sourced from a BC or Pacific Northwest extension guide (BC Ministry of Agriculture and Food, WSU, Oregon State) with the URL. If no source can be opened, mark it `TODO(verify)` and name it "Typical vegetable rotation (not this farm's records)". Update affected tests and fixtures.

### EC3: Crop catalog gaps
- For the crops in both presets plus a selection pool fitting a horticulture school (vegetables, cover crops, forage, berries or other `fruit_perennial` rows already in the catalog): planting and termination windows for the Fraser Valley and Vancouver (extension guides), Kc stages from FAO-56 Table 12 using a copy that keeps the table columns (the FAO HTML lost them, see FT-W5; use the FAO-56 PDF or another verified copy), `region_fit` with a verified climate class, root depth, frost and heat limits where a source states them, `needs_equipment` for small-scale practice. Every value has a URL in `trait_sources`; unsourced values stay `null`.
- Keep the twelve legacy ids unchanged. Schema and source tests must pass.

### EC4: Yield inputs (approved)
- For the same crops: `reference_yield` (t/ha) with a source (provincial or university production guides, or Statistics Canada tables for British Columbia; record which and the year), `yield_response_factor_ky` from FAO Irrigation and Drainage Paper 33 (verify the table), and `typical_n_rate_kg_ha` from a BC nutrient guide. No source, no number.
- Check that `app/twin/run.py` / `water.py` turn these into `yield_t_ha` series with p10/p90 (that code belongs to Session B; if it fails, write the bug in `forecast-requests.md` instead of editing it). Income stays `null` unless the request carries the farmer's prices.

### EC5: QA for five sites
- Add `site_kpu_langley` to the site lists in `tests/qa/**` and `tests/test_climate_outlook.py`; add a test that the two BC twins are not silently identical (weather or soil differs, or the shared-cell flag is present).
- Update `scripts/smoke_forecast.py` and `scripts/build_forecast_fixtures.py` for five sites; run the smoke script with `OFFLINE=1`.
- Add the new site's datasets to `docs/data-and-methods.md` (source, licence, attribution, resolution, record, limits) and refresh `docs/todo-verify.md` with `python scripts/todo_verify_report.py`.
- Pull at the start of EC5: if Session A's satellite seeds or Session B's features are on `main`, include them in the smoke run; if not, note it.

## Done when
- Every forecast route answers for `site_kpu_langley` offline, with labels, determinism and provenance (same checks as the v3 PRD section 9).
- Both BC twins start from a vegetable rotation, not corn and soybean.
- At least the preset crops have sourced windows, Kc, reference yield and Ky, and the forecast returns `yield_t_ha` for them.
- Full `services/api` suite and the five-site smoke script pass.

## Session C brief (paste into Grok)
```text
You are SESSION C of 3 Grok sessions working in parallel on the FieldTwin backend. Your PRD is docs/grok-C-kpu-horticulture-twin.md; read it fully, then CLAUDE.md, docs/kpu-langley-twin-prd.md (background), docs/progress/FT-W1.md, FT-W5.md, FT-W7.md and FT-W10.md. Do EC1 to EC5 in order; push EC1 as soon as it passes because Session A uses the new site. Never wait for another session. Never print or commit the Earthdata token. Edit only your files. After each workstream: tests, progress note, git pull --rebase, git add your files by path, commit "FT-<ID>: ...", push, print "<ID> DONE". Stop only with SESSION C FINISHED or SESSION C BLOCKED: <question>.
```
