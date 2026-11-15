# FieldTwin local UI integration handoff

Updated November 14, 2026, Vancouver time.

## Scope

Continue locally on `codex/ui-ux-audit-fixes` in this worktree. Keep the original checkout and its port 3000 preview intact. The user authorized local conflict resolution, frontend fixes, localhost testing, and an audit. They asked to keep GitHub pushes subject to permission and confirmed the scope excludes backend development. Existing API, contract, and offline checks are verification only.

## Current checkpoints

- `faad84a` integrated the globe, local share and panel fixes, and earlier upstream changes through `d7dc0e8`.
- `bcde122` resolved the remaining frontend conflicts through upstream `2a98f14` (including `e7cbbd4`). It keeps the local Now workflow and adds the friend's synthetic Future and Compare strategies modes. It also preserves legacy share links, scopes camera shortcuts to the map, resets Future state with the investigation or farm change, and keeps the Future lens picker outside the scroll container.
- `dd398d7` and `4d96054` merged upstream through `3b467d7`. The later updates include planning documents and environment configuration. Latest upstream `95210c6` merged cleanly as `81af953`. Its satellite feature changes came from upstream.
- The audit is at `docs/progress/ui-merge-audit.md`. Confirm `git status --short --branch`, `git log -5 --oneline`, and `git fetch origin` before continuing.

## Preview and validation

Preview uses `http://localhost:3003`. Locate its process with `lsof -nP -iTCP:3003 -sTCP:LISTEN`. Rebuild from `apps/web` with `pnpm build` and restart on port 3003. Keep one software-WebGL browser suite active at a time.

- Current unit results are 508 web tests, 217 API tests, and 85 contract tests passed. ESLint reports 0 errors and 33 warnings.
- The preview was rebuilt successfully after the lens fix and Methods update. The broad browser run was interrupted after 56 passes and 6 failures. The targeted rerun on the rebuilt preview passed six checks. Search-to-farm entry is the one targeted failure still open. The rerun opened search and selected Cornell but timed out waiting for the workspace after Enter. See R14 in the audit. See `/tmp/fieldtwin-resume-e2e.log`, `/tmp/fieldtwin-final-rerun.log`, and `/tmp/fieldtwin-final-search.log`.
- axe scanned the non-3D workspace, Methods and Learn. It reported no violations in those samples and left contrast checks for manual review. See `/tmp/fieldtwin-final-content-axe.json`. The 3D scans and screen-reader walkthroughs remain follow-up work.

## Behavior to preserve

- UBC and other explore-only farms enter without needing a twin; the two twin farms retain scenarios and accessible field reports.
- Hide panels and Show panels preserve inputs and current selections. The simulation drawer, farm controls, camera controls, field report, and Twin preview also have independent visibility controls.
- Now compares relative scenario outputs. Future and Compare display clearly labeled synthetic fixtures. The Future map still lacks field drapes and Compare uses one shared scene. Keep these limits visible until the data and rendering are implemented.
- The existing non-3D simulation workspace, keyboard focus restoration, safe reset confirmation, and local share links remain covered by browser cases.
