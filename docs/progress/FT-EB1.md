# FT-EB1 — feature table reads satellite seeds when they exist

## What was built

`build_table` now reads `load_ndvi`, `load_smap`, and `load_ecostress`.

- When NDVI weekly values exist, the table gains `ndvi` (unit and basis from the seed) and `ndvi_anomaly` (sigma, derived) against that file's own weekly mean and standard deviation. The years in the description are the years stored in the file.
- When SMAP weekly values exist, the table gains `smap_anomaly` the same way. A raw `smap` series is not added. The contract names `smap_anomaly` only.
- `quality.sources_agree` stays null when SMAP is absent. When both SMAP and POWER have overlapping year-weeks, it is true when the share of matching anomaly signs is at least `THRESHOLDS["smap_agree_share"]` (0.70, assumed, unchanged). Zero and missing weeks are skipped.
- A source row is added only when that layer's sidecar already has `source_name`, `license`, and `attribution`. No licence is filled in here.
- `limited_data` stays true only when soil and all three satellite loaders are empty. Curated sites with soil and no satellite file keep `limited_data: false`, which is today's fixture.
- ECOSTRESS is counted for `limited_data` and can add a source row. It is not a named feature id in the contract, so no `ecostress` series is invented.

When every loader returns None, the feature table matches the committed Beltsville fixture. That test passed.

## Files

- `services/api/app/features/pipeline.py` — `weekly_seed_grid`, `sign_agreement`
- `services/api/app/services/features.py` — satellite series inside `build_table`
- `services/api/tests/test_features.py` — present, absent, and disagreeing-sign cases on synthetic docs

## How to run

```sh
cd services/api && python3 -m pytest -q
```

`uv` is not installed in this environment. The suite used `python3 -m pytest`.

## Results

217 passed in 11.09 s. The Beltsville feature fixture is still byte-equal after JSON parse. Synthetic NDVI of 0.2 then 0.6 produces anomalies of opposite sign. Matching POWER and SMAP signs set `sources_agree` true; flipped POWER signs set it false.

## Gaps

No curated site has `ndvi.json.gz` or `smap.json.gz` on main yet, only gap records. The live tables therefore still omit the satellite series. Re-check after Session A lands the files.

## Notes for other sessions

ECOSTRESS weekly values are not mapped to a feature id. If the contract should grow an ET series, that is a contract change and was not done. Sidecars need `source_name`, `license`, and `attribution` or the feature series appears without a new source row.
