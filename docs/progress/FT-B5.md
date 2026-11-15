# FT-B5 — Plausibility review (partial)

Date: 2026-11-15. This work adds review flags; it does not calibrate the model or validate numerical outputs against field observations. Existing coefficients are unchanged. A yield-loader bug was corrected as described below.

- Soil loss: when the modeled annual median exceeds 33 t/ha/year, a flag identifies the first year and requests local soil, slope and erosion checks. The Canadian [RUSLEFAC handbook, Table 1.1](https://sis.agr.gc.ca/cansis/publications/manuals/2002-92/rusle-can.pdf), classifies potential soil loss above 33 t/ha/year as severe. This is a risk category, not a plausible-range maximum and not evidence that this simplified estimate is accurate or impossible.
- Pest saturation: when the assumed median pest index reaches its model ceiling of 100, a flag explains that clipping can obscure rotation differences and that the index is not a measured pest count. The [BC Vegetable Production Guide: Pest Management](https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/agriservicebc/production-guides/vegetables/pest_management_bc_vegetable_production_guide_0.pdf) recommends regular monitoring and identification. It does not validate this index or its ceiling.
- Nitrogen: every strategy is flagged because the relative index depends on assumed nitrogen rates and scale; it is not a soil test. BC's [Vegetable Production Guide: Nutrient Management](https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/agriservicebc/production-guides/vegetables/nutrient_management_bc_vegetable_production_guide.pdf) discusses soil and tissue testing. There is no sourced biological upper bound for this relative index; none was invented.

The engine now reads a sourced `reference_yield` Number object using the same conversion as the water model; previously it incorrectly marked the object null and omitted crop yield series. The test uses a sourced cabbage reference yield and Ky, and verifies an unsourced crop remains omitted. This restores eligible modeled yields; it does not validate them against farm harvests.

Engine version was bumped to invalidate stale forecast caches after adding flags. Targeted tests cover threshold boundaries, saturation wording and nitrogen caveat; the API suite (`uv run --project services/api pytest services/api/tests -q`) passed 272 tests with one dependency deprecation warning.

Still required after B4 is merged: run the current UBC and KPU request bodies with `history_resample` baseline and the supported CMIP6 scenario; record field/strategy/year and p10/p50/p90 soil loss, N index and pest index, confirm the flags match the numbers, and assess against local evidence. Verify erosion factors, slope, nitrogen flux assumptions and pest interval before adjusting coefficients. No post-B4 measured audit results are claimed here.

## Post-integration audit

Re-ran both BC demos with every field set to its Current rotation preset, all ten B4 vegetables plus rye cover, 30 weather members, ten years, offline seeds, and a fresh temporary forecast cache. The figures below are ranges of year-10 medians across fields and strategies.

| Site/scenario | Soil loss t/ha/yr | Nitrogen index | Pest index | Field-strategies |
| --- | ---: | ---: | ---: | ---: |
| UBC baseline | 76.22 | 114.05–293.47 | 100 | 18 |
| UBC drier_summers with CMIP6 | 84.15 | 107.85–287.08 | 100 | 18 |
| KPU baseline | 48.21 | 120.91–345.57 | 100 | 12 |
| KPU drier_summers with CMIP6 | 51.74 | 116.29–340.94 | 100 | 12 |

All 60 field-strategy results carry the severe-erosion and pest-saturation review flags. Nitrogen remains a relative index with an assumption/local-test flag. KPU retains its disclosed nearby-soil proxy. Sourced cabbage and tomato yield series now appear for UBC, and cabbage for KPU, after fixing Number-object interpretation. Unsourced yield/Ky combinations remain omitted.

Calibration remains partial. The simplified erosion model returns severe losses, and the pest model saturates under these scenarios. Vegetable cover curves and other agronomic coefficients still require local validation. No coefficient was changed to force these outputs into a chosen range. The audit is complete and the unresolved model limits are exposed for review.

Merged verification: the yield, explanation, and plausibility regression suites passed 13 tests.

The full integrated API suite passed 308 tests after the B5 fixes.
