# FT-W10 — QA harness and final check

Status: **done**. Session C. 2026-11-15. W8 and W9 were already on `main` (`dc47a15`, `5cbc174`) before this final step. This note covers the harness and the final check.

## What was built

`services/api/tests/qa/`

| Test | What it checks |
| --- | --- |
| `test_determinism.py` | Two calls to `build_climate_outlook` for all 4 curated sites and two presets produce the same canonical JSON. The cache is not used. |
| `test_offline.py` | `socket.socket.connect` raises. All 4 sites still return. |
| `test_labels.py` | Every number on the UBC outlook has unit, basis, and confidence. Heat-stress points have p10 and p90. POWER source has license and attribution. The support sentence matches the PRD. A 2-member Beltsville forecast has the same labels, and absolute series have p10 ≤ p50 ≤ p90. `income_estimate` stays null when no per-tonne price was entered. |
| `test_performance.py` | UBC climate outlook, caches cleared: cold under 1 s, cached under 150 ms (PRD section 9). |
| `test_hindcast.py` | `mean_bias` is POWER minus station on finite pairs, and None when there is no pair. UBC `station_gap.json` is `not_included` and there is no daily station file, so no bias is computed. |
| `test_section12.py` | UBC forecast (2 members), climate outlook, exposure, and sensitivity match their OpenAPI schemas. Every response field named in PRD section 12 is present. A null value is allowed. `data_mode` is not `mock`. |

`docs/data-and-methods.md` lists each stored dataset with source, licence, attribution, resolution, and record, plus the layers that were not retrieved. Unverified wording is marked `TODO(verify)`.

`scripts/todo_verify_report.py` was re-run after that doc. It wrote 3582 items to `docs/todo-verify.md`.

`scripts/smoke_forecast.py` sets `OFFLINE=1` and calls climate-outlook, exposure, forecast, and sensitivity for `site_ubc_farm`, `site_usda_barc`, `site_cornell_ruminant`, and `site_ucdavis_oakville`, plus crop-catalog and glossary. It checks the schema, the section 12 fields, and that `data_mode` is not `mock`.

## How to run

```sh
make test
OFFLINE=1 python scripts/smoke_forecast.py
python scripts/todo_verify_report.py
```

## Test results (2026-11-15)

```
services/api: 214 passed
packages/contracts: 85 passed
apps/web: 46 files, 458 passed
```

Smoke (cold, this machine):

```
site_ubc_farm 0.50s
site_usda_barc 0.65s
site_cornell_ruminant 0.63s
site_ucdavis_oakville 0.65s
smoke ok: 4 sites, offline, section 12 fields present
```

## Known gaps

- Contract fixtures under `packages/contracts/fixtures/forecast/` were not replaced. `reference_yield` is null, so the engine omits yield, and income stays null without a farmer price. Replacing those fixtures would fail the contract tests. Recorded in `docs/progress/forecast-requests.md` (W9).
- `cmip6_delta` is still the linear history ramp. No NEX-GDDP-CMIP6 delta table is stored. See `docs/progress/FT-W3.md`.
- SMAP, ECOSTRESS, GRACE, NDVI, and DEM were not retrieved. `data_mode` is `limited_data`.
- Sensitivity rank shares are the first field only, and the grid does not apply seasonal rain on the request. Those limits are in `docs/progress/FT-W8.md`.
- Station bias stays null until an ECCC daily series is stored under a licence that allows it.
