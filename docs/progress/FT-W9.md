# FT-W9 — forecast API, cache, and sensitivity route

## What was built

`app/services/forecast.py` composes climate outlook, exposure, strategy search, the 30-member ensemble, farm fit, scorecards, income, and the area-weighted rollup.

- `POST /sites/{site_id}/forecast` and `POST /sites/{site_id}/forecast/sensitivity` are mounted, along with the climate, exposure, and crop-catalog routers named in `docs/progress/forecast-requests.md`.
- Health `version` is `1.2.0`, matching the contract. Legacy `/rotation-analysis` and `/compare` stay until the web app calls `/forecast`.
- Validation uses the existing codes: `SELECTION_TOO_SMALL`, `UNKNOWN_CROP`, `HORIZON_OUT_OF_RANGE`, `INVALID_QUOTA`, `INVALID_WEIGHTS`, `SCENARIO_OUT_OF_RANGE`, `SITE_NOT_FOUND`. `NO_FEASIBLE_ALTERNATIVES` is a warning on the 200 response.
- A farm water quota is a depth in mm/season. Each field without its own quota uses that depth. It is not divided by area.
- Cache: in-process LRU of 32, plus `data/cache/forecast/{hash}.json`. The cache is not required. Seeds are.
- `scripts/build_forecast_fixtures.py` writes an engine forecast and grid under `data/cache/forecast/engine/` (gitignored).

The contract fixtures in `packages/contracts/fixtures/forecast/` stay the shape examples. `tests/test_forecast_contract.py` requires those files to match `fixtures_lib.forecast_fixtures` and to contain a `yield_t_ha` series plus a CAD income. The catalog's reference yields are null, so the engine omits yield and leaves income null. Replacing the fixture would fail that test. The live response was checked against the OpenAPI schema in this session.

A 10-year, 3-strategy forecast on Beltsville finished in about 1.0 s (budget 1.5 s). The same body, cached, is the in-memory copy.

## How to run

```sh
cd services/api && python -m pytest tests/test_forecast_service.py tests/qa tests/test_routes.py -q
python scripts/build_forecast_fixtures.py
```

## Tests

Full `services/api` suite: 213 passed in 10.50 s. That includes the QA label check, which now calls `forecast()`.

`test_forecast_service.py` covers determinism, two fields sharing one depth quota, the error codes, and a 15-cell grid whose first-place shares sum to 1.

## Acceptance

| Check | Result |
| --- | --- |
| Routes mounted and OpenAPI route set matches | Pass |
| Deterministic JSON | Pass |
| Every number has unit, basis, confidence | Pass |
| Absolute series have p10 and p90 | Pass |
| Income null without prices | Pass |
| OFFLINE seeds for curated sites | Pass (no live POWER call on the curated path) |
| Legacy rotation routes kept | Pass |
| Contract fixture replaced by engine output | Not done. See the yield/income note above. |

## Known gaps

- No field on the request uses 1 ha and slope `gentle`. That is stated in `assumptions`, not measured. TODO(verify).
- Rollup percentiles are area-weighted averages of the field percentiles, not a new ensemble.
- `cmip6_delta` still uses the linear ramp. No delta table is stored.
