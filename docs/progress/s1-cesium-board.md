# S1 Cesium rebuild: agent board

Branch: `fe/S1-cesium-globe`. Plan: globe -> pins -> real farm -> digital twin (Cesium ion + Google tiles). Shared contract: `apps/web/components/globe/types.ts`.

| Card | Title | Owner | State | Scope (files) | Merge gate |
| --- | --- | --- | --- | --- | --- |
| C0 | Token file moved to `apps/web/.env.local` (git-ignored) | lead | Merged | env only | variable name confirmed, value never printed |
| C1 | Cesium spike: globe, tiles tiers, clamp, drape, split | agent-render | Review | `package.json`, `scripts/sync-cesium.mjs`, `.gitignore`, `components/viewer/cesium/**`, `components/globe/Globe.tsx`, `app/dev/cesium/**` | typecheck, lint, tests pass; go/no-go note written |
| C2 | Farm list, cards, About, header, homepage shell | agent-shell | Review | `lib/farms.ts`, `components/globe/{FarmCard,FarmList,AboutPanel,GlobeHome}.tsx`, `app/page.tsx`, `components/Header.tsx`, tour entry points | typecheck, lint, tests pass; every farm has a source URL |
| C3 | Farm twin core + four-mode UI | unassigned | Backlog | after C1 gate | |
| C3c | Field drill-down: clicking a field flies the camera down to it in the same viewer and opens a field-detail panel (crop, bare months, runoff share later). No separate window or scene: water crosses field edges, so the simulation must stay whole-square. | unassigned | Backlog | after C3b | |
| C4 | Water, A/B, diff on Cesium | unassigned | Backlog | after C1 gate | |
| C5 | Realism pack | unassigned | Backlog | | |
| C6 | Real-data swap for Agassiz | blocked on Section 2 data | Blocked | | owner of DEM + storm not named |
| C7 | Docs, Methods, PRD update | unassigned | Backlog | | |
| C8 | End-to-end verification | lead | Backlog | | |

## Status 2026-11-13
- C1 and C2 in Review: typecheck and lint pass; tests 108/109. The one failure (`lib/api/client.test.ts` SSE replay) comes from `packages/contracts/fixtures/scans/sse_success.txt` being checked out with CRLF (`core.autocrlf=true`); not caused by C1/C2. Fix belongs to the contract owner (e.g. `.gitattributes` eol=lf for fixtures).
- C1 verdict GO: storm replay on Cesium via GroundPrimitive classification drape (works on globe and Google tiles, split via czm_splitPosition).
- Contract gap for C3/C4: `GlobeProps` has no drape/sim inputs; extend the contract before C3.
- Tier B imagery: account lacks Bing/Sentinel-2; falls back to ion asset 3830182 (Google Maps 2D Satellite); `types.ts` comment still says Sentinel-2.
- Token file fixed (placeholder prefix removed); value never printed.
