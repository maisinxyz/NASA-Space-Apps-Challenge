# FT-EC4 — Yield inputs

Status: **done**. Session C. 2026-11-15. The Earthdata token stayed in `.env` and was not used.

## What was stored

`reference_yield` is total production (metric tonnes) divided by harvested hectares from Statistics Canada, Fruit and Vegetable Production, Table 3-10, British Columbia, 2010:

https://www150.statcan.gc.ca/n1/pub/22-003-x/2010002/t024-eng.htm

Stored only where both cells are published. The quotient is rounded to 2 decimals and the source keeps the unrounded division. Basis `derived`. Confidence `medium`, or `low` when a cell is marked E. This is a provincial commercial average, not a yield from either farm.

| Crop | t/ha | Notes |
| --- | --- | --- |
| Cabbage | 21.34 | 5677 t / 266 ha. Footnote 1 includes Chinese cabbage. |
| Lettuce | 31.69 | 9729 t / 307 ha. Footnote 3 includes leaf and head. |
| Broccoli | 4.50 | Planted area is F. Harvested area and production are numbers. |
| Brussels sprouts | 11.84 | |
| Carrot | 15.29 | Harvested area marked E. |
| Cucumber | 9.27 | |
| Garlic | 1.74 | |
| Pepper | 22.15 | Both cells marked E. |
| Spinach | 10.86 | Both cells marked E. |
| Tomato | 20.05 | |

Cauliflower production is suppressed (`x`). Dry-onion production is suppressed. Beets are `F`. The "Squash and zucchinis" row is not split across the two catalog rows. Pumpkin is not assigned to winter squash. The bean row is not labelled green or dry. Those yields stay null.

Seasonal `yield_response_factor_ky` is FAO Irrigation and Drainage Paper 66, Table 1, captioned as Paper 33 values (https://www.fao.org/4/i2800e/i2800e02.pdf, read 2026-11-15): cabbage 0.95, beans 1.15, onion 1.1, pepper 1.1, potato 1.1, tomato 1.05, spring wheat 1.15. Lettuce, carrot, broccoli, spinach, cucumber, garlic, and Brussels sprouts are not in that table, so Ky stays null.

`typical_n_rate_kg_ha` stays null. The BC cole guide states 75 kg/ha broadcast plus a side-dress of 45 to 110 kg/ha. The BC lettuce guide (updated 22 April 2025) states ranges such as 50 to 80 kg/ha and 100 to 150 kg/ha. A range was not stored as one rate.

Income stays null. No farmer price was added.

## Yield series

`app/twin/water.py` omits `yield_t_ha` when the season window is null, and also when Ky is null. Cabbage has a yield and a Ky, and still no window, so a forecast does not return `yield_t_ha` for it. A test gives cabbage a window only inside the test and then the engine returns 21.34 t/ha. Lettuce has no Ky, so it would still be omitted after a window is added. This is the existing rule, not a bug in Session B's files. They were not edited.

The twelve legacy ids are unchanged.

## How to run

```bash
uv run --project services/api python scripts/build_catalog_v2.py
cd services/api && uv run pytest -q
```

## Results

`services/api`: 258 passed, 1 warning.

## Files

- `scripts/build_catalog_v2.py`
- `data/seed/crops/catalog_v2.json` and `catalog_v2.meta.json`
- `packages/contracts/fixtures/crop_catalog.json`
- `services/api/tests/test_crop_catalog.py`
- `packages/contracts/tests/test_forecast_contract.py` (a sourced yield object is allowed; the old assertion required every yield to be null)
