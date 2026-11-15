# FT-EB4 — stored climate deltas, no seed written

## What was built

`load_cmip6_delta` reads `data/seed/<site_id>/cmip6_delta.json.gz`. None when the file is absent or has no `scenarios` object.

When `build_climate_outlook(..., climate_source="cmip6_delta")` finds a file, the contract preset selects a stored scenario:

| Preset | File key |
| --- | --- |
| baseline | no delta (historical slider stays) |
| drier_summers | ssp245 |
| wetter_winters | ssp245 |
| both | ssp585 |

`ssp245` and `ssp585` are not contract scenario names. They are keys inside the file. The request to add them as presets is in `docs/progress/forecast-requests.md`.

Seasonal precipitation p50 replaces the slider rain. Seasonal temperature p50 is added on the daily series by month. `temp_offset_c` in the response is the mean of those seasonal temperatures, because the scenario object has one temperature number. Heat-stress days ramp the seasonal delta from year 1 to year 10. A value outside the slider range (−3 to 5 degC, −50 to 50 percent) is not applied, and the slider stays.

`build_members(..., site_id=, climate_source="cmip6_delta")` uses the same file. Year 10 is the full seasonal p50. Year 1 is one tenth. With no file, or with `history_resample`, the slider ramp is unchanged. `forecast.py` does not pass the new keywords yet. That request is in `forecast-requests.md`.

## Licence — seed not written

Checked again 2026-11-15.

| Statement | What it says | URL |
| --- | --- | --- |
| AWS Open Data registry | As of September 2022, all NEX-GDDP-CMIP6 outputs are CC0 | https://registry.opendata.aws/nex-gddp-cmip6/ |
| NEX-GDDP-CMIP6 v2 tech note, June 2025, section 7 | Derivatives follow the CMIP6 terms. Each file's `cmip6_license` may restrict use | https://www.nccs.nasa.gov/wp-content/uploads/2025/06/NEX-GDDP-CMIP6-v2-Tech_Note.pdf |
| CMIP6 terms | Per-file licence | https://pcmdi.llnl.gov/CMIP6/TermsOfUse/TermsOfUse6-1.html |
| Published file attribute, still cited | `cmip6_license: CC-BY-SA 4.0` on one historical file | https://guide.cloudnativegeo.org/kerchunk/kerchunk-in-practice.html |

The variables in the tech note are daily `pr`, `tasmax`, and `tasmin`. The registry and the tech note do not state one licence. `scripts/seed_cmip6/build.py` exits 2 and writes nothing. No `cmip6_delta.json.gz` was added for the four curated sites. No Earthdata token was read.

## Files

- `services/api/app/twin/climate.py`
- `services/api/app/twin/weather_ensemble.py`
- `services/api/tests/test_cmip6.py`
- `scripts/seed_cmip6/build.py`

## How to run

```sh
cd services/api && python3 -m pytest -q
python3 scripts/seed_cmip6/build.py ; echo exit:$?
```

## Results

228 passed in 10.85 s. A synthetic file (not written under `data/seed`) sets Beltsville `drier_summers` summer rain to −10 percent and the ensemble's year-10 summer maximum to +1.5 degC. The same request with no file keeps summer rain at −20 percent and +1 degC. `history_resample` does not open the file. The build script returns exit 2.

## Gaps

Curated sites have no stored delta, so live outlooks and forecasts stay on the slider. The forecast route will not apply a future file until it passes `site_id` and `climate_source` into `build_members`.
