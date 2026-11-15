# FT-EC3 — Crop catalog gaps

Status: **done**, with planting days still null. Session C. 2026-11-15.

`EARTHDATA_TOKEN` is now in the repo-root `.env` (gitignored). It was not printed, logged, or committed. This workstream does not call Earthdata.

## What was filled

`scripts/build_catalog_v2.py` now copies FAO-56 Table 12 from a PDF whose columns survived:

https://www.cse.iitb.ac.in/~pocra/References/FAO_Paper56_Irrigation_Drainage.pdf

Read 2026-11-15. The HTML chapter still loses the columns and was not used for these cells.

A blank Kc ini uses the group-row value, and the source sentence says so. A printed range is not stored as one number (tomato Kc end 0.70–0.90, spring-wheat Kc end 0.25–0.40). Cucumber was left null because the fresh-market and machine-harvest rows were merged in the text. The twelve legacy ids are unchanged, including `crop_rye_cover`.

Table 22 root-depth ranges are cited (cabbage 0.5–0.8 m, lettuce 0.3–0.5 m) and the ini/mid/end numbers stay null, because the table does not split stages.

`region_fit` is `["oceanic"]` for crops named on the BC vegetable production guide index. Vancouver is temperate oceanic, Köppen Cfb (https://en.wikipedia.org/wiki/Climate_of_Vancouver). `SITE_CLIMATE_CLASS` stores that for `site_ubc_farm` only. Langley Township's Wikipedia intro does not state a Köppen class, so KPU has no class. A site with no class is not filtered, so the filled crops still appear for KPU.

`needs_equipment` stays empty. WSU EM051E names a trellis as optional, not as a required id.

Frost and heat numbers stay null. The cole guide's −14°C / −19°C sentences are a survival note in the overwinter-cauliflower section. The lettuce guide's 21°C sentence is about germination. Neither was stored as a limit.

## Windows

`plant_doy` and `terminate_doy` stay null for the new rows, including cabbage and lettuce. The pages that were opened state a month, a deadline, or a days-to-harvest range:

- BC cole crops: https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides/cole-crops
- BC lettuce: https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides/lettuce
- WSU Snohomish fall vegetables: https://extension.wsu.edu/snohomish/2013/12/18/fall-and-winter-vegetable-gardens-for-western-washington/

Those were not converted into a day-of-year. The WSU western Washington calendar PDF is a grid; text extraction did not keep the month marks, so the marks were not guessed. **TODO(verify)** a plant day and a termination day for each crop.

`app/twin/water.py` does not place a crop with a null window, so `yield_t_ha` cannot appear for cabbage or lettuce until a window exists. That is recorded for EC4. It is not a bug in Session B's water code.

## Files

- `scripts/build_catalog_v2.py`
- `data/seed/crops/catalog_v2.json` and `catalog_v2.meta.json`
- `packages/contracts/fixtures/crop_catalog.json` (copy of the seed, as the forecast note already describes)
- `services/api/app/twin/catalog.py` (UBC climate class, and no filter when a site has no class)
- `services/api/tests/test_crop_catalog.py`

## How to run

```bash
uv run --project services/api python scripts/build_catalog_v2.py
cd services/api && uv run pytest -q
```

## Results

`services/api`: 251 passed, 1 warning. The catalog contract check that yields, Ky, and nitrogen are still null also passed.

## Notes for other sessions

Session B: do not invent a planting day to make vegetable yield appear. The omission is the null window.
