# FT-W4 — Exposure and zones

Status: **DONE**, with empty spatial layers because W2 is blocked. Session A. 2026-11-15.

## What was built

`GET /sites/{site_id}/exposure` is implemented in `app/routers/exposure.py` and `app/twin/exposure.py`. It is not mounted in `app/main.py` (W9). The test mounts the router.

For UBC Farm, with no `crops` query, the crops are the default preset: maize then soybean.

Vulnerable weeks use the existing feature table and the existing 0.25 share (`thresholds.vulnerable_prob`). Only `frost_prob`, `heat_prob`, and `dry_spell_prob` are mapped, to `frost`, `heat`, and `drought`. Extreme rain is not called waterlogging. The growth stage is `in_ground` because stage lengths are not in the trait file. Planting windows are the trait-library days and are still marked TODO(verify).

Bare weeks are the preset years whose weekly mean cover is under 0.25. The cover curve is the unverified trait-library curve. `source` is `rotation_plan`. `scene_count` is null. `load_ndvi` returned None, so there is no NDVI cross-check.

Zones for UBC Farm are empty. `app/features/zones.py` gained `spatial_limits`, which returns notes and does not build polygons. No DEM, so no erosion zone and no frost pocket. No SMAP or ECOSTRESS, so no water-stress value at any scale, including one farm-level number. Terrain-backed sites still use `zones_for_terrain` for erosion and frost. A water-stress polygon is dropped unless a moisture grid was actually loaded.

`data_mode` is `limited_data` while any of the five satellite loaders returns None.

## How to run

```sh
cd services/api && uv run pytest tests/test_exposure.py tests/test_features.py -q
```

## Test results (2026-11-15)

```
services/api tests/test_exposure.py tests/test_features.py: 32 passed
```

`test_ubc_exposure_is_limited_and_has_no_zones` validates the body as `ForecastExposure`.

## Acceptance

- UBC Farm returns zones or a documented empty result: pass. Zones are empty. Resolution notes say the elevation grid and the moisture grids are absent.
- Water-stress hotspot never claims finer detail than its source: pass. No water-stress zone and no farm-level substitute number.

## Question for the team lead

Same as W2: Earthdata credentials are required before erosion, frost-pocket, or water-stress zones can be drawn for UBC Farm. A DEM that is not bare earth still needs the user-guide check named in `FT-W2.md`.
