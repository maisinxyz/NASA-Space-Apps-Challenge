# What happens if I plant a different crop this year?

Use `POST /api/v1/sites/{siteId}/forecast` to compare a field's baseline with a one-time crop replacement. The backend advances soil carbon, water storage, and nutrient and pest state through the remaining rotation. Both strategies start from the same conditions and share the same sampled weather. All other planting slots remain the same.

In the existing forecast request, add this property to the field whose first-year spring planting you want to replace.

```json
"first_year_planting": {
  "season": "spring",
  "crop_id": "crop_pea_field"
}
```

For a demo, start with `apps/web/lib/forecast/ubc-request.json` and add the property to the first field, `d3-brassicas`. This swaps its demonstration barley crop for field pea once. Submit that request to the UBC forecast endpoint first with `scenario: "baseline"` and then with `scenario: "drier_summers"` and `climate_source: "cmip6_delta"`. Keep the horizon the same. The two runs draw the same historical years and apply different climate assumptions.

Read these parts of the response:

- Under the chosen field, find `rot_existing` and `rot_first_year_planting`. The latter appears alongside the regular generated and custom rotations.
- Compare the annual soil organic matter and infiltration indices, irrigation need, and soil loss. Each series has a median and p10–p90 values for the sampled weather.
- Read the planting strategy's evidence items for the difference between the two scenario medians in years 1, 3, 5, and the final year. Other fields retain their own baseline in the farm-level comparison.

## Worked UBC example

Using the first demo field and the default 30 weather members, the endpoint returned these scenario medians. The soil index starts at 100 for both plans.

| Weather scenario | Year 1 irrigation need, barley → field pea | Year 5 soil organic matter index, barley → field pea | Year 10 soil organic matter index, barley → field pea |
| --- | ---: | ---: | ---: |
| Historical weather resampling | 33.0 → 63.6 mm | 99.73 → 99.57 | 101.81 → 101.66 |
| Drier summers with NASA climate deltas | 33.9 → 64.9 mm | 99.55 → 99.38 | 101.21 → 101.07 |

In the dry-summer run, the year-10 p10–p90 ranges were 101.05–101.78 for the baseline and 100.89–101.62 for the replacement. These are ranges across the respective modeled weather samples. The small shift is a starting point for discussion with a grower and agronomist.

The season identifies an existing slot. The replacement uses the crop's catalog growing window. A grower should review that window, field history, and any overlaps with the other crops before acting. The demo baseline is illustrative. A grower can supply their own baseline rotation and soil test. The organic matter index starts at 100 using reference carbon pools and expresses modeled relative change. It is independent of the organic carbon percentage in a soil test. The nearby weather-station comparison evaluates the weather inputs. Crop and soil outcome accuracy still needs field validation.
