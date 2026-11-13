# Section 1 local completion | 2026-11-12

Vince's restoration approval was confirmed by the user. Pulled main with rebase before work; upstream Section 2 PRD changes were preserved. Restored the exact e83a93c foundation into a separate commit, then added viewer and UI work. Changes are local on main; nothing was pushed or sent to the team.

## Implemented and verified

- Section 1 routes, 3D terrain, fields, overlays, water playback, A/B, difference, evidence, Methods, guided tour and offline fixture mode are present.
- Fixed simulation polling after unmount/reset/input changes, pending-job restoration, failures/retries and stale responses. Added 12 polling regression tests.
- Fixed graphics recovery resource ownership, late loads, partial failure disposal and accessible retry. Added resource and loader regressions.
- Added repeatable 1080p browser checks (`corepack pnpm qa:browser`), with screenshots/report in `/tmp/fieldtwin-qa` by default.
- Made dev/build fixture sync work through corepack without a separate pnpm command. Production builds now automatically run the unverified-marker check.
- Typecheck and lint: pass. Web: 80 tests pass. Contract: 51 tests pass. API: 49 tests pass (one upstream TestClient deprecation warning).
- Final production build with `OFFLINE=1 NEXT_PUBLIC_API_MODE=live`: passes; 269 build files pass the marker check. The frozen contract has no modifications.

## Remaining acceptance limits

All data is still mock fixtures, including offline mode. R1/R2 requests are prepared in `s1-contract-requests.md`, not sent or implemented as contract additions. Real curated-site integration needs Section 2's actual data and licence review. The demo laptop/projector, screen-reader pass, backup recording, coarse-imagery visual appearance and wetter-difference appearance remain unverified. No seed pipeline or predictive claims were added. The prior 79-second tour result is prior-session evidence, not remeasured here.

Current setup and verification commands: `apps/web/README.md`. Historical A/B progress notes remain with dated follow-ups where behavior changed.

Final browser check: simulation/A-B/difference and evidence render; actual context loss/retry recovers, zero page exceptions, zero external requests. Observed split diagnostic: 60 fps, 9 draw calls, high tier at 1920×1080 in local headless Chrome. This does not certify demo hardware.
