# FT-B11 — Contract v1.3.0 (Person B)

Date: 2026-11-15. Spec: `docs/fieldtwin-v4-prd.md` Appendix A.

## What was built
- `packages/contracts/openapi.yaml` `info.version` 1.2.0 → 1.3.0. Additive only.
  - `GET /sites/{siteId}/outlook` (`months` 1–12, default 12; `scenario`) → `Outlook` / `OutlookMonth` / `OutlookKind` (`climatology | seasonal_forecast`). Errors 404, 422.
  - `POST /copilot/chat` → `CopilotChatRequest` (message ≤ 1000 chars, history ≤ 6), `CopilotSnapshot`, `CopilotSelected`, `CopilotMessage`, `CopilotChatResponse`. Errors 422, 429, 503. New tag `copilot`.
  - `POST /field/analyze` → `FieldAnalyzeRequest` (one ring), `FieldAnalyzeResponse` (`forecast` reuses `Forecast`). Errors 422, 429, 503.
  - Optional `rotation_explanation` (`RotationExplanation`) on `StrategyCore`, so it is valid on field strategies and farm rollup entries.
  - `RATE_LIMITED` in `ErrorCode`, new `RateLimited` response (429, retryable true).
  - `Forecast.schema_version` const stays `1.2.0`.
- Fixtures (generator `packages/contracts/fixtures_lib/forecast_fixtures.py`): `outlook/site_ubc_farm_outlook.json`, `copilot/chat_reply.json`, `field/analyze_custom.json`; `forecast/site_usda_barc_forecast.json` now carries `rotation_explanation`. `errors/RATE_LIMITED.json` via `scripts/make_fixtures_json.py`. All are `data_mode: mock` shape examples.
- `packages/contracts/schemas/feature_table.schema.json` re-bundled (it embeds every component schema).
- Backend one-liners: `API_VERSION = "1.3.0"`, `RATE_LIMITED` → 429 in `app/core/errors.py`, `test_routes.py` health version and `pending_v12` = the three unmounted paths.
- Web: `pnpm types` regenerated `lib/api/schema.d.ts`; `lib/api/types.ts` aliases; `lib/api/client.ts` `getOutlook`, `postCopilotChat` (never cached), `postFieldAnalyze` (cached by body).

## Results
- `packages/contracts`: 94 passed.
- `services/api`: 259 passed, 4 failed. The 4 fail on a clean tree too (cmip6_delta seed sidecar / feature-list checks in `test_features.py`, `test_kpu_langley.py`, `test_satellite_gap.py`, `test_ubc_farm.py`); they belong to Person A's B1 seed work.
- Redocly 1.34.3 lint: valid, 6 warnings (all pre-existing kinds).
- Web: `pnpm typecheck` clean, `pnpm test` 532 passed.

## Notes for Person A
- Remove each path from `pending_v12` in `services/api/tests/test_routes.py` when you mount it.
- Regenerating `make_fixtures_json.py` on Windows rewrites `evidence.json` with a broken `m³` (codepage). Only `errors/RATE_LIMITED.json` was committed from that run.
- Outlook mock fixture exists only for `site_ubc_farm`; KPU 404s in mock mode until a fixture or the live endpoint exists.

## Backend verification — 2026-11-15

Compared `openapi.yaml` with Part A Appendix A: the outlook and its per-month/top-level kinds, co-pilot request and response, custom-field request and response, optional field and farm strategy rotation explanations, and `RATE_LIMITED` error are present with the specified shapes and error responses. Polygon closure and area require runtime validation as described in the contract. No contract change was needed. The three new routes remain implementation work for B7, B9 and B10.

Verification: `uv run --project packages/contracts pytest packages/contracts -q` — **94 passed**. This verifies fixtures and contract tests; it does not verify the unimplemented live routes.
