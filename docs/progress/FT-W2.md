# FT-W2 — Satellite and regional seeds

Status: **BLOCKED**. Session A. 2026-11-15.

No measurement was written. Loaders return `None`. Gap records use `data_mode: limited_data`.

## Why it is blocked

`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, and `EARTHDATA_TOKEN` were unset. There is no `.env`. `.env.example` names the first two and leaves them empty. Without a login this session did not download HLS, SMAP, ECOSTRESS, IMERG, GRACE-FO, or a DEM, and it did not invent weekly values.

## What was verified on the public CMR search

Search host: `https://cmr.earthdata.nasa.gov/search/collections.json` on 2026-11-15. Titles below are the titles CMR returned.

| Layer | Short name | Version | Title CMR returned |
| --- | --- | --- | --- |
| Vegetation indices (NDVI band name not confirmed) | HLSL30_VI | 2.0 | HLS Operational Land Imager Vegetation Indices Daily Global 30 m V2.0 |
| Vegetation indices | HLSS30_VI | 2.0 | HLS Sentinel-2 Multi-spectral Instrument Vegetation Indices Daily Global 30 m V2.0 |
| SMAP L4 root zone, 9 km, from the title | SPL4SMGP | 008 | SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data V008 |
| SMAP L3, 36 km, from the title | SPL3SMP | 009 | SMAP L3 Radiometer Global Daily 36 km EASE-Grid Soil Moisture V009 |
| ECOSTRESS ET | ECO_L3T_JET | 003 | ECOSTRESS Tiled Evapotranspiration PT-JPL Instantaneous and Daytime L3 Global 70 m v003 |
| ECOSTRESS ET | ECO_L3G_JET | 002 | ECOSTRESS Gridded Evapotranspiration Instantaneous and Daytime L3 Global 70 m V002 |
| ECOSTRESS ET, CONUS in the title | ECO_L3T_ET_ALEXI | 002 | ECOSTRESS Tiled Evapotranspiration disALEXI 24-Hour L3 CONUS 70 m V002 |
| GRACE / GRACE-FO mascon | TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4 | RL06.3Mv04 | JPL GRACE and GRACE-FO Mascon … CRI Filtered Release 06.3 Version 04 |
| GRACE / GRACE-FO mascon | TELLUS_GRAC-GRFO_MASCON_GRID_RL06.3_V4 | RL06.3Mv04 | JPL GRACE and GRACE-FO Mascon … Release 06.3 Version 04 |
| DEM | NASADEM_HGT | 001 | NASADEM Merged DEM Global 1 arc second V001 |
| IMERG (no loader in the owned list; not stored) | GPM_3IMERGDF | 07 | GPM IMERG Final Precipitation L3 1 day 0.1 degree x 0.1 degree V07 |

`ECO3ETPTJPL` was queried and returned no collection. It is not used.

The HLS summaries that were read say "vegetation indices" and do not name an NDVI band. **TODO(verify)** the band list. SMAP L3 vs L4 was not chosen. AppEEARS was not called. The CONUS ECOSTRESS product may not cover UBC Farm. **TODO(verify)**. GRACE grid spacing was not in the titles. **TODO(verify)**. The NASADEM summary does not say bare earth. The user guide was not opened: https://lpdaac.usgs.gov/documents/2237/NASADEM_User_Guide_V13.pdf and https://doi.org/10.5067/MEASURES/NASADEM/NASADEM_HGT.001

Collection licences were not copied. **TODO(verify)** before any download.

## Files

`scripts/seed_satellite/extract.py` writes `data/seed/site_ubc_farm/{ndvi,smap,ecostress,grace,dem}.gap.json` plus sidecars. It exits if credentials are present, because it still has no downloader and must not pretend a download happened.

`load_ndvi`, `load_smap`, `load_ecostress`, `load_grace`, and `load_dem` in `app/features/seeds.py` return a gzip series only when that file exists and has a weekly list (DEM: an elevation field). Otherwise they return `None`.

The other curated sites were not given gap files.

## How to run

```sh
uv run --project services/api python scripts/seed_satellite/extract.py
cd services/api && uv run pytest tests/test_satellite_gap.py tests/test_ubc_farm.py -q
```

## Test results (2026-11-15)

```
services/api tests/test_satellite_gap.py tests/test_ubc_farm.py tests/test_features.py: 31 passed
```

## Question for the team lead

Please provide an Earthdata Login username and password (or a token) if these layers should be filled. Until then the forecast stays on POWER and SoilGrids only, and exposure must not draw satellite zones.
