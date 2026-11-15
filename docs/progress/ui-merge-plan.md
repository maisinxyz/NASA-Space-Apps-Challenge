# Local UI integration plan

User authorized resolving latest friend changes with local UI/UX fixes, local commit only, extensive testing and audit. No push, PR or deploy.

Base: ac8325a. Initial upstream snapshot: 3156a9f.

1. Resolve conflicts by ownership: Terra hero, Terra farm workspace; root GlobeHome, audio types, licenses, test configuration. Preserve new styling/features and previous accessibility, truthfulness, responsive fallback and investigation state.
2. Run typecheck, lint, unit and production build. Fix integration defects, retain regression tests.
3. Serve combined production build on localhost:3003. Test previous regression suite plus new controls (search, picker, share, cards, Twin, report, globe settings/camera). Terra/Luna independent reviews.
4. Write evidence-based prioritized audit with reproduction, recommendations, acceptance tests, coverage and limitations.
5. Fetch GitHub again before local commit, integrate any new commits and retest affected behavior. Verify upstream ancestor and clean index. Future remote changes cannot be guaranteed.

Decisions: keep single allocated ZoneToggle inside FarmView; keep structural audio types rather than reintroduce any; preserve upstream verified license descriptions and SSE fix; combine Playwright configurable port/output with upstream timeout and GPU flags.
