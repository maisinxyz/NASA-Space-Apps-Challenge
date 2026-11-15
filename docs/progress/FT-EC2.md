# FT-EC2 — Existing rotations for the two BC twins

Status: **done**. Session C. 2026-11-15.

## What was built

`site_ubc_farm` and `site_kpu_langley` now have the same `SITE_PRESETS` entry. Neither farm publishes its crop list. The name is exactly `Typical vegetable rotation (not this farm's records)`.

Slots:

- Year 1: `crop_cabbage` then `crop_rye_cover`
- Year 2: `crop_lettuce` then `crop_rye_cover`

Cabbage and lettuce are the two vegetables a Western Washington extension page dates (ballhead cabbage: direct seed by 1 July or transplant by 1 August; head and romaine lettuce sown in July). Fall rye is the late-harvest cover in Table 18 of the Lower Fraser Valley soil handbook. The year order is not a published sequence. **TODO(verify)** with the farms. Western Washington is not Langley.

A UBC forecast with no entered field rotation puts that name on the existing strategy label and in `assumptions`. Corn and soybean are no longer the starting rotation.

## Sources

- Soil Management Handbook for the Lower Fraser Valley, 2nd ed., 1991, Table 18: https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/agricultural-land-and-environment/soil-nutrients/610000-1_soil_mgmt_handbook_fraservalley.pdf
- WSU Snohomish, Fall and Winter Vegetable Gardens for Western Washington: https://extension.wsu.edu/snohomish/2013/12/18/fall-and-winter-vegetable-gardens-for-western-washington/

## Files

- `services/api/app/rotation/config.py` — the two presets and the source comment
- `services/api/app/rotation/engine.py` — a catalog crop missing from `traits.json` is skipped for timing instead of raising `KeyError`
- `services/api/app/rotation/evidence.py` — the same skip in the frost-risk sentence
- `services/api/app/services/forecast.py` — one assumption line naming the site preset
- `services/api/app/twin/climate.py` — docstring now says both BC twins use the vegetable preset
- `services/api/tests/test_exposure.py` — UBC exposure crops are cabbage, rye, lettuce
- `services/api/tests/test_kpu_langley.py` — preset contents, and the UBC forecast assumption
- `services/api/tests/test_features.py` — KPU zones stay `data_mode: seed`

`engine.py`, `evidence.py`, `forecast.py`, `climate.py`, `test_exposure.py`, and `test_features.py` are outside the Session C list. The preset cannot be served without the two `KeyError` guards, and the assumption line is what makes the name visible. Each change is the smallest edit that keeps the suite green.

## How to run

```bash
cd services/api && uv run pytest -q
```

## Results

Full `services/api` suite: 251 passed, 1 warning. The UBC forecast test asserts the preset name in `assumptions` and on the existing strategy label.

## Gaps

- Planting day-of-year for cabbage and lettuce is still null. The v1.1 rotation scorer does not time those two crops. Fall rye is timed from `traits.json`.
- The two farms share one preset because no farm-specific list was found.
- `GET /api/v1/sites/site_kpu_langley` returns the fixture card `KPU Langley (mock)`. `/features` and `/zones` stay `data_mode: seed`. The mock card wins only the site resource. `packages/contracts/fixtures/sites.json` was not edited. The EC1 note that this route was 404 is out of date.

## Notes for other sessions

Session B: `forecast()` still refuses KPU when SoilGrids summary is null. UBC is the site used to show the preset. Please keep the assumption line if you edit `_assumptions`.
