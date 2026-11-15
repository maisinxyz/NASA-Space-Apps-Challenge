# FT-EB2 — exposure cross-check and DEM zones

## What was built

Bare-field windows stay on the rotation plan when `load_ndvi` returns None. When a weekly NDVI seed exists, one extra window uses `source: ndvi`. Weeks whose mean NDVI is below 0.2 are listed. That cut is assumed. TODO(verify) against the USGS Landsat NDVI page (barren surfaces often 0.1 or less; sparse vegetation about 0.2 to 0.5): https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index . `scene_count` is the sum of `n_obs` on those weeks. It is null when `n_obs` is missing.

SMAP weeks below that series' own annual mean, and ECOSTRESS weeks above its own annual mean, are written as caveats. They name overlap with POWER drought weeks. They do not add a hazard and they do not relabel extreme rain as waterlogging.

`zones_from_elevation` draws erosion-risk polygons from slope above the clip's 80th percentile and frost-pocket polygons from the lowest 10 percent of elevation. Both cuts are the existing assumed percentiles. Flow accumulation is not in the elevation seed, so erosion is slope only. Outlines use a spherical metres-to-degrees step (111320 m per degree). TODO(verify) against Snyder, USGS Professional Paper 1395: https://pubs.usgs.gov/pp/1395/report.pdf

`dem_hrdem.json.gz` is preferred when the file exists. Otherwise `load_dem` is used. No file still returns the previous empty collection and the same caveat.

A SMAP series becomes one farm polygon. When `native_resolution_m` is at least the clip width, `resolution_note` says the pixel is coarser than the farm and that sub-field polygons were not drawn. `bare_earth: false` adds a canopy/buildings caveat. `bare_earth: true` does not.

## Files

- `services/api/app/features/zones.py`
- `services/api/app/services/features.py` (`zones` only)
- `services/api/app/twin/exposure.py`
- `services/api/tests/test_exposure.py`

## How to run

```sh
cd services/api && python3 -m pytest -q
```

## Results

221 passed in 10.39 s. UBC Farm with no elevation file still has empty zones, `limited_data`, and only `rotation_plan` windows. A synthetic 8 by 8 hill with a 9000 m SMAP series returns erosion, frost, and exactly one water-stress polygon. The NDVI fixture counts 20 cloud-free observations on 10 bare weeks.

## Gaps

No curated site has `dem.json.gz` or `dem_hrdem.json.gz` on main yet. Live zone collections stay empty until Session A stores one.

## Notes for other sessions

`seeds.py` was not changed. `dem_hrdem.json.gz` is read directly from `data/seed/<site_id>/`. It should use the same elevation object as `dem.json.gz` (elevation, res_m, origin as lon/lat of the upper-left cell centre, bare_earth).
