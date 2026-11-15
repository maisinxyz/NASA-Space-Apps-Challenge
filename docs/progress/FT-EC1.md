# FT-EC1 — Register site_kpu_langley

Status: **done**. Session C. 2026-11-15. `EARTHDATA_TOKEN` was not in this environment. This workstream does not download Earthdata.

## Location

- **Address:** 20901 Langley Bypass, Langley, B.C. V3A 8G9. Source: https://www.kpu.ca/langley (also https://www.kpu.ca/contact), read 2026-11-15. Those pages do not publish latitude or longitude.
- **Point used:** 49.1093 N, 122.6454 W. Province of British Columbia address geocoder parcel point, rounded to 4 decimals from `[-122.6454338, 49.1093175]`.
  - Query: https://geocoder.api.gov.bc.ca/addresses.json?addressString=20901%20Langley%20Bypass%20Langley
  - `searchTimestamp` `2026-11-14T22:03:35`, `baseDataDate` `2026-07-07`, `isOfficial` true, `matchPrecision` `CIVIC_NUMBER`, `locationPositionalAccuracy` `high`, `locationDescriptor` `parcelPoint`, `fullAddress` `20901 Langley Bypass, Langley, BC`.
  - Licence named by the response: Open Government Licence – British Columbia, version 2.0, https://www2.gov.bc.ca/gov/content?id=A519A56BC2BF44E4A008B33FCF527F61 . Attribution: Contains information licensed under the Open Government Licence – British Columbia.
- **Not used:** OpenStreetMap way 538627375 (49.109162, -122.645172) in `apps/web/lib/farms/candidates/kpu-langley.ts`. Fallback only.
- **Not used:** a plant-sale page lists the greenhouses at 20902 Langley Bypass (https://www.kpu.ca/events/kpu-school-horticulture-plant-sale-0). A separate geocoder query for that civic number returned `[-122.6411518, 49.1086791]` (`searchTimestamp` `2026-11-14T22:06:58`, same licence). **TODO(verify)** which parcel is the horticulture field.
- `farm_id` is `kpu-langley`. Name is `KPU Langley, School of Horticulture`.

## Weather cell

POWER header has no latitude or longitude. The payload geometry does.

| Site | Geometry (lon, lat, elevation m) | 1991 `T2M` |
| --- | --- | --- |
| `site_kpu_langley` | -122.645, 49.109, 148.97 | 365 days |
| `site_ubc_farm` | -123.238, 49.252, 565.27 | 365 days, different values |

The cells are not the same. `shares_power_cell_with` was not added.

## Seeds

| File | What |
| --- | --- |
| `data/seed/site_kpu_langley/power_daily.json.gz` | NASA POWER daily, 1991-01-01 through 2024-12-31. 12419 days. Fill value −999 count is 0 on every parameter. |
| `data/seed/site_kpu_langley/soil.json` | SoilGrids 2.0 point query. Every requested mean is null. `summary` is null. No texture class was assigned. `query_time_s` on the cached response was 5.73 s. |
| `data/seed/site_kpu_langley/station_gap.json` | Identity only. Nearest MSC climate-stations point: LANGLEY REGIONAL, climate identifier 1104570, STN_ID 55460, geometry [-122.63083333333333, 49.100833333333334], elevation 10.40 m. Great-circle distance from the unrounded geocoder point is 1.42 km. Daily series not stored (same redistribution caveat as UBC). Source: https://api.weather.gc.ca/collections/climate-stations/items?CLIMATE_IDENTIFIER=1104570&f=json |
| `packages/contracts/fixtures/features/site_kpu_langley.json` | Feature table. `data_mode` is `seed`. `soil` is null. `quality.limited_data` is true. |

`scripts/build_seed.py` writes a feature fixture for any site named in `SEED_SITES`. The POWER sidecar note comes from the site's `coord_note` instead of a UBC-only sentence. A null SoilGrids mean does not get a texture.

## Mock check

`GET /api/v1/sites/site_kpu_langley` is 404 `NOT_FOUND`. That id is not in `packages/contracts/fixtures/sites.json`. `GET /features` and `GET /zones` return `data_mode: seed`. No mock body replaces the curated path.

## How to run

```sh
SEED_SITES=site_kpu_langley uv run --project services/api python scripts/build_seed.py
cd services/api && uv run pytest -q
```

## Test results (2026-11-15)

```
services/api: 249 passed
```

Pulled Session B's EB1–EB5 before the commit. `forecast()` raises `DATA_SOURCE_UNAVAILABLE` when the soil summary is null, so `test_offline_budgets_for_every_curated_site` skips a site with no soil summary. KPU is that site. Features, hazard calendar, and zones still answer offline.

## Notes for other sessions

- Session A: `site_kpu_langley` is in `CURATED_SITES`. Satellite and DEM seeds are still absent. Loaders return None.
- Session B: the two BC twins do not share a POWER cell. SoilGrids means at the KPU point are null, so the feature table is `limited_data`. `tests/test_features.py` now allows a curated site with `soil: null` and `limited_data: true`. That file is Session B's; the change is only that assertion.
- `EARTHDATA_TOKEN` was not available here.
