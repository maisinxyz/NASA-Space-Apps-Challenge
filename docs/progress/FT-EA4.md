# FT-EA4 — ECOSTRESS evapotranspiration

Status: **BLOCKED**. 2026-11-15. No ETdaily value was stored.

`scripts/seed_satellite/ecostress.py` is in place. CMR rejected `Authorization: Bearer` with HTTP 401 on `cmr.earthdata.nasa.gov`. Each curated site has `ecostress.gap.json` (`data_mode: limited_data`, `weekly: null`). `load_ecostress` returns `None`. The token value was not printed, logged, or written into a file.

## What was built

The script searches `ECO_L3T_JET` version `003` at the site point and would write a weekly mean of `ETdaily`.

- Variable `ETdaily`, unit `mm/day`, basis `modeled`, native resolution 70 m. The DOI page lists that layer as float32, fill NaN, no scale factor: https://doi.org/10.5067/ECOSTRESS/ECO_L3T_JET.003 (read 2026-11-15). Temporal extent on that page starts 2018-07-09.
- The user guide calls `ETdaily` the median latent heat from PT-JPL-SM, STIC-JPL, PM-JPL, and BESS-JPL, upscaled to a sunrise-to-sunset integral in mm/day: https://github.com/ECOSTRESS-Collection-3/ECOv003-L3T-L4T-JET/blob/main/documentation/ECOv003_L3_L4_JET_User_Guide.md (Table 4, read 2026-11-15).
- A pixel is kept when `ETdaily` is finite, `cloud` is 0, and `water` is 0. The same guide says 0 is absence, 1 is presence, and 255 is fill. The DOI table gives no valid range, so a finite negative is not dropped.
- Footprint: mean of valid 70 m pixels within 150 m of the site point (the same radius as the HLS NDVI seed). `n_obs` is the scene count. Empty weeks stay null. Nothing is gap-filled.
- Weeks are 7-day blocks from 1 January. The date is the CMR `time_start` date. Search window: 2018-07-09 through 2026-11-14 (the day before `retrieved_on`).
- When two granules share orbit, scene, tile, and acquisition time, the higher product iteration number is kept. **TODO(verify)** that a higher iteration supersedes a lower one. The DOI page names the field and does not state the rule.
- Licence text is the DOI page ("openly shared, without restriction") plus the EOSDIS guidance that NASA-led mission data are CC0 unless marked, and the LP DAAC reuse note https://forum.earthdata.nasa.gov/viewtopic.php?t=6891 . **TODO(verify)** the exact citation string. The DOI page's citation button did not return one in the fetched text.

`load_ecostress` already reads `ecostress.json.gz`. No loader signature changed.

## Per site

Public CMR granule search, no `Authorization` header, 2018-07-09 through 2026-11-14. Metadata only. No GeoTIFF was opened. Weeks with data are 0 because the authenticated search returned HTTP 401 before any window was read. Native resolution below is the DOI page's 70 m, not a pixel size read from a file.

| Site | CMR granules | Years in the hit list | Tile on the sample granule | Weeks with data | Native resolution |
| --- | --- | --- | --- | --- | --- |
| `site_usda_barc` | 81 | 2025 (16), 2026 (65) | `18SUJ` | 0 | 70 m |
| `site_cornell_ruminant` | 192 | 2025 (34), 2026 (158) | `18TUM` | 0 | 70 m |
| `site_ucdavis_oakville` | 89 | 2025 (14), 2026 (75) | `10SEH` | 0 | 70 m |
| `site_ubc_farm` | 109 | 2019 (1), 2025 (12), 2026 (96) | `10UDV` | 0 | 70 m |
| `site_kpu_langley` | 121 | 2019 (1), 2025 (15), 2026 (105) | `10UEV` | 0 | 70 m |

Every listed site has tiles. None of them is an empty-coverage gap. The gap files say the token was rejected.

Observed in those CMR filenames, not read: some granules name the uncertainty layer `ETinstUncertainty.tif` and others `ETuncertainty.tif`. The DOI table says `Etuncertainty`. **TODO(verify)** which name is current. The weekly series uses `ETdaily` only.

One Beltsville pair shares orbit, scene, tile, and time with iterations `_01` and `_02`: `ECOv003_L3T_JET_44992_008_18SUJ_20260612T114528`. The script would keep `_02`. That file was not downloaded.

## How to run

```sh
export EARTHDATA_TOKEN=...   # value is not printed
uv run --project services/api python scripts/seed_satellite/ecostress.py
cd services/api && uv run pytest -q
```

A successful run replaces each `ecostress.gap.json` with `ecostress.json.gz`.

## Test results (2026-11-15)

```
cd services/api && uv run pytest -q
263 passed, 1 warning in 15.98s
```

The warning is the existing Starlette/`httpx` deprecation. New tests: `tests/test_satellite_ecostress.py` (mask, iteration, local GeoTIFF). No test calls NASA.

`tests/test_satellite_gap.py` accepts either an ECOSTRESS gap or a weekly series. `tests/test_features.py` and `tests/test_kpu_langley.py` treat `limited_data` as false when soil is null and a weekly satellite series is stored, which is what `features.py` already does. With these gaps, KPU stays `limited_data: true`.

## Question

The Cursor secret `earthdata` is set and was sent only as `Authorization: Bearer` to `cmr.earthdata.nasa.gov`. NASA returned HTTP 401. The value is 39 characters, contains spaces, and is not a JSON Web Token. Please replace that secret with the Earthdata Login bearer token. The value was not printed.
