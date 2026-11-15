# FT-F1 — Engine-fed Future mode (Person B)

Date: 2026-11-15.

## What was built
- `apps/web/lib/farm-future/data.ts`: `buildFutureData(forecast | null)` → `FutureData` (strategies, merged review flags). Engine forecast when loaded for the farm's site; otherwise the synthetic fixtures (`source: "synthetic"`). Helpers `engineSeries`, `pointAt`, `forecastYear`, `cropName`, `rotationText`.
- `apps/web/lib/farm-future/useFutureData.ts`: hook over `useForecastStore` + current farm.
- Strategy picker (`StrategyBar`) uses engine strategies: existing = "Current rotation", alternatives keep the engine label, crop sequence from the plan.
- Soil panel: `EngineSoilPanel` shows soil organic matter, infiltration, runoff, nitrogen balance, fixed share, water demand, irrigation need vs quota, bare weeks and pest pressure from the engine (farm rollup, or the focused field), with units and p10–p90. Synthetic panel stays as the fallback with its badge; its fertilizer line is removed (D3).
- Review drawer: engine flags per strategy, merged across fields, severity shown, "Go to" week/field.
- `FutureLayer` loads the forecast in Future and Compare.
- Basis chips in Future mode are now an "i" mark with the basis in the tooltip (v4 PRD §2 rule 1).
- ForecastPanel names the existing rotation "Current rotation".

## Tests
- `lib/farm-future/data.test.ts` (7 tests) covers the adapter on the real UBC pre-built forecast and the fallback.
- `pnpm typecheck` clean; `pnpm test` 539 passed; eslint clean on touched folders.

## Gaps
- Lens cards, the timeline ribbon and the condition pills still read synthetic fixtures and keep the "Synthetic demo data" badge (the engine does not give those shapes).
- Compare mode is replaced in F4.
