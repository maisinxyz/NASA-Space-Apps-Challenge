# FT-W6c — simulation loop

## What was built

`app/twin/run.py`

- `expand_plan` repeats a cycle out to the horizon. Year indexes on the slots become 1..horizon.
- `simulate` runs every weather member from `initial_state`, carries soil-water storage across years, and applies `update_soc`, `update_nitrogen`, and `update_pest`.
- Returns a `Simulation` dict of `YearSeries` (p10/p50/p90) for the group-3 trajectories plus `soil_loss_t_ha_yr`, `n_fertilizer_need_kg_ha`, and `forage_yield_t_ha`.
- Per-crop yield series live on `simulation.yield_by_crop` and are omitted when `reference_yield` or Ky is missing. The reason is in `review_notes`.
- `member_year10` keeps the year-10 irrigation and soil-loss vectors so W7 can put an ensemble range on those scores.
- `series_to_dict` matches the `YearSeries` schema.

Year 0 of an index is 100 (nitrogen kg and pest are 0). Year 0 of a flux series repeats the year-1 ensemble, because the members passed in are already ramped and there is no separate unramped table on this call.

`n_fertilizer_saved_kg_ha` is not computed here. One plan cannot see the existing rotation. W7 subtracts the two need series.

## How to run

```sh
cd services/api && python -m pytest tests/test_twin_run.py -q --noconftest
```

## Tests

`tests/test_twin_run.py`: 3 passed in 0.32 s (includes the timing case).

- A 2-year cycle expands to maize, soybean, maize, soybean.
- Two calls match. p10 ≤ p50 ≤ p90. Year-0 organic index is 100. Maize yield is present with unit t/ha. Soil-loss dict has p10/p50/p90.
- 30 members × 10 years × 1 strategy finished in under 0.5 s. Three strategies stay inside the 1.5 s cold `/forecast` budget on this machine. The sensitivity grid (W8) should still use fewer members, as the PRD says.

## Known gaps

- Year-0 flux points are the year-1 ensemble, not a separate unramped climate.
- Forage yield is 0 t/ha, with a review note, when no planted crop has a reference yield and a forage flag. It is not a measured zero.
- Review notes are strings. W8/W9 turn them into `ReviewFlag` objects.

## For Session C

W6c DONE: Session C can start W8. `simulate(plan, members, soil, field, catalog, lat=...)` is the function to call. Do not import a private water loop.
