# FT-W10 — QA harness (first half)

Status: **harness done**. Final docs, the section 12 field check, the TODO(verify) report, and `scripts/smoke_forecast.py` wait until W9 has a real forecast response. Session C. 2026-11-15.

## What was built

`services/api/tests/qa/`

| Test | What it checks |
| --- | --- |
| `test_determinism.py` | Two calls to `build_climate_outlook` for all 4 curated sites and two presets produce the same canonical JSON. The cache is not used. |
| `test_offline.py` | `socket.socket.connect` raises. All 4 sites still return. |
| `test_labels.py` | Every number on the UBC outlook has unit, basis, and confidence. Heat-stress points have p10 and p90. POWER source has license and attribution. The support sentence constant matches the PRD. |
| `test_performance.py` | UBC climate outlook, caches cleared: cold under 1 s, cached under 150 ms (PRD section 9). |
| `test_hindcast.py` | `mean_bias` is POWER minus station on finite pairs, and None when there is no pair. UBC `station_gap.json` is `not_included` and there is no daily station file, so no bias is computed. |

Skipped until the other sessions push:

- Forecast absolute-estimate labels (`app.services.forecast.forecast`). W9 fills this in.
- Water mass-balance import (`app.twin.water.run_water_year`). W6a owns the real assertion.

## How to run

```sh
cd services/api && uv run pytest tests/qa tests/test_climate_outlook.py -q
```

## Test results (2026-11-15)

```
tests/qa: 7 passed, 2 skipped
tests/test_climate_outlook.py: 8 passed
```

## Not in this commit

`docs/data-and-methods.md`, the section 12 response check, the TODO(verify) report refresh, and the 4-site smoke script. Those are the W10 final step after W8 and W9.
