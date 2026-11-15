# FT-EA2 — HLS NDVI

Status: **code done, no measurement.** 2026-11-15.

NASA CMR returned HTTP 401 when `EARTHDATA_TOKEN` was sent as `Authorization: Bearer`. No scene was opened. Each curated site has `ndvi.gap.json` (`data_mode: limited_data`, `weekly: null`). `load_ndvi` still returns `None`.

The secret present in this environment is not a JWT and NASA rejected it. The value was not printed, logged, or written into the gap files.

## What was built

`scripts/seed_satellite/ndvi.py` searches `HLSL30` v2.0 and `HLSS30` v2.0 at the site point for 2016-01-01 through 2025-12-31, reads B04 (red), L30 B05 or S30 B8A (narrow NIR), and `Fmask`, and writes the weekly mean of clear pixels inside 150 m.

- NDVI = (NIR − red) / (NIR + red). Scale 0.0001 cancels. Fill −9999 and stored values ≥ 12000 are dropped.
- Fmask: bits 1–5 masked (cloud, adjacent to cloud/shadow, cloud shadow, snow/ice, water). High aerosol is bits 6 and 7 both set. Bit 0 is reserved in HLS V2.0 and is not masked. Source: HLS User Guide V2, Table 9, https://lpdaac.usgs.gov/documents/1698/HLS_User_Guide_V2.pdf (read 2026-11-15). High-aerosol guidance: https://hls.gsfc.nasa.gov/algorithms/
- S30 saturation flag 12000: https://hls.gsfc.nasa.gov/products-description/s30/ . Applied to L30 as well. **TODO(verify)** an L30 saturation code; the L30 table that was read lists fill −9999 and scale 0.0001, not 12000.
- `n_obs` is the number of scenes in the week, not the pixel count. Empty weeks are null. Nothing is gap-filled.
- Record bound 2016–2025 is a choice. The same user guide says L30 starts in 2013 (Landsat 8) and S30 in 2015 (Sentinel-2).
- HLS-VI was not used. The product page names an NDVI layer, but the equation on that page is an image, so the NDVI filename was not verified. MOD13Q1 was not retrieved.
- DOIs from public granule links the same day: https://doi.org/10.5067/HLS/HLSL30.002 and https://doi.org/10.5067/HLS/HLSS30.002
- Licence: LP DAAC states its products are public domain (CC0), https://forum.earthdata.nasa.gov/viewtopic.php?t=5421 (read 2026-11-15).
- `EarthdataClient.resolve` follows redirects, re-adds the bearer token only on Earthdata hosts, and stops reading a signed-URL body after a small cap so a COG window can be read without sending the token to object storage.

Public CMR hit counts for 2016–2025 (metadata only, no download): Beltsville HLSL30 251 / HLSS30 927; Harford 940 / 1719; Oakville 597 / 1113; UBC Farm 499 / 943. Native resolution is 30 m. Weeks with data: 0. Cloud-free scenes read: 0.

## How to run

```sh
export EARTHDATA_TOKEN=...   # value is not printed
uv run --project services/api python scripts/seed_satellite/ndvi.py
cd services/api && uv run pytest -q
```

## Test results (2026-11-15)

Before `git pull --rebase` (four curated sites, no KPU yet):

```
cd services/api && uv run pytest -q
243 passed, 1 warning in 11.11s
```

After pulling `f2cb32a` (Session C registered `site_kpu_langley`; Session B added climate tests):

```
cd services/api && uv run pytest -q
253 passed, 2 failed, 1 warning in 13.55s
```

The two failures are `tests/test_features.py::test_mock_mode_only_for_mock_terrain` and `tests/test_kpu_langley.py::test_curated_routes_are_not_the_mock_site_list`. Both are Session C files. KPU is now a curated site, so `/sites/site_kpu_langley` returns 200 and zones `data_mode` is `seed`. Those tests still expect 404 and `mock`. This workstream did not edit them.

The warning is the existing Starlette/`httpx` deprecation. New tests: `tests/test_satellite_ndvi.py` and the redirect-resolve case in `tests/test_satellite_edl.py`. No test calls NASA.

## Gaps

- HTTP 401 on `cmr.earthdata.nasa.gov`. The four `ndvi.gap.json` files say that. No `ndvi.json.gz`.
- A successful rerun replaces the gap. After this run, `git pull` brought in `site_kpu_langley`. It has no `ndvi.gap.json` yet. The next layer run reads `CURATED_SITES` and will include it.

## Notes for the other sessions

`load_ndvi` is still `None` for every curated site. Do not treat the gap file as a weekly series.
