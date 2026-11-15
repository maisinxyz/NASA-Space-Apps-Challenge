# Forecast cross-session requests

Sessions read this before starting a workstream. Add a dated note; do not edit another session's files to get around it.

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
