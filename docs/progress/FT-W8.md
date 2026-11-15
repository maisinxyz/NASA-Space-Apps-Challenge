# FT-W8 — sensitivity, uncertainty, flags, evidence

## What was built

`app/twin/explain/`

- `grid.py` runs the 15-cell grid from PRD group 5: rain −30, −15, 0, +15, +30 percent by temperature 0, +1.5, +3 °C. It reuses `simulate`. `SENSITIVITY_MEMBERS` is 4, a speed choice so the grid stays under 2 s. TODO(verify) that count as a sample size. On this machine a 10-year, 3-strategy grid finished in about 0.4 s.
- `uncertainty.py` reads seed sidecars. NASA POWER is 55000 m (`POWER_SOURCE`). SoilGrids is 250 m when `soil.json` is present. Satellite gap files do not store a retrieved resolution, so those layers are omitted rather than given a made-up metre value. `station_bias` is null when `station_gap.json` says the station series was not included. UBC Farm is that case.
- `flags.py` attaches a layer and a rule to each flag: POWER coarser than a field, a satellite layer that was not retrieved, unrated crops, assumed coefficients, a missing price, and a clubroot repeat only when the catalog text names clubroot. The seed catalog does not, so that rule stays quiet.
- `evidence.py` fills the evidence card from the scorecard and the notes. Templates only. No LLM.

`app/services/sensitivity.py` is the callable the forecast router uses. Glossary terms `soil_organic_index`, `weather_ensemble`, and `sensitivity_grid` were appended to `data/seed/glossary.json`.

## How to run

```sh
cd services/api && python -m pytest tests/test_twin_explain.py -q --noconftest
```

## Tests

`tests/test_twin_explain.py`: 5 passed.

The full API suite, after W9, was 213 passed.

## Acceptance

| Check | Result |
| --- | --- |
| Grid axes and 15 cells | Pass |
| Fewer members than 30, under 2 s | Pass (4 members, about 0.4 s) |
| Uncertainty rows from sidecars | Pass. Missing resolutions are omitted. |
| Station bias null without a station file | Pass |
| Flags name a layer and a rule | Pass |
| Clubroot only when the catalog says so | Pass |
| Evidence card is a template and carries the support sentence | Pass |

## Known gaps

- Rank shares are for the first field. The farm rollup is not re-simulated on every cell.
- A cell uses the rain and temperature axis alone. Seasonal rain on the request is not added on top.
- SMAP "coarser than the field" is not claimed. The gap file says the resolution was not retrieved. The POWER 55 km flag is the sourced resolution comparison.
