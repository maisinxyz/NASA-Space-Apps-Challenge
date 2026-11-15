# FT-W7 — strategy generator, farm fit, scorecard, income

## What was built

`app/twin/generate.py`

- `build_strategies` / `generate_strategies` search the farmer's crop pool. Index 0 is the existing rotation (the field's slots, otherwise the site preset).
- Alternatives are a capped DFS in crop-id order: family spacing, season overlap, equipment, labour-peak cap, perennial run length, cycle length. Pinned crops must appear. Excluded crops never enter the search.
- Crops with a null season window are left out and named in an info `NO_FEASIBLE_ALTERNATIVES` warning. No planting date is invented.
- The alternative set is ranked with equal weights. `req.priorities` is not read here.
- Too few alternatives adds an error `NO_FEASIBLE_ALTERNATIVES` warning and returns what was found.
- `custom_strategies` are expanded as entered and do not consume `strategy_count`.
- `farm_fit` is re-exported so the PRD §6.4 import path works. The function lives in `score.py`.

`app/twin/score.py`

- `farm_fit`: quota status `within | tight | exceeds | no_quota_given`; forage index from non-fallow slots whose category is forage or whose `forage_use` is grazing, hay, or silage; operational fit from equipment match and the labour cap; market fit is the mean of entered 1–5 ratings, or null when none are rated.
- `income_estimate`: null when no per-tonne price can be multiplied. Field total is currency/yr (per-ha net × `area_ha`). Missing costs are not treated as zero. `labour_per_hour` is not subtracted, because hours are not simulated. p10 uses low yield and high costs.
- `fertilizer_saved`: existing need minus this need, kg N/ha/yr. A plan compared with itself is 0 at p50.
- `scorecards`: min-max across the strategies passed in, 50 when they tie, lower-is-better flipped for `erosion_risk` and `water_use`. Each row has `year10_value` and `mean_value`. Water and erosion also get an ensemble `range` when `member_year10` is present.
- `rank_by_priority` applies `weights` or `weight_preset`. All-zero weights become equal. It does not rewrite the scorecard.
- `estimates`, `deltas_vs_existing`, `review_flags`, `unrated_crops`, `rank_stability_note`.

## How to run

```sh
cd services/api && python -m pytest tests/test_twin_generate.py -q --noconftest
```

## Tests

`tests/test_twin_generate.py` plus the earlier twin tests: 20 passed in 0.36 s.

- Pinned soybean is in every alternative. Excluded barley is not. Consecutive mains differ in family, including the cycle wrap.
- Two requests that differ only in `weight_preset` return the same slots. A second call matches.
- Grain, forage (with equipment listed, so alfalfa stays), and mixed pools each return the existing plan plus at least one alternative.
- Vegetable-only (cabbage, tomato, lettuce, green bean) returns the existing plan and `NO_FEASIBLE_ALTERNATIVES`. Those catalog rows have null season windows.
- A custom barley year is expanded across the horizon even when barley is excluded from the search.
- Quota status covers within, tight, exceeds, and no_quota_given. Income is null with no prices and with a non-tonne unit, and a Number with p10 ≤ p50 ≤ p90 when the unit is `per tonne`.
- Equal raw metrics score 50. A water preset and an erosion preset swap `rank_by_priority` on the same cards.
- `rank_stability_note()` does not invent a percent. The climate-grid share belongs to W8.

## Acceptance (PRD W7)

| Check | Result |
| --- | --- |
| Pinned and excluded honored | Pass |
| Same-family spacing | Pass |
| Grain, forage, and mixed pools return plans | Pass |
| Vegetable-only returns a valid plan plus the warning | Pass. Alternatives wait on season windows. |
| Equal-weight selection, then weighted rank | Pass |
| Determinism | Pass |
| `NO_FEASIBLE_ALTERNATIVES` when the pool cannot fill `strategy_count` | Pass |
| Water vs quota, equipment and labour, forage, market, income | Pass on the cases above |
| Scorecard min-max, 50 on a tie, year-10 and mean | Pass |

## Known gaps

- `generate_strategies` reads `fields[0]` only. W9 calls it once per field and does the area-weighted rollup. A field `selection_override` is not applied inside this function.
- Most new vegetable rows still have null `season_window` and null `kc_stages`, so a vegetable-only pool cannot form a timed alternative.
- Forage suitability is the share of non-fallow slots, not a second normalization against the existing plan. The tonnage stays on `forage_yield_t_ha`.
- `forage_suitable` alone does not count (maize has it and is not forage).
- Search does not drop a crop for climate fit. `weather` and `soil` are accepted and unused.
- Income is a partial net whenever a cost field was left empty.

## For Session C

W7 DONE: Session C can start W9.

```python
from app.twin.generate import build_strategies, generate_strategies
from app.twin.score import (
    deltas_vs_existing, estimates, farm_fit, fertilizer_saved, income_estimate,
    rank_by_priority, rank_stability_note, review_flags, scorecards, unrated_crops,
)
```

`lat` is keyword-only. Pass `site_id` when the field has no entered rotation. Subtract fertilizer with `fertilizer_saved(this_need, existing_need)` after both simulations. Use `rank_stability_note()` until W8 replaces it with the grid result. Do not start W8 or W9 from this session.
