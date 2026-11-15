# FT-W5 — Crop catalog v2

Status: **DONE**. Session A. 2026-11-15.

## What was built

`data/seed/crops/catalog_v2.json` has **49** crops (`data_mode: seed`). The twelve commodity ids from `traits.json` are unchanged and their existing numbers were copied, not rewritten. Thirty-seven rows were added for the vegetable, grain, forage, cover, and fruit groups in the forecast brief.

`app/twin/catalog.py` loads the file and checks that every trait has a `trait_sources` entry. `validate_selection` raises `UNKNOWN_CROP` and `SELECTION_TOO_SMALL`. `GET /crop-catalog` is implemented in `app/routers/crop_catalog.py`. It is not mounted in `app/main.py` (W9 owns that file). The route test mounts the router itself.

`packages/contracts/fixtures/crop_catalog.json` is now a copy of the seed catalog. Regenerating forecast fixtures copies the seed file.

Schema relaxations in OpenAPI, so unverified traits can be null instead of a made-up number:

- season-window days may be null
- a cover curve may be empty
- Kc ini, mid, and end may be null
- water need, root-depth class, drought, residue, frost temperature, and heat limit may be null

Existing rows that already had numbers still validate.

## Coefficients that were actually read

The FAO-56 chapter was opened on 2026-11-15: https://www.fao.org/4/x0490e/x0490e0b.htm

The HTML table lost its columns, so Table 12 was not transcribed cell by cell. Three statements in the chapter text were copied:

- Wheat: Kc mid 1.15 (and height 1.0 m, which this catalog does not store). Applied to `crop_wheat_spring` mid only. `crop_wheat_winter` already had mid 1.15; its ini and end were not confirmed by that sentence.
- Maize: Kc mid 1.20. The ported maize row already had mid 1.2. ini and end were not re-read.
- Dry bean example: Kc ini 0.4, mid 1.15, end 0.35, before the local humidity adjustment. Stored on `crop_bean_dry`. This is the example's table citation, not a Vancouver measurement.

Every other Kc is null, with that reason in `trait_sources.kc_stages`.

Planting windows for the new rows are null. No British Columbia or Pacific Northwest guide was opened for day-of-year. `equipment` is empty. `region_fit` is empty, including for UBC Farm. `reference_yield`, Ky, and typical nitrogen rate are null on every crop.

## How to run

```sh
uv run --project services/api python scripts/build_catalog_v2.py
cd packages/contracts && uv run python -m fixtures_lib.forecast_fixtures
cd services/api && uv run pytest tests/test_crop_catalog.py tests/test_routes.py -q
```

## Test results (2026-11-15)

```
packages/contracts: 85 passed
services/api tests/test_crop_catalog.py tests/test_features.py tests/test_ubc_farm.py: 33 passed
services/api tests/test_rotation.py tests/test_routes.py: 80 passed before the pending-path edit
services/api tests/test_crop_catalog.py tests/test_routes.py: 52 passed after that edit
```

`test_routes_match_openapi_exactly` lists the five v1.2 paths as not mounted. That is recorded in `docs/progress/forecast-requests.md` for W9.

## Acceptance

- At least 40 crops: pass (49).
- Trait schema v2: pass, validated as `CropCatalog`.
- Per-trait source or `TODO(verify)`: pass (`catalog_problems` is empty).
- Twelve commodity ids ported: pass.
- Schema validation test: pass.
- `GET /crop-catalog`: pass against a test app. Not live on the process in `app/main.py` until W9.

## Agronomist review checklist

Please review before any demo that treats these rows as local advice:

1. Botanical family on every new row, especially alliums (`Amaryllidaceae`), beet, spinach, and chard (`Amaranthaceae`), phacelia (`Boraginaceae`), and buckwheat (`Polygonaceae`).
2. Which rows are covers versus cash crops. Faba and field pea each exist once. Crimson clover, tillage radish, and cover mustard are covers. Red clover stayed forage.
3. Planting and termination day-of-year for the Fraser Valley. They are null.
4. The dry-bean Kc triple is the FAO example's unadjusted Table 12 citation, not a local coefficient.
5. Wheat and maize Kc mid match the chapter sentences above. Other stages do not.
6. Nitrogen fixation is only a yes/no from the legume family. No class and no kilograms.
7. No equipment list. Specialty-equipment flags on the twelve old rows are still the old placeholders.
8. Empty `region_fit`. Nothing has been judged suitable for UBC Farm's climate.
9. Empty host-family lists. Pest rotation rules cannot use this catalog yet.
10. Reference yield, Ky, root depth in metres, residue, drought, frost, and heat are null on the new rows and unverified on the old ones.

## Question for the team lead

Which extension guide should supply the Fraser Valley planting windows (BC Ministry of Agriculture, WSU, or Oregon State)? The catalog will stay null until that URL is read.
