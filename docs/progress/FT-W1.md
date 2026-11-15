# FT-W1 — UBC Farm site and base seeds

Status: **DONE**, with one documented data gap (local station daily series not stored). Session A. 2026-11-15.

## What was built

`site_ubc_farm` is a curated site. `GET /sites/site_ubc_farm/features` runs from seed with `OFFLINE=1` (`data_mode: seed`).

### Location (verified as far as the sources go)

- **Address, official:** 3461 Ross Drive, Vancouver, BC, Canada V6T 1Z4. Source: https://ubcfarm.ubc.ca/ (read 2026-11-15). That page does not publish latitude or longitude.
- **Point used for POWER and SoilGrids:** 49.2517 N, 123.238 W. This is the Province of British Columbia address geocoder access point for that civic address, rounded to 4 decimals from `[-123.237981, 49.2517018]`.
  - Query: https://geocoder.api.gov.bc.ca/addresses.json?addressString=3461%20Ross%20Drive%20Vancouver
  - Response `searchTimestamp` `2026-11-14T20:15:28`, `baseDataDate` `2026-07-07`, `isOfficial` true, `matchPrecision` `BLOCK`, `locationPositionalAccuracy` `low`, `locationDescriptor` `accessPoint`, `fullAddress` `3461 Ross Dr, Vancouver, BC`.
  - Licence named by the response: Open Government Licence – British Columbia, version 2.0, https://www2.gov.bc.ca/gov/content?id=A519A56BC2BF44E4A008B33FCF527F61 (read 2026-11-15). That page says the licence applies to B.C. Data Catalogue records that specify it. Attribution: Contains information licensed under the Open Government Licence – British Columbia.
- **TODO(verify):** a field centroid published by UBC. The farm map PDF has no coordinates: https://lfs-ubcfarm-clone-2018.sites.olt.ubc.ca/files/2023/06/ubcfarmmap_large2023.pdf
- `farm_id` is `ubc-farm`, the same id as `apps/web/lib/farms/candidates/ubc-farm.ts`. The web app has not promoted that candidate into the live farm list. Session A did not edit `apps/web/`.

NASA POWER's client sends the point at 3 decimals, so the downloaded series is for **49.252, -123.238**.

### Seeds

| File | What |
| --- | --- |
| `data/seed/site_ubc_farm/power_daily.json.gz` | NASA POWER daily, community AG, 1991-01-01 through 2024-12-31. 34 years, 12419 days, fill value −999 count is 0 on every parameter (`PRECTOTCORR`, `T2M`, `T2M_MAX`, `T2M_MIN`, `GWETROOT`, `GWETTOP`). Product version in the payload header: POWER Daily API v2.10.3. |
| `data/seed/site_ubc_farm/soil.json` | SoilGrids 2.0 point query. 0–30 cm summary: loam, sand 39.8%, silt 42.6%, clay 17.7%, SOC 46.8 g/kg, pH 5.5. Modeled, not a soil test. |
| `data/seed/site_ubc_farm/station_gap.json` | No daily station series. See the gap below. |
| `packages/contracts/fixtures/features/site_ubc_farm.json` | Feature table from those seeds, for the contract tests. |

`scripts/build_seed.py` accepts `SEED_SITES=site_ubc_farm` so a rebuild does not refetch the other curated sites. A full `make seed` still rebuilds every site.

`packages/contracts/schemas/feature_table.schema.json` was regenerated from OpenAPI 1.2.0 because `tests/test_features.py::test_feature_schema_file_is_current` compares it to the spec.

Not added to `packages/contracts/fixtures/sites.json`. That file is the mock site list (`test_mock_labels` requires `(mock)` in every name) and UBC Farm has no terrain package.

## Local station gap

Candidate: **VANCOUVER UBC**, climate id **1108487**, 49.25 N, 123.25 W, elevation 76 m. Source read 2026-11-15: https://climat.meteo.gc.ca/climate_normals/results_e.html?climate_id=1108487 (49°15'00" N, 123°15'00" W). This is the climate station, on the order of 1 km from the address point, not the field.

Daily observations were **not** copied. https://climate.meteo.gc.ca/prods_servs/attachment1_e.html allows redistribution only if no fee is charged for the ECCC product and each further recipient agrees to the same restrictions before use. A public git seed does not collect that agreement. The FAQ citation line is separate: https://climate.weather.gc.ca/FAQ_e.html (“Extracted from the Environment and Climate Change Canada Historical Climate Data web site…”). **TODO(verify)** which terms cover a daily CSV in this repo. Until then `station_bias` stays null. No values were invented.

## Dataset notes for `docs/data-and-methods.md` (Session C owns that file)

| Dataset | Source | Licence | Attribution | Resolution | Record | Limit |
| --- | --- | --- | --- | --- | --- | --- |
| NASA POWER daily point, community AG | https://power.larc.nasa.gov/docs/services/api/ | No restrictions on use; citation requested (wording already in `app/features/config.py`) | NASA Langley Research Center POWER Project | about 0.5° × 0.625° (about 55 km). The cell includes ocean and mountains at this site. | 1991-01-01 to 2024-12-31, 34 complete years, no fill values in the seed | Regional, not a field gauge. Not bias-corrected. |
| SoilGrids 2.0 | https://rest.isric.org/soilgrids/v2.0/properties/query and https://www.isric.org/explore/soilgrids | CC BY 4.0 | SoilGrids 2.0, ISRIC (Poggio et al. 2021, SOIL 7, 217–240) | 250 m, 0–30 cm depth-weighted mean | static model | Not a soil sample. Infiltration class mapping is assumed (`TODO(verify)`). |
| UBC Farm address point | Farm page https://ubcfarm.ubc.ca/ plus BC geocoder URL above | Open Government Licence – British Columbia v2.0, with the catalogue caveat above | Contains information licensed under the Open Government Licence – British Columbia. | address access point, BLOCK, accuracy low | geocoder base data date 2026-07-07 | Not a surveyed field centroid. |
| ECCC VANCOUVER UBC | Normals page above | **TODO(verify)** before any daily copy | Station identity only in `station_gap.json` | point | normals page cites 1971–2000 for the station record shown | Daily series not in the repo. |

## How to run

```sh
SEED_SITES=site_ubc_farm uv run --project services/api python scripts/build_seed.py
cd services/api && OFFLINE=1 uv run pytest tests/test_ubc_farm.py tests/test_features.py tests/test_rotation.py -q
```

`OFFLINE=1` was set inside `test_ubc_farm_features_offline`. The features and rotation modules were also run as a regression because `CURATED_SITES` grew.

## Test results (2026-11-15)

```
services/api tests/test_ubc_farm.py tests/test_features.py tests/test_rotation.py: 61 passed
packages/contracts: 85 passed
```

`test_ubc_farm_features_offline`: `data_mode` is `seed`, `years_available` is 34, years are 1991-01-01 through 2024-12-31, soil texture is loam, sidecars under `data/seed/site_ubc_farm` are complete.

## Acceptance

- `GET /sites/site_ubc_farm/features` with `OFFLINE=1`: pass (`data_mode: seed`).
- Sidecars complete: pass.
- 34 complete years or documented gaps: pass, 34 years, 0 fill values. No missing days in 1991–2024 (12419 days).
- Local station file with a verified redistribution licence: **not stored**. Gap file and this note. Question for the team lead below.

## Question for the team lead

May we copy ECCC daily observations for climate id 1108487 into `data/seed/` under the Historical Climate Data citation, or does attachment1 mean we need another arrangement before those bytes are in the public repo?
