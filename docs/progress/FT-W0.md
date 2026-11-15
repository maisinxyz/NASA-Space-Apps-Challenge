# FT-W0 — Contract v1.2.0 and shared types

Status: **DONE**. Session A. 2026-11-15.

## What was built

- `services/api/app/twin/types.py` and `app/twin/__init__.py`: dataclasses from PRD §6.4, including concrete `PlanYear`, `WaterYearResult`, and `State`, plus `request_hash` (full sha256 hex of sorted JSON) and `member_seed` (`int(sha256(req_hash + member_index)[:8], 16)`).
- `packages/contracts/openapi.yaml` bumped **1.1.0 → 1.2.0**, additive only. New operations: `getClimateOutlook`, `getExposure`, `listCropCatalog`, `createForecast`, `createForecastSensitivity`. New error codes: `SELECTION_TOO_SMALL`, `INVALID_QUOTA`, `HORIZON_OUT_OF_RANGE` (all 422). `DataMode` gains `limited_data`.
- Deterministic fixtures (generator `packages/contracts/fixtures_lib/forecast_fixtures.py`). `data_mode` is `mock`. Numbers are placeholders (0, or 100 for an index). Unverified catalog numerics are `null`, not invented defaults. Satellite layers are `available: false`.
- Contract tests in `packages/contracts/tests/test_forecast_contract.py` and `services/api/tests/test_twin_types.py`.

Component name `ForecastExposure` is the JSON field `exposure`. v1.1 `Exposure` is unchanged. Details for the other sessions are in `docs/progress/forecast-requests.md`.

## Files

- `services/api/app/twin/types.py`, `services/api/app/twin/__init__.py`
- `services/api/tests/test_twin_types.py`
- `packages/contracts/openapi.yaml`, `packages/contracts/README.md`
- `packages/contracts/fixtures_lib/forecast_fixtures.py`
- `packages/contracts/fixtures/forecast/*.json`, `fixtures/crop_catalog.json`, `fixtures/errors/{SELECTION_TOO_SMALL,INVALID_QUOTA,HORIZON_OUT_OF_RANGE}.json`
- `packages/contracts/tests/test_fixtures_valid.py`, `packages/contracts/tests/test_forecast_contract.py`
- `docs/progress/forecast-requests.md`, this note

`apps/web/` was not touched. The frontend regenerates types with `make types`.

## How to run

```sh
cd packages/contracts && uv run pytest -q
cd services/api && uv run pytest tests/test_twin_types.py -q
cd packages/contracts && uv run python -m fixtures_lib.forecast_fixtures
npx @redocly/cli@1.34.3 lint packages/contracts/openapi.yaml
```

## Test results (2026-11-15)

```
packages/contracts: 84 passed
services/api tests/test_twin_types.py: 3 passed
redocly lint: valid, 0 errors, 6 warnings (info-license, 4xx on /health /sites /crops /glossary, unused ProgressEvent). Same class of warnings as v1.1; no new errors.
```

## Known gaps

- Fixtures are not engine output. W9 replaces them.
- `API_VERSION` in `app/core/config.py` is still `1.1.0` (not Session A's file). Requested in `forecast-requests.md`.
- `climate_source` schema default is `history_resample` until W3 verifies a dataset.
- Crop catalog fixture is the 12 existing commodity crops plus null v2 numerics. W5 replaces it with 40+ sourced crops.
- Significance alpha `0.05` in the climate fixture is an assumed placeholder on a `Number` (`basis: assumed`), not a chosen project threshold.
- `native_resolution_m: 55000` on the fixture uncertainty row is the existing POWER grid size from `app/features/config.py`, labelled as a placeholder row.

## Acceptance

- `packages/contracts` tests pass: yes.
- Version bumped: yes, `1.2.0`.
- Message to the team: this note and `docs/progress/forecast-requests.md`.
- `Number` has unit, basis, confidence: checked by `test_every_number_has_unit_basis_and_confidence`.
- Absolute estimates have a p10/p90 range: checked by `test_absolute_estimates_have_a_range_and_support_sentence`.
- Support sentence present on the forecast fixture: yes.
