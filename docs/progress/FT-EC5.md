# FT-EC5 — QA for five sites

Status: **done**, with the KPU forecast still refused. Session C. 2026-11-15.

## What was checked

`git pull --rebase` at the start was already up to date with `96e53a4`.

Session A has NDVI gap sidecars for the four older sites (`data/seed/<site>/ndvi.gap.json`), not a weekly value series, and none for `site_kpu_langley`. No `ndvi.json.gz`, SMAP, ECOSTRESS, GRACE, IMERG, DEM, or `cmip6_delta` file is in `data/seed/`. The smoke run therefore uses POWER, SoilGrids, and the catalog only.

`OFFLINE=1 python scripts/smoke_forecast.py` covers all five curated sites. Climate outlook and exposure return 200 for KPU. Forecast and sensitivity return 503 `DATA_SOURCE_UNAVAILABLE` because the SoilGrids summary is null. The script records that and still exits 0. The other four sites return 200 on every route, with no mock `data_mode` and a null income.

`scripts/build_forecast_fixtures.py` writes engine JSON for the four sites that have soil, under gitignored `data/cache/forecast/engine/`, and skips KPU.

The two BC twins are not the same record: POWER geometry and 1991 `T2M` differ, UBC has a soil summary, KPU's is null, and there is no `shares_power_cell_with` flag.

`GET /api/v1/sites/site_kpu_langley` still returns the fixture card `KPU Langley (mock)`. `/features` and `/zones` stay `data_mode: seed`.

## Files

- `services/api/tests/qa/test_offline.py`
- `services/api/tests/qa/test_determinism.py`
- `services/api/tests/test_climate_outlook.py`
- `services/api/tests/test_kpu_langley.py`
- `scripts/smoke_forecast.py`
- `scripts/build_forecast_fixtures.py`
- `docs/data-and-methods.md`
- `docs/todo-verify.md` (regenerated)

## How to run

```bash
cd services/api && uv run pytest -q
OFFLINE=1 uv run --project services/api python scripts/smoke_forecast.py
python scripts/todo_verify_report.py
```

## Results

`services/api`: 258 passed, 1 warning. Smoke exited 0. The five-site line is `smoke ok: 5 sites, offline...`

## Still open

- KPU forecast and sensitivity until SoilGrids returns means or `forecast()` accepts a null summary.
- Planting day-of-year, so cabbage `yield_t_ha` stays omitted.
- Lettuce Ky is not in FAO Paper 33 Table 1.
- Nitrogen rates are ranges and stay null.
- Langley has no stored Köppen class.
- The mock site card still wins `GET /sites/site_kpu_langley`.
- No satellite or DEM series for KPU yet. That is Session A's.
