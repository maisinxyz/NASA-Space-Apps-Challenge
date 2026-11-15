# FT-F4 — One rotation comparison (Person B)

Date: 2026-11-15.

## What was built
- `components/farm-future/RotationComparison.tsx`: strategies A (Current rotation), B, C (and D if requested) from the engine. Crop sequence and cycle, crop-role badges from `rotation_explanation` (when the API sends them), engine rank, review flags counted by severity, "why suggested", evidence items, information gaps, local review risks, Ask co-pilot. Hero numbers at the clock year: soil health index, irrigation need against the quota, frost-free days, heat-stress days, each with unit and p10–p90. Per-field / whole-farm toggle.
- Used in Compare mode (engine forecast present; the synthetic leaderboard stays only as the no-forecast fallback) and in the "Compare rotations" drawer (Now mode), replacing `UBCComparison` there. `UBCComparison.tsx` (other track) is left in place, no longer mounted — R8: confirm with its owner and delete if agreed.
- The forecast now loads in Now mode too, so the drawer has data.
- D3: evidence lines matching income/fertilizer/price are filtered (`HIDDEN_EVIDENCE`); the synthetic soil panel's fertilizer line was removed in F1. A grep of `components/` and `app/` finds no income or fertilizer figure.

## Tests
`components/farm-future/RotationComparison.test.ts`. `pnpm test` 565 passed; typecheck and eslint clean.
