# FT-W6a — water, infiltration, weather ensemble, yield

## What was built

Weekly FAO-56 bucket and a 30-member deterministic weather ensemble.

- `app/twin/weather_ensemble.py` — `build_members`. Samples historical years with `member_seed`. Linear ramp from year 0 (no change) to `ramp.years` (full slider). Seasonal rain uses `features.pipeline.season_months`. ET0 is rescaled with the Hargreaves temperature factor when tmax and tmin shift together. `cmip6_delta` has no per-year delta on `ScenarioApplied`, so both climate sources use this ramp.
- `app/twin/water.py` — `run_water_year`, `year_profile`, `infiltration_factor`. Mass balance `rain + irrigation = ETc + runoff + drainage + Δstorage`. Storage cannot go negative. The profile holds water down to the year's deepest root, so a growing root zone does not start dry. `lat`, `catalog`, `no_till`, and `storage_start_mm` are keyword-only.
- `app/twin/config.py` — coefficients, disclaimer, FAO-33 Ky table, FAO-56 Table 19 TAW midpoints. Started here and also holds the W6b/W7 coefficients so there is one list.

Yield is `Ym * (1 - Ky * (1 - ETa/ETm))` times an assumed heat/frost penalty. Ky comes from the catalog when set, otherwise from FAO Paper 66 Table 1 (Paper 33 season totals) for the crops in `KY_FAO33`. A null `reference_yield` is omitted. Forage yield is the same tonnes for crops with category `forage` or forage use `grazing|hay|silage`.

## How to run

```sh
cd services/api && python -m pytest tests/test_twin_water.py -q --noconftest
```

This environment had no project venv. The run used system Python 3.12 with user-installed numpy, pytest, and fastapi.

## Tests

`tests/test_twin_water.py`: 6 passed.

- Mass balance within 1e-6, including a binding quota.
- Dry year, no irrigation: storage stays non-negative and irrigation need is still reported.
- Unstressed maize with `reference_yield` 10 t/ha stays at 10; a dry year is lower; a null reference yield is omitted.
- Forage category copies that yield into `forage_yield_t_ha`.
- Ensemble is byte-stable. Year 1 is 10% of a 10-year ramp; year 10 is the full slider. Summer weeks use the seasonal rain override. Southern hemisphere flips that week.

## Known gaps

- Compaction is named in the PRD and is not a field on `FieldCfg`. No compaction multiplier.
- Vegetable rows in `catalog_v2.json` have null season windows and null Kc. They add no cover and no ET. See `docs/progress/forecast-requests.md`.
- Heat and frost penalties (0.05 per week) are assumed.
- Infiltration multipliers are assumed.
- Absolute yield p10/p90 is aggregated in W6c, not on one member-year.

## For the next workstream

`run_water_year` returns the weekly terms W6b needs (`drainage_mm`, `cover`, `bare_weeks`, `storage_end_mm`) and the point yields W6c aggregates.
