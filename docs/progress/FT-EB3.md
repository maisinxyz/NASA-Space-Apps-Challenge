# FT-EB3 — uncertainty rows and hindcasts from real seeds

## What was built

`uncertainty_layers` still returns the NASA POWER 55 km row and the SoilGrids 250 m row. Satellite rows are added only when a weekly file exists and `native_resolution_m` is a positive number. A missing file does not get an invented metre value. UBC Farm on current main still has no SMAP row.

Each satellite row states the year span, the share of year-weeks with `n_obs` above zero, and a confidence. Confidence is low when coverage is unknown, the record is shorter than 2 years, or coverage is under 0.30. It is high only at 5 or more years and coverage of at least 0.70. Those cuts are assumed.

Hindcasts, basis derived, confidence low, over overlapping weeks only:

- SMAP: rainfed weekly bucket for the preset's first crop, storage divided by that run's deepest root (m3/m3), versus the SMAP series. Correlation (unit 1) and bias (engine minus SMAP, m3/m3). Each year starts at profile capacity. Irrigation is off. `water.py` coefficients were not changed.
- ECOSTRESS: the same run's crop ET versus the stored series. Bias in mm is reported only when the file unit is `mm`, `mm/week`, or `mm/wk`. Other units are not converted.
- IMERG: `imerg.json.gz` is read here because `seeds.py` has no loader. Weekly POWER rain versus IMERG. Same unit rule.
- GRACE: a layer when the file has a resolution. The note says it is regional context and it is not scored.

A DEM row uses `native_resolution_m` or, if that is absent, the stored `res_m`. `bare_earth: false` keeps confidence low and says canopy or buildings may raise the surface. `dem_hrdem.json.gz` is preferred, same as EB2.

Flags: a missing loader still uses `layer_not_retrieved`. When the file exists, that sentence is dropped and a data-quality flag is used instead: `few_cloud_free_scenes` for NDVI or ECOSTRESS coverage under 0.50, `coarse_pixel` at or above 1000 m, `non_bare_earth` when the DEM says so. Those cuts are assumed.

## Files

- `services/api/app/twin/explain/uncertainty.py`
- `services/api/app/twin/explain/flags.py`
- `services/api/tests/test_twin_explain.py`

## How to run

```sh
cd services/api && python3 -m pytest -q
```

## Results

223 passed in 10.54 s. The absent-seed UBC rows are unchanged (POWER 55000 m, SoilGrids 250 m, no SMAP, station bias null). A synthetic coarse SMAP series reports correlation and bias in the resolution note. A W/m2 ECOSTRESS series does not invent a millimetre bias. GRACE is not correlated. Sparse NDVI is low confidence. The non-bare-earth DEM raises `non_bare_earth` and drops `layer_not_retrieved` for the patched loaders.

## Gaps

No curated site has these weekly files yet, so live forecasts still show only POWER and SoilGrids. Water coefficients were not retuned. There is no before/after coefficient table.

## Notes for other sessions

`imerg.json.gz` is read directly. A `load_imerg` helper is not required for this check. If Session A adds one, this reader can stay: it already returns None when the file is absent. Hindcast numbers sit in `resolution_note` because `UncertaintyLayer` has no correlation field and the contract was not changed.
