# Forecast cross-session requests

Sessions read this before starting a workstream. Add a dated note; do not edit another session's files to get around it.

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
