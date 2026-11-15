# FT-W6b — soil carbon, nitrogen, pests, soil loss

## What was built

Annual updates on top of the W6a water year.

- `app/twin/soil.py` — ICBM young/old pools (Andrén & Kätterer 1997 Table 1). `organic_index` is 100 at the steady state of a medium residue input. `update_soc` also sets `infiltration_idx` from that index, cover, and tillage. `soil_loss_t_ha` is an R * K * LS * C * P product. K uses the qualitative range midpoints on the MSU RUSLE page. R, C, and P are assumed and marked TODO(verify) in `config.py`.
- `app/twin/nitrogen.py` — `update_nitrogen` and `nitrogen_flux`. Net is fixation + residue − uptake − loss. Fertilizer need is uptake minus fixation, residue, and a small mineralization credit, floored at 0. A null demand is skipped and named in `notes`. A legume with `n_fixing` true and a null `n_fix_class` uses the assumed medium class and says so.
- `app/twin/pest.py` — pressure rises when a family returns before its interval and falls on a non-host year. Caps at 100. A null interval uses the assumed 3 years.

`config.py` gained the ICBM, nitrogen, pest, and RUSLE coefficients in the W6a commit. This commit does not add new constants.

## How to run

```sh
cd services/api && python -m pytest tests/test_twin_soil.py -q --noconftest
```

## Tests

`tests/test_twin_soil.py`: 5 passed (water tests still 6 passed).

- Bare fallow ends the year with a lower organic index than a full-year cover crop under the same weather.
- An alfalfa year (fixation credit, null class flagged) ends with a higher N index than maize.
- Four maize years raise pest pressure strictly, further years sit on 100, and an alfalfa year lowers the index.
- Steep fallow loses more soil than flat fallow, and a covered slope loses less than bare.
- Ten dry maize years keep organic index positive, infiltration in 0–250, pest in 0–100, and the N index finite.

## Known gaps

- Carbon inputs for "low" and "high", the bare-soil decay bump, and the tillage multiplier are assumed. Only the medium input and kY, kO, h are the 1997 table.
- Nitrogen kilograms and the 3-year return interval are assumed. Confidence on these series is low and `needs_local_review` is true once W6c labels them.
- Soil loss is not a published Vancouver R-factor. The slope-class percentages are a stand-in for a missing slope percent.
- `n_fertilizer_saved_kg_ha` needs the existing rotation's need. W6c/W7 subtract the two series. One plan cannot see the other.

## For W6c

Call `initial_state`, then each year `run_water_year` → `update_soc` → `update_nitrogen` → `update_pest`. Carry `storage_end_mm[-1]` into the next year. Read `organic_index`, `n_balance_index`, `pressure_index`, `nitrogen_flux`, and `soil_loss_t_ha` for the year series.
