# FT-W3 — Climate outlook

Status: **DONE**, on `history_resample`. Session C. 2026-11-15.

`GET /sites/{siteId}/climate-outlook` is implemented and not mounted. W9 registers it.

## Decision D2

Checked 2026-11-15. No NEX-GDDP-CMIP6 bytes were downloaded or stored.

| Check | Result | Source |
| --- | --- | --- |
| Daily rain, max temperature, min temperature | Present. CF names `pr` (kg m-2 s-1), `tasmax` (K), `tasmin` (K). Also `tas`. | NEX-GDDP-CMIP6 v2 tech note, June 2025, https://www.nccs.nasa.gov/wp-content/uploads/2025/06/NEX-GDDP-CMIP6-v2-Tech_Note.pdf |
| UBC Farm coverage | The published domain is 180 W to 180 E, 90 N to 60 S, 0.25 degree. UBC Farm at 49.2517 N, 123.238 W is inside that box. NCCS states 0.25 degree as about 25 km: https://www.nccs.nasa.gov/data-collections/nex-gddp-cmip6/ . The GMFD temperature-artifact box in the v2 note (50–71 N, 257–260 E) is central Canada, not this longitude. | Same tech note; site point from `docs/progress/FT-W1.md` |
| License allows this repo to store a seed | **Not settled.** The AWS open-data page says that as of September 2022 every output is CC0: https://registry.opendata.aws/nex-gddp-cmip6/ . The June 2025 tech note, section 7, says derivatives follow the CMIP6 terms and that each file's `cmip6_license` attribute may restrict use: https://pcmdi.llnl.gov/CMIP6/TermsOfUse/TermsOfUse6-1.html . A published open of one historical file still shows `cmip6_license: CC-BY-SA 4.0` (https://guide.cloudnativegeo.org/kerchunk/kerchunk-in-practice.html). | Those three pages |

Because (c) is not a clear yes, the fallback in the PRD is used: `history_resample`. `scripts/extract_nex_gddp_cmip6.py` prints that and writes nothing. `CLIMATE_SOURCE` in `app/twin/climate.py` is `history_resample`. Do not change the OpenAPI default to `cmip6_delta` until a file we would store has a license that allows this public repo. That request is in `docs/progress/forecast-requests.md`.

## What was built

`app/twin/climate.py` reads the existing POWER daily seed through `app.services.features.base` (no live call for a curated site).

- Seasonal mean of `T2M`: Theil–Sen slope (`scipy.stats.theilslopes`) and a two-sided Mann–Kendall p-value. `significant` is true only when the reported p-value is below 0.05. The 0.05 level is `basis: assumed`. **TODO(verify)** that alpha with the team. Trends are not copied into the 10 years.
- Scenario means and seasonal rain use the full preset (`apply_scenario`). Heat-stress days use the linear ramp: year 1 gets 1/10 of the temperature offset, year 10 gets all of it. 30 members, seeds from `member_seed(request_hash(...), member)`.
- Heat days are daily `T2M_MAX` at or above the catalog `heat_limit_c`, same inequality as the feature pipeline. A null limit is skipped (`crop_cabbage` is the test). The endpoint has no `crops` query, so the crops are the site preset (UBC Farm uses the default maize–soybean preset). Limits in the catalog are still **TODO(verify)**; the series is `confidence: low` and `needs_local_review: true`.
- Frost: last day before 1 July with `T2M_MIN` at or below `frost_c` (0 degC, the existing assumed threshold), and the first day on or after 1 July. 32 F is the NCEI freeze: https://www.ncei.noaa.gov/news/last-spring-freeze and https://www.ncei.noaa.gov/news/when-expect-first-fall-freeze . The 1 July split is **TODO(verify)**. Frost-free length is first-fall day-of-year minus last-spring day-of-year.
- Extreme-rain days use the baseline wet-day p95 from `baseline_thresholds` (not recomputed under the scenario). Multi-day events use `multi_day_window` 3 and `multi_day_factor` 1.5 from `features/config.py` (assumed). One event is a run of overlapping windows. Confidence on that count is `low`.
- Weekly water balance is the feature-table mean of rain minus Hargreaves–Samani ET0, same rounding. Seasonal totals are daily sums of that difference. This is not the field bucket (irrigation, crop ET, runoff, drainage). Those stay with W6a.
- SMAP, ECOSTRESS, and GRACE are `available: false` and null. `data_mode` is `limited_data` while any of them is missing. A later seed is used only if it already carries an anomaly series or a number with unit, basis, confidence, and a resolution note. Nothing is calculated from a different quantity.

## Hand check

Beltsville (`site_usda_barc`) year 2010, not a leap year. Last spring frost in the POWER seed is day 86, which is 27 March 2010. That day's `T2M_MIN` is −3.13 degC. The next day, day 87, is 0.87 degC. Test: `test_beltsville_2010_frost_matches_an_independent_scan`.

Across 1991–2024 the Beltsville median last spring frost is day 94.5 (p10 85.3, p90 104.1). Seasonal temperature slopes are all flagged significant (winter p 0.044). The ET0 slope is 1.199 mm/year with p 0.202, flagged not significant.

## How to run

```sh
cd services/api && uv run pytest tests/test_climate_outlook.py -q
python scripts/extract_nex_gddp_cmip6.py
```

This environment had no `uv` environment. The run below used `services/api/.venv` (Python 3.12), which is gitignored.

The route is not on the app yet. The test mounts the router. After W9:

```sh
curl 'localhost:8000/api/v1/sites/site_usda_barc/climate-outlook?scenario=drier_summers'
```

## Test results (2026-11-15)

```
services/api tests/test_climate_outlook.py: 8 passed
```

Cold `climate_outlook("site_usda_barc")` in a fresh process: 187 ms. Cached repeat: under 1 ms. Gate is under 1 s cold and under 150 ms cached.

## Acceptance

- Responses match `ClimateOutlook`: pass, four curated sites, baseline and a second preset.
- Beltsville weekly water balance equals the feature-table mean: pass.
- Trends carry p-values and a not-significant flag: pass. ET0 at Beltsville is the not-significant example.
- Hand-checked frost date for one site-year: pass, Beltsville 2010, day 86.
- `OFFLINE` path: the test replaces `power.get_daily` with a function that raises. Curated sites still return. No network call.

## Known gaps

- No `cmip6_delta` numbers. Slider presets are the four existing ones, labelled `built from observed years`.
- Local station bias is not in this response. `station_bias` is on the forecast `uncertainty` object (W8/W9). The daily ECCC series is still not in the seed (`FT-W1.md`).
- Heat-stress crops are the preset, not a farmer selection. The contract has no crops query on this path.
- Mann–Kendall variance formula: Gilbert (1987). **TODO(verify)** a stable URL.
- Significance alpha 0.05 is assumed.
