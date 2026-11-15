# Forecast cross-session requests

Sessions read this before starting a workstream. Add a dated note; do not edit another session's files to get around it.

## 2026-11-15 — Session A, exposure is implemented and not mounted

`app/routers/exposure.py` serves `GET /sites/{site_id}/exposure`. Session C (W9): add `exposure` to `ROUTERS` in `app/main.py` and remove `("GET", "/sites/{}/exposure")` from `pending_v12` in `tests/test_routes.py`. UBC Farm returns `data_mode: limited_data` and no zone polygons until the W2 layers exist. Do not invent a water-stress value.

## 2026-11-15 — Session A, W2 satellite layers are blocked

`load_ndvi`, `load_smap`, `load_ecostress`, `load_grace`, and `load_dem` return `None` for UBC Farm. Gap files are under `data/seed/site_ubc_farm/*.gap.json` with `data_mode: limited_data`. Do not fill those series. Details and the CMR titles that were checked are in `docs/progress/FT-W2.md`. IMERG short name `GPM_3IMERGDF` version `07` was seen and not stored. Earthdata credentials are the open question.

## 2026-11-15 — Session A, crop catalog v2 is on main (after this commit)

`data/seed/crops/catalog_v2.json` has 49 crops. `data_mode` is `seed`. Load it with `app.twin.catalog.load_catalog`. Do not read `packages/contracts/fixtures/crop_catalog.json` as a second source; that fixture is a copy of the seed.

Null numbers are not verified. Do not fill them. `validate_selection` raises `SELECTION_TOO_SMALL` (under 2) and `UNKNOWN_CROP`.

`GET /crop-catalog` is implemented in `app/routers/crop_catalog.py` and is not mounted. Session C (W9): add `crop_catalog` to `ROUTERS` in `app/main.py`, and remove `("GET", "/crop-catalog")` from `pending_v12` in `tests/test_routes.py`. The same set lists the other four v1.2 paths until their routers are mounted.

`app/core/errors.py` now includes `SELECTION_TOO_SMALL`, `INVALID_QUOTA`, and `HORIZON_OUT_OF_RANGE` (all 422).

No climate class is stored for any site, including UBC Farm. A `site_id` filter keeps crops whose `region_fit` is empty.

## 2026-11-15 — Session A, W1 dataset notes for Session C

Please copy the dataset table in `docs/progress/FT-W1.md` into `docs/data-and-methods.md` when you write that file (W10). Session A did not create it because W10 owns `docs/**` other than progress notes.

UBC Farm daily station observations are not in the seed. See the question at the end of `FT-W1.md`.

## 2026-11-15 — Session A, contract v1.2.0 is on main

`packages/contracts/openapi.yaml` is **1.2.0**. New paths: `GET /sites/{siteId}/climate-outlook`, `GET /sites/{siteId}/exposure`, `GET /crop-catalog`, `POST /sites/{siteId}/forecast`, `POST /sites/{siteId}/forecast/sensitivity`. Fixtures are under `packages/contracts/fixtures/forecast/` and `crop_catalog.json`. They are shape examples (`data_mode: mock`), not engine output. Frontend can run `make types`. Session A did not touch `apps/web/`.

Shared Python types are `services/api/app/twin/types.py` (commit on main). Use those names. Do not redefine `PlanYear`, `WaterYearResult`, `State`, `request_hash`, or `member_seed`.

### For Session C (W9), file `services/api/app/core/config.py`

Health still reports `API_VERSION` `1.1.0` (`tests/test_routes.py` expects that). Please bump it to `1.2.0` when the forecast routers are registered. Session A does not own that file.

### For Session B

- Null catalog numbers (`reference_yield`, `yield_response_factor_ky`, `typical_n_rate_kg_ha`, `return_interval_years`, root depths, and the nullable class fields) mean **not verified**. Do not substitute a silent default. Skip the absolute estimate and raise a review flag, or read a coefficient from `twin/config.py` that is itself marked `TODO(verify)`.
- `Trajectories.n_balance` is the relative index (year 0 = 100). `n_balance_kg_ha` and `n_fixed_share` are the companion series named in PRD group 3.
- `request_hash` returns the full 64-character sha256 hex. The v1.1 rotation hash stays 16 characters. `member_seed(req_hash, member)` is `int(sha256(f"{req_hash}{member}")[:8], 16)` with UTF-8 text.

### For Session C (W3)

`ForecastRequest.climate_source` defaults to `history_resample` until a future-climate dataset is verified (decision D2). If NEX-GDDP-CMIP6 (or the replacement you record) checks out, ask here for the schema default to change to `cmip6_delta`. Do not edit `openapi.yaml` directly.

### Schema names that differ from the PRD prose

- JSON key `exposure` uses component `ForecastExposure`, because v1.1 already defines `Exposure`.
- `uncertainty.layers[].record_years` is a string (`1991-2024`, `2015+`, or `none`).
- `station_bias.bias` is a `Number` (unit, basis, confidence live on it) rather than a bare number.
- `Ramp.years` is 5..10 so a shorter horizon can say when the slider value is reached. The fixture uses 10. Shape is only `linear`. Basis is `assumed`.

## 2026-11-15 — Session C, W3 climate outlook is implemented and not mounted

`app/routers/climate_outlook.py` serves `GET /sites/{site_id}/climate-outlook`. W9 (Session C) will add `climate_outlook` to `ROUTERS` in `app/main.py`. Do not change `packages/contracts/openapi.yaml`.

### Decision D2: leave `climate_source` default as `history_resample`

NEX-GDDP-CMIP6 does publish daily `pr`, `tasmax`, and `tasmin`, and the 0.25 degree grid includes UBC Farm. The license does not clearly allow a seed in this repo: the AWS registry says CC0 as of September 2022, and the June 2025 tech note says each file's `cmip6_license` may restrict use. Details and URLs are in `docs/progress/FT-W3.md`. Please do not switch the schema default to `cmip6_delta` until that is settled. `scripts/extract_nex_gddp_cmip6.py` does not download or write a seed.

### If a satellite seed is stored later

Do not invent values. The outlook will read a file only when it already has these fields:

- SMAP: `anomaly_weekly` (length 52, number or null) and `resolution_note`
- ECOSTRESS: `value` as a number object with `value`, `unit`, `basis`, `confidence`, plus `resolution_note`
- GRACE: `trend` as that same number object, plus `resolution_note`

`GET /climate-outlook` has no `crops` parameter in the contract. Heat-stress days use the site's existing-rotation preset. Adding a crops query would be a contract change.

## 2026-11-15 — Session B, W6a engine notes

`build_members` and `run_water_year` take `lat` as a keyword (hemisphere for seasonal rain and season windows). `run_water_year` also takes keyword `catalog`, `no_till`, `storage_start_mm`, and an optional precomputed `profile`. Positional arguments stay as in PRD §6.4. `ScenarioApplied` has no per-year CMIP6 delta, so `cmip6_delta` and `history_resample` both use the linear ramp until Session C attaches a verified delta table.

Compaction is in the PRD infiltration sentence and is not on `FieldCfg`. W6a does not invent a flag.

Catalog rows with a null season window or null Kc (most of the new vegetable rows) are not placed and do not get a made-up date or Kc. Session A: a vegetable-only pool cannot form a timed plan until `season_window` and `kc_stages` are filled from a cited table. Null `reference_yield` omits `yield_t_ha` for that crop. It is not filled from a default tonne value.

## 2026-11-15 — Session B, W7 strategy and score notes

`generate_strategies` and `build_strategies` take `lat` as a keyword and an optional `site_id`. They read `fields[0]` only. W9 should call them once per field and roll the results up by area. A field `selection_override` is not applied inside the generator.

`farm_fit` is defined in `app/twin/score.py` and re-exported from `app/twin/generate.py`. Ranking, income, fertilizer saved, estimates, deltas, and review flags are in `score.py`. `rank_stability_note()` is a sentence. The share of the climate grid that keeps the rank is W8's, and this session did not invent that percent.

`custom_strategies` are expanded as entered and do not count toward `strategy_count`. Vegetable rows with a null season window produce `NO_FEASIBLE_ALTERNATIVES` and no invented dates.

## 2026-11-15 — Session C work, W9 fixture note

`POST /forecast` and `POST /forecast/sensitivity` are mounted, and health reports `1.2.0`. The shape examples in `packages/contracts/fixtures/forecast/` were left in place. `test_forecast_contract.py` requires those files to match `fixtures_lib` and to include a `yield_t_ha` series and a CAD `income_estimate`. The engine omits yield when `reference_yield` is null and leaves income null when no per-tonne price was entered. Replacing the fixture with engine output fails that test. `scripts/build_forecast_fixtures.py` writes the engine documents under `data/cache/forecast/engine/`.

## 2026-11-15 — Session B, EB1 satellite features

`ndvi`, `ndvi_anomaly`, and `smap_anomaly` are filled only when `load_ndvi` / `load_smap` return a weekly list with a unit. `sources_agree` stays null until SMAP overlaps POWER. ECOSTRESS is used for `limited_data` and a source row when the sidecar has a licence. It is not a feature id, because the contract names only the three series above. Please do not add an ET feature id without a contract change.

A source row is copied from `<layer>.meta.json` and only when `source_name`, `license`, and `attribution` are already filled. Session A: those three sidecar fields are what puts the product on `sources`.

## 2026-11-15 — Session B, EB2 elevation filename

Zones prefer `data/seed/<site_id>/dem_hrdem.json.gz` when that file exists, then `dem.json.gz` via `load_dem`. No new loader was added in `seeds.py`. The object needs `elevation`, `res_m`, `origin` (lon, lat of the upper-left cell centre), and `bare_earth`. SMAP water stress is one farm polygon. A native resolution coarser than the clip is stated in `resolution_note`.
