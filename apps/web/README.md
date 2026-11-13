# FieldTwin web

Section 1: 3D terrain, storm replay, A/B comparison, Rotation Lab, evidence, Methods, and guided tour. All bundled fixtures are mock data. Offline mode also uses mocks, not verified curated seed data.

## Start locally

From `apps/web`:

```sh
corepack pnpm install --frozen-lockfile
# Optional illustrative field polygons; add this to .env.development:
# NEXT_PUBLIC_MOCK_EXTRAS=1
corepack pnpm dev
```

Open http://localhost:3000. The scripts sync fixtures automatically and work without a separate `pnpm` executable on PATH.

## Verify

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm start
# In another terminal, with Google Chrome installed:
corepack pnpm qa:browser
```

Browser QA uses a 1920×1080 headless window and writes screenshots/report to `/tmp/fieldtwin-qa`. It checks A/B replay, evidence, actual context loss/retry and external requests. `QA_BASE_URL`, `QA_OUTPUT`, and `QA_BROWSER` can override defaults. It is not a screen-reader or demo-laptop certification.

`OFFLINE=1 NEXT_PUBLIC_API_MODE=live corepack pnpm build` forces local fixtures even when live mode is requested. Stop the dev server before building: both use `.next`. The production build automatically checks for unverified markers in built code; runtime provenance still requires review.

For real data, use `NEXT_PUBLIC_API_MODE=live` and `NEXT_PUBLIC_API_BASE` from the Section 2 handoff. No real-data integration has been certified. Field polygons/per-field summaries remain contract requests; see `docs/progress/s1-contract-requests.md`. Do not modify the frozen OpenAPI contract without the documented process.

The guided tour is available in the header, with pause/skip/back, Presenter mode, and R to reset. Set `NEXT_PUBLIC_BACKUP_VIDEO_URL` to a real recording URL or public path when available; no recording is bundled yet.

Viewer API: `components/viewer/types.ts`. UI imports metadata from `components/viewer/meta` (no Three.js), and the canvas through `components/viewer`. `/dev/viewer` includes diagnostic timing and renderer counts.
