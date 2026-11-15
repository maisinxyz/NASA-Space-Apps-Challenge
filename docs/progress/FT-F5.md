# FT-F5 — Next 12 months and what-if (Person B)

Date: 2026-11-15.

## What was built
- Timeline tabs in Future mode: "10 years" (unchanged timeline and clock, D5) and "Next 12 months" (`components/farm-future/MonthlyOutlook.tsx`). The tab only shows for farms with an engine site.
- Monthly outlook from `GET /sites/{id}/outlook?months=12`: rain bars with the p10–p90 band (widening with the month), the selected month's mean temperature, rain, water balance, frost and heat days with units and ranges. Labelled "Typical year" (climatology) or "Seasonal forecast" from the top-level and per-month `kind`; unknown kinds render as plain words. "mock" badge on the contract fixture.
- Store `horizon` / `monthIndex` (added in F6) drive the tab and the co-pilot snapshot.
- What-if: with an engine forecast, the panel shows each strategy's year-10 soil index (p10–p90), an "Updating the forecast…" state, the applied scenario (preset, rain %, temperature °C, ramp years) and the climate source (from the farm request's `climate_source`). The sliders already refetch the forecast, debounced 350 ms (`useFarmForecast`); with the pre-built file the panel says slider changes are scored against the live API.

## Tests
`components/farm-future/MonthlyOutlook.test.tsx`. Full web suite green, typecheck and eslint clean.

## Gaps
- `/outlook` is not mounted (B7). Mock mode has a fixture for UBC only; KPU shows "No monthly outlook for this farm yet."
- Seasonal forecast (B7 step 2) is not built; the label switches automatically when `kind` changes.
