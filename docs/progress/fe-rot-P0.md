# fe-rot-P0: rotation frontend, Phase 0

## Done
- Saved `docs/prd-backend-rotation.md` (backend rotation PRD v2) and `docs/prd-frontend-rotation.md` (Frontend 1 and Frontend 2 specs) at the paths the PRDs cite. Docs only.
- `apps/web/components/ui/BasisChip.tsx`: an unknown basis value now renders a neutral grey "unknown" chip instead of throwing. This is the unknown-enum rule from contract v1.1.
- `apps/web/components/ui/Provenance.tsx`: unknown non-synthetic values pass through to that neutral chip instead of throwing.
- Updated tests in `BasisChip.test.tsx` and `Provenance.test.tsx`.

## Gate (2026-11-14)
- `packages/contracts/openapi.yaml` is still version 1.0.0.
- `schema.d.ts` has no `RotationAnalysis`, `GlossaryEntry` or `FeatureTable`.
- No rotation, feature or glossary fixtures exist.
- Phase 1 is blocked on Backend A tasks A1/A2 (contract 1.1.0, fixtures, `make types`).

## Checks
- `pnpm vitest run components/ui`: 14 passed.
- `pnpm typecheck`: clean.
- `pnpm lint`: 1 error, in `components/hero/Pin3D.tsx:25` (useId called conditionally). The error is already on main and is not part of this change.

## Next
- Phase 1 starts once the gate passes. Open question: which API `site_id`s map to the twin farms `ny-dairy` and `md-grain`.
