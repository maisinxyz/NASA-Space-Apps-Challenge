# FT-EA1 — Earthdata downloader core

Status: **DONE** for the downloader. No granule was downloaded. Session A stops after this workstream because `EARTHDATA_TOKEN` is unset in this environment.

## What was built

`scripts/seed_satellite/edl.py` is the seed-build HTTP client. It does not write `data/seed/` and it does not invent a measurement.

- Token: `EARTHDATA_TOKEN` from the environment. If that variable is unset, a repo-root `.env` is read when the file exists (`KEY=VALUE` only, never overrides a value that is already set, never printed). There is no `.env` on this machine.
- `Authorization: Bearer` is added only for `https` hosts ending in `.earthdata.nasa.gov` or `.earthdatacloud.nasa.gov`. Redirects are not followed by urllib. The client follows them and re-adds the header when the next hop is still an Earthdata host. A signed object-store URL does not receive the header. `http://` Earthdata hosts do not receive it either.
- Missing token and HTTP 401/403 raise an error that names the host and status only.
- CMR granule search URL: `https://cmr.earthdata.nasa.gov/search/granules.json` with `short_name`, `version`, `temporal`, and either `point` (longitude, latitude) or `bounding_box` (west, south, east, north). Parameter names and the `.json` extension are from https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html (read 2026-11-15). A public point query for `HLSL30` v2.0 at the UBC Farm coordinate for June 2024 returned `CMR-Hits: 6` (metadata only; no file was downloaded).
- `data_hrefs` keeps HTTPS `rel` values ending in `/data#` whose last path segment is a filename. A public `HLSL30` granule on 2026-11-15 used `http://esipfed.org/ns/fedsearch/1.1/data#` for the GeoTIFF files on `data.lpdaac.earthdatacloud.nasa.gov`. The same entry also tags Earthdata Search and AppEEARS as `data#`; those are dropped. `s3#` links are dropped.
- Ranged (`Range: bytes=start-end`) and full downloads land in `data/cache/earthdata/<host>/`. `data/cache/` is already gitignored, so that directory was not added to `.gitignore`.
- Retries: HTTP 429 and 5xx, plus connection failures. A numeric `Retry-After` is honored (CMR documents that header on the API page above) and capped at 60 seconds. Otherwise the pause is `1.0 * 2**attempt` seconds. Both numbers are assumed, not a published per-product quota.
- Concurrency cap: 2 in-flight requests (assumed politeness).
- `--sites` reads `app.features.config.CURATED_SITES`. An id that is not registered is printed as a skip and is not an error. With no `--sites`, every curated site is selected. `--check-token` exits 2 when the token is missing and prints `EARTHDATA_TOKEN is set` when it is present. It does not print the value and it does not download a product.
- Week index matches `app.features.pipeline`: `min((doy - 1) // 7, 51)`, so days 358-366 fold into week 51.

`scripts/seed_satellite/extract.py` is unchanged. It still writes gap records and still exits if a credential is present, because it is not a downloader.

`.env.example` already contains `EARTHDATA_TOKEN=` with no value. It was not edited.

## How to run

```sh
uv run --project services/api python scripts/seed_satellite/edl.py --sites site_ubc_farm site_not_registered_yet
uv run --project services/api python scripts/seed_satellite/edl.py --check-token
cd services/api && uv run pytest tests/test_satellite_edl.py tests/test_satellite_gap.py -q
```

## Test results (2026-11-15)

First run, before `git pull --rebase` brought in later `main` commits:

```
cd services/api && uv run pytest -q
231 passed, 1 warning in 13.38s
```

Re-run on this commit's tree (after that pull, which includes Session B's FT-EB2 and FT-EB3):

```
cd services/api && uv run pytest -q
237 passed, 1 warning in 12.10s
```

The warning is the existing Starlette/`httpx` deprecation in FastAPI's test client. The new file is `tests/test_satellite_edl.py` (URL building, redirect header handling, missing-token and rejected-token errors, week bucketing, ranged cache path, concurrency cap). No test calls NASA.

## Gaps

- `EARTHDATA_TOKEN` is not set. Checked with a presence test only (unset vs non-empty). The value was not printed.
- No `ndvi`, `smap`, `ecostress`, `grace`, `imerg`, or `dem` series was written. Loaders still return `None` where the gzip series is absent. UBC Farm still has the FT-W2 gap records.
- EA2 through EA7 were not started. They need the token to download.

## TODO(verify)

- Concurrency cap `2`, backoff base `1.0` s, and the 60 s `Retry-After` ceiling are assumed. The CMR API page documents 429 and `retry-after`, not these three numbers.
- `data_hrefs` filename rule is from one public `HLSL30` granule (2026-11-15). Confirm the same `rel` on SMAP, ECOSTRESS, NASADEM, IMERG, and GRACE responses when a download runs.

## Notes for the other sessions

Nothing new to read. `load_ndvi`, `load_smap`, `load_ecostress`, `load_grace`, and `load_dem` still return `None` until a later workstream writes the gzip series. `site_kpu_langley` is not registered; `edl.py --sites site_kpu_langley` skips it.
