# Stardew Earth Backend PRD: Second twin, KPU Langley (School of Horticulture)

> **Superseded for task assignment (2026-11-15):** the three parallel Grok PRDs `docs/grok-A-earthdata-ingest.md`, `docs/grok-B-exposure-climate-engine.md` and `docs/grok-C-kpu-horticulture-twin.md` replace sections 4 and 5 below. Decisions since: the name stays "Horticulture"; yield inputs (K4) are approved; an Earthdata token is available. Keep this file as background.


Status: draft for team review, 2026-11-15. Backend only: no session builds or edits anything under `apps/web/`; the frontend list is section 8. Read `CLAUDE.md` and `docs/backend-forecast-prd.md` first. That PRD (v3) defines the forecast engine, the contract (v1.2.0), the stop rules and the honesty rules; they all apply here unchanged. This document covers only what is new for the second BC twin.

## 1. Goal

Add `site_kpu_langley` as the second digital twin, beside `site_ubc_farm`, so that every forecast endpoint (climate outlook, exposure, crop catalog, forecast, sensitivity) works for it from seed data with `OFFLINE=1`. Reuse the existing engine. No new endpoints, no contract change, no new engine code unless a gap in section 4 says so.

**Naming to confirm with the team lead.** The pin on the globe is "KPU School of Horticulture, Langley" (KPU's Langley campus, 49.109162, -122.645172, an OpenStreetMap campus point). The request called it the "KPU school of agriculture". Use the placeholder name "KPU Langley, School of Horticulture" in code until KPU's official name for the teaching site is confirmed (`TODO(verify)`).

## 2. What already exists (reuse, do not rebuild)

| Piece | State on `main` (2026-11-15) | For KPU Langley |
| --- | --- | --- |
| Forecast engine (`app/twin/*`, `services/forecast.py`), 30-member ensemble, sensitivity, flags, evidence | Built and tested (FT-W6a to FT-W9). Works by `site_id`. | Reuse as is. |
| Routes `/sites/{id}/features`, `climate-outlook`, `exposure`, `forecast`, `forecast/sensitivity`, `/crop-catalog` | Mounted. Generic over `CURATED_SITES`. | Work automatically once the site is registered. |
| Contract v1.2.0 and fixtures | Published. | No change. Add one feature-table fixture for the new site. |
| Crop catalog v2 (49 crops) | Built, but most traits are `null` (see FT-W5). | Needs the gaps in K3 filled for both twins. |
| Seeds for `site_ubc_farm` | POWER 1991-2024, SoilGrids, station gap record, satellite gap records. | Build the same set for the new site (K1). |
| Satellite layers (HLS, SMAP, ECOSTRESS, GRACE, DEM) | **Blocked**: no Earthdata login (FT-W2). Loaders return `None`. | Same gap for the new site until credentials exist (K5). |
| Zones (erosion, water-stress, frost) | Empty for UBC (no terrain data). | Same until the DEM seed exists (K6). |

**Per-site items that are NOT generic and must be added** (found by reading the code):
1. `CURATED_SITES` in `services/api/app/features/config.py`.
2. `SITE_PRESETS` in `services/api/app/rotation/config.py`. It has no entry for `site_ubc_farm`, so UBC's "existing rotation" currently falls back to `DEFAULT_PRESET` (corn, soybean). That is wrong for a vegetable teaching farm. Fix for both twins (K2).
3. The hard-coded site lists in tests (`tests/qa/test_determinism.py`, `test_offline.py`, `tests/test_climate_outlook.py`) and the single-site helpers in `scripts/build_seed.py`, `scripts/seed_satellite/extract.py`.

## 3. Why KPU Langley is a distinct twin (and what to be careful about)

- It sits in Langley, inland in the Fraser Valley, about 46 km from UBC Farm and farther from the open ocean. Expect somewhat different rain and temperature, and different soils. Do not assume this; the seeds will show it.
- **POWER cell check (do this first, K1).** NASA POWER meteorology comes from a coarse grid (about 0.5° by 0.625°). If Langley and UBC fall in the same cell, the weather series will be identical and the two twins will differ only by soil, presets and crop choices. The K1 session must compare the `header` latitude and longitude of both downloaded payloads and the first year of `T2M`, and record whether they differ. If they are identical, add a flag to the site record and to `uncertainty` ("shares a weather cell with site_ubc_farm") instead of hiding it.
- Teaching site, not a production farm. There are no public yield, price or field records. Do not invent fields or yields. Forecasts use the request's `fields[]`; with none given the engine uses one whole-farm field and states the assumption (existing behavior).
- Soil comes from SoilGrids (250 m, modeled), not a soil test. Say so.

## 4. Workstreams (K1 to K7)

IDs start with K to avoid clashing with W0 to W10. Each workstream follows the same rules as backend-forecast-prd section 0: own files only, `TODO(verify)` for unverified facts, deterministic output, `OFFLINE=1`, progress note `docs/progress/FT-<ID>.md`, commit prefix `FT-<ID>:`.

### K1: Register the site and build base seeds (Session A)
- **Scope:** add `site_kpu_langley` to `CURATED_SITES` with name, `lat`, `lon`, `farm_id: "kpu-langley"` (matches `apps/web/lib/farms/candidates/kpu-langley.ts`), address, source URL, coordinate source and a `coord_note`. Get the address from KPU's own page, and the point from the BC address geocoder (`https://geocoder.api.gov.bc.ca/addresses.json`, Open Government Licence - British Columbia), exactly as FT-W1 did for UBC; record the query, the response timestamp and the precision. The OSM campus point is only a fallback. Build seeds with `SEED_SITES=site_kpu_langley uv run --project services/api python scripts/build_seed.py` (POWER daily 1991-2024 plus SoilGrids 0-30 cm), with complete sidecars. Add `station_gap.json` for the nearest ECCC station (identity and the same redistribution caveat as UBC; do not copy daily data). Write the feature-table fixture. Run the POWER-cell comparison from section 3 and record the answer in the progress note.
- **Owns:** `services/api/app/features/config.py` (site list and sources only), `data/seed/site_kpu_langley/**`, `scripts/build_seed.py`, `packages/contracts/fixtures/features/site_kpu_langley.json`, `services/api/tests/test_kpu_langley.py` (copy the pattern of `tests/test_ubc_farm.py`).
- **Done when:** `GET /sites/site_kpu_langley/features` works offline; sidecars complete; 34 complete years or documented gaps; the cell comparison is written down.

### K2: Existing-rotation presets for both twins (Session A, after K1)
- **Scope:** add `SITE_PRESETS` entries for `site_ubc_farm` and `site_kpu_langley` in `app/rotation/config.py`, so the existing rotation is a plausible small-farm vegetable rotation using catalog crop ids, not corn and soybean. Source the rotation from a BC or Pacific Northwest extension guide (BC Ministry of Agriculture and Food, WSU, Oregon State) or from the farm; record the URL; if neither is available, mark every slot `TODO(verify)` and say in the preset name that it is a typical rotation, not the farm's records (same wording rule as the existing presets). Regenerate affected fixtures and tests.
- **Owns:** `services/api/app/rotation/config.py` (`SITE_PRESETS` only).
- **Done when:** the forecast for both twins starts from a vegetable rotation; the change is visible in `assumptions`; tests updated.

### K3: Catalog gaps that block both twins (Session B)
- **Scope:** FT-W5 left season windows, Kc, equipment, `region_fit`, reference yield, Ky and typical N rate as `null` for most of the 49 crops, so the engine cannot schedule or yield them. For the crops used by the two presets and a sensible selection pool for a horticulture school (vegetables, cover crops, forage, berries if the catalog has them): (a) fill planting and termination windows for the Fraser Valley from BC extension sources; (b) fill Kc stages from FAO-56 Table 12 using a source that keeps the table columns (the HTML chapter lost them, so use the FAO-56 PDF or another verified copy); (c) set `region_fit` to a verified climate class for the Fraser Valley and Vancouver; (d) fill `needs_equipment` for small-scale practice. Every value needs a source URL in `trait_sources`; unsourced values stay `null`. Do not guess.
- **Owns:** `data/seed/crops/catalog_v2.json` (and `.meta.json`), `scripts/build_catalog_v2.py`, `services/api/tests/test_crop_catalog.py`.
- **Done when:** schema and source checks pass; the preset crops schedule without errors; a list of values still `null` is in the progress note.

### K4: Yield inputs (Session B, after K3; optional, lead decides)
- **Scope:** the lead approved absolute yield and income estimates (decision D1), but `reference_yield` and Ky are `null` on every crop, so the forecast omits yield and income stays empty. For the crops in K3, add sourced `reference_yield` (t/ha) and `yield_response_factor_ky` (FAO Irrigation and Drainage Paper 33), and a typical N rate. A figure without a source is not added. Income still needs the farmer's prices (the request's `economics`); never invent prices.
- **Owns:** same files as K3.
- **Done when:** a forecast for either twin returns `yield_t_ha` series with p10 and p90 for at least the preset crops; income is `null` with a flag when no prices are given.

### K5: Satellite layers for both twins (Session C; blocked until Earthdata credentials exist)
- **Scope:** FT-W2 verified collection names on NASA's CMR but built no downloader. When `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` (or a token) are in `.env`, write the extraction (HLS NDVI/EVI, SMAP root zone, ECOSTRESS ET, GRACE-FO regional anomaly), run it for UBC Farm and KPU Langley, and write weekly series with sidecars. Confirm each product's band names, grid size, license and CONUS-only limits before use (ECOSTRESS CONUS products may not cover BC). Without credentials: write `*.gap.json` records for the new site, as FT-W2 did for UBC, and stop with `BLOCKED`.
- **Owns:** `scripts/seed_satellite/**`, `data/seed/<site>/{ndvi,smap,ecostress,grace}.*`.

### K6: Elevation and zones for both twins (Session A, after K2)
- **Scope:** this needs no Earthdata login. Candidate source: Natural Resources Canada's HRDEM (CanElevation, 1 m lidar-derived) on AWS `ca-central-1` (no AWS account needed), or LidarBC tiles for Langley and UBC. Verify the license text (Open Government Licence - Canada, version `TODO(verify)`), that the point is covered, and whether the model is bare earth. Store a small clipped elevation grid per site with a sidecar, add `load_dem` support, and let `app/features/zones.py` and `app/twin/exposure.py` produce erosion and frost-pocket zones with the resolution note. If the data cannot be fetched or does not cover the site, write the gap record and say so; do not fabricate terrain.
- **Owns:** `data/seed/<site>/dem.*`, `services/api/app/features/zones.py`, `services/api/app/twin/exposure.py` (zones part).
- **Done when:** `GET /sites/site_kpu_langley/zones` returns zones or a documented empty result; the same for UBC.

### K7: QA, docs, fixtures (Session C)
- **Scope:** extend the 4-site lists in the QA and climate tests to 5 sites; add a per-site check that the two BC twins are not accidentally identical (or that the shared-cell flag is set); regenerate engine fixtures for the new site; add the new site's datasets to `docs/data-and-methods.md` (source, license, attribution, resolution, record, limits); update `docs/todo-verify.md`; extend `scripts/smoke_forecast.py` to run all endpoints for all 5 sites with `OFFLINE=1`.
- **Owns:** `services/api/tests/qa/**`, the site lists in `services/api/tests/test_climate_outlook.py`, `docs/data-and-methods.md`, `docs/todo-verify.md`, `scripts/smoke_forecast.py`, `scripts/build_forecast_fixtures.py`.
- **Done when:** the full API test suite and the smoke script pass for 5 sites, offline.

## 5. Sessions: three running at once

| Phase | Session A: Site and terrain | Session B: Catalog and yield | Session C: QA and satellite |
| --- | --- | --- | --- |
| 1. Start | K1 site and seeds | K3 catalog gaps (needs no site) | Reads the repo; prepares the 5-site test changes; **waits** for A:K1 |
| 2. Middle | K2 presets, then K6 elevation and zones | K4 yield inputs (if the lead approves) | K7 QA and docs once K1 is on `main` |
| 3. End | Session A **finished** after K6 | Session B **finished** after K4 | K5 satellite (blocked until credentials), then final smoke run |

Stop rules are those of `docs/backend-forecast-prd.md` section 10.2 (FINISHED, WAITING, BLOCKED; after each workstream: tests, progress note, commit with the `FT-<ID>:` prefix after `git pull --rebase`, push, print `<ID> DONE`). Cross-session requests go in `docs/progress/forecast-requests.md`.

### Session A brief
```text
You are SESSION A of 3 Grok sessions adding the second twin, KPU Langley, to the Stardew Earth backend. Your workstreams, in order: K1, K2, K6.
Read first: CLAUDE.md, docs/kpu-langley-twin-prd.md (sections 1 to 5 and your workstreams), docs/backend-forecast-prd.md sections 0 and 10.2, docs/progress/FT-W1.md, FT-W4.md and FT-W5.md.
You own: services/api/app/features/config.py (site list and sources only), data/seed/site_kpu_langley/**, data/seed/<site>/dem.*, scripts/build_seed.py, packages/contracts/fixtures/features/site_kpu_langley.json, services/api/tests/test_kpu_langley.py, services/api/app/rotation/config.py (SITE_PRESETS only), services/api/app/features/zones.py, services/api/app/twin/exposure.py.
You must NOT edit: apps/web/**, data/seed/crops/**, packages/contracts/openapi.yaml, the engine files app/twin/{water,soil,nitrogen,pest,run,generate,score,weather_ensemble}.py, services/forecast.py.
Order: K1 (print "K1 DONE: Session C can start K7"), K2, K6.
STOP only for FINISHED (after K6), WAITING, or BLOCKED. Never invent coordinates, addresses, datasets, licenses, yields or field records; mark unverified values TODO(verify) with a source URL. Deterministic, OFFLINE=1 compatible, no LLM calls.
```

### Session B brief
```text
You are SESSION B of 3 Grok sessions adding the second twin, KPU Langley, to the Stardew Earth backend. Your workstreams, in order: K3, K4.
Read first: CLAUDE.md, docs/kpu-langley-twin-prd.md (sections 1 to 5, K3, K4), docs/backend-forecast-prd.md sections 0 and 10.2, docs/progress/FT-W5.md and FT-W7.md.
You own: data/seed/crops/catalog_v2.json and its sidecar, scripts/build_catalog_v2.py, services/api/tests/test_crop_catalog.py.
You must NOT edit: apps/web/**, packages/contracts/**, services/api/app/features/**, services/api/app/rotation/**, the engine files in app/twin/, seeds of any site.
Fill only values you can source (URL in trait_sources); everything else stays null. Never guess Kc, windows, yields or Ky.
STOP only for FINISHED (after K4), WAITING, or BLOCKED. Print "K3 DONE" and "K4 DONE". If the lead has not approved K4, stop after K3 and print "SESSION B FINISHED (K4 not approved)".
```

### Session C brief
```text
You are SESSION C of 3 Grok sessions adding the second twin, KPU Langley, to the Stardew Earth backend. Your workstreams, in order: K7, K5.
Read first: CLAUDE.md, docs/kpu-langley-twin-prd.md (sections 1 to 5, K5, K7), docs/backend-forecast-prd.md sections 0 and 10.2, docs/progress/FT-W2.md, FT-W9.md and FT-W10.md.
You own: services/api/tests/qa/**, the site lists in services/api/tests/test_climate_outlook.py, docs/data-and-methods.md, docs/todo-verify.md, scripts/smoke_forecast.py, scripts/build_forecast_fixtures.py, scripts/seed_satellite/**, data/seed/<site>/{ndvi,smap,ecostress,grace}.*.
You must NOT edit: apps/web/**, packages/contracts/openapi.yaml, services/api/app/** (engine, features, rotation, twin) except files listed above.
Order: 0. Read, then git pull; if data/seed/site_kpu_langley does not exist or CURATED_SITES lacks site_kpu_langley, STOP with "SESSION C WAITING FOR A:K1". 1. K7. 2. K5: if EARTHDATA_USERNAME/PASSWORD (or a token) are unset, write gap records and STOP with "SESSION C BLOCKED: Earthdata credentials needed".
STOP only for FINISHED (after K5), WAITING, or BLOCKED.
```

## 6. Acceptance for the second twin

| Check | Target |
| --- | --- |
| Routes | `features`, `climate-outlook`, `exposure`, `forecast`, `forecast/sensitivity`, `crop-catalog` all return 200 for `site_kpu_langley` with `OFFLINE=1` and the network blocked |
| Determinism | Same request, same bytes, on the new site |
| Not a copy | Weather or soil differs from UBC Farm, or the shared-cell flag is present and shown in `uncertainty` |
| Labels | Every number has unit, basis and confidence; absolute estimates have p10 and p90; the support sentence is present |
| Gaps are honest | Missing satellite, terrain, station and yield inputs appear as `limited_data`, gap records or `null`, never as made-up numbers |
| Provenance | Every dataset has source, license and attribution; sidecars complete |
| Performance | Cold forecast under 1.5 s; cached under 100 ms (same budgets as v3) |
| Tests | Full `services/api` suite passes with 5 curated sites |

## 7. Risks

1. **Same POWER cell as UBC.** The two twins may share weather. Mitigation: K1 checks and records it; the flag is shown to the user.
2. **Empty catalog traits** limit both twins (no schedule, no yield). Mitigation: K3 and K4; until then forecasts say what is missing.
3. **Earthdata credentials** are still missing, so satellite layers stay empty. Mitigation: gap records; the forecast runs on POWER and SoilGrids.
4. **No farm records from KPU.** Mitigation: whole-farm default field stated as an assumption; ask KPU for a field list and current crops.
5. **Naming.** "School of Agriculture" versus "School of Horticulture" must be settled before the name appears in the UI.

## 8. Frontend and UI list (not built by these sessions)

Owned by the frontend team in `apps/web/`. Everything in `docs/backend-forecast-prd.md` section 12 applies; additionally for this twin:
- Promote `kpu-langley` (and `ubc-farm`) from explore to twin: a twin config in the farm registry with field outlines (OpenStreetMap or from KPU), simulation bounding box, overlay mask, rotation set, regional crop labels, honesty labels and attributions. `farm_id` links the farm to `site_kpu_langley`.
- Show the "Pre-built" badge and the site's data limits (shared weather cell, no satellite layers, modeled soil, typical rotation not the farm's records).
- A farm-story and a short description of the teaching site, written with KPU's approval; the final name.
- Field entry for the farm's real fields if KPU provides them (view 1 of section 12.2).
- A way to switch between the two BC twins and, optionally, compare them side by side (no backend endpoint is planned for that comparison).
- The Simulation tab calls `POST /sites/site_kpu_langley/forecast`; sliders and presets as in the v3 PRD.

## 9. Open questions for the team lead

1. What is KPU's official name for the teaching site, and who at KPU can supply a field list and current crops?
2. Is K4 (yield inputs) approved, or should forecasts stay without yield and income until sourced yields exist?
3. Will someone register an Earthdata login so K5 can run?
