# FT-EB5 — offline budgets, and no satellite seeds on main yet

## What was built

Curated sites already keep POWER in the `base()` cache and the forecast in an in-process map. This workstream adds two more caches:

- `load_cmip6_delta` keeps the parsed delta file (or the miss) for the process.
- The rainfed hindcast weeks are cached per site. A second SMAP comparison does not rerun the bucket. `water.py` was not changed.

`OFFLINE=1` runs a 2-member forecast for every curated site with sockets refused. A cold UBC climate outlook stays under 1 s. A cold 30-member, 10-year, 3-strategy forecast stays under 1.5 s. The same forecast from the memory cache stays under 100 ms.

Absence checks now look at the loader. When `ndvi.json.gz`, `smap.json.gz`, or a DEM file is actually stored, the Beltsville fixture comparison, the UBC exposure test, and the uncertainty test assert the present-data rows instead of the empty ones.

## Files

- `services/api/app/twin/climate.py` (`lru_cache` on `load_cmip6_delta`)
- `services/api/app/twin/explain/uncertainty.py` (`lru_cache` on the hindcast weeks)
- `services/api/tests/test_climate_outlook.py`
- `services/api/tests/test_features.py`
- `services/api/tests/test_exposure.py`
- `services/api/tests/test_twin_explain.py`

## How to run

```sh
cd services/api && OFFLINE=1 python3 -m pytest -q
```

## Results

243 passed in 13.89 s. Measured just before that, with `OFFLINE=1`:

| Call | Time | Budget |
| --- | --- | --- |
| UBC climate outlook, cold | 0.190 s | 1 s |
| UBC forecast, 30 members, cold | 0.326 s | 1.5 s |
| Same forecast, memory cache | 0.002 s | 100 ms |

All four curated sites returned a forecast with `data_mode` other than `mock` while `socket.connect` was refused.

## Session A seeds

Not on main at this commit. `data/seed/site_ubc_farm/` has `power_daily.json.gz` and gap records. There is no `ndvi.json.gz`, `smap.json.gz`, `dem.json.gz`, or `dem_hrdem.json.gz`. UBC features, zones, and uncertainty rows are therefore still the POWER-and-soil set.

Re-run after Session A stores the layers:

```sh
git pull --rebase origin main
ls data/seed/site_ubc_farm/ndvi.json.gz data/seed/site_ubc_farm/smap.json.gz data/seed/site_ubc_farm/dem.json.gz
cd services/api && OFFLINE=1 python3 -m pytest -q tests/test_features.py tests/test_exposure.py tests/test_twin_explain.py
```

`scripts/seed_satellite/extract.py` currently writes gap records for UBC only. It does not download granules.

## Gaps

`seeds.py` itself is not cached. The feature table and `base()` caches cover the request path. A process that gains a new `cmip6_delta.json.gz` without a restart will keep the cached miss.
