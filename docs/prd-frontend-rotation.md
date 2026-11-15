# Frontend 1: Farmer inputs and rotation results

Project: Stardew Earth crop-rotation decision support (Next.js, TypeScript, Tailwind, Zustand, Framer Motion, Recharts). Backend spec: `docs/prd-backend-rotation.md` (sections 8.5, 9, 10, 14). Rules: `CLAUDE.md`. Frontend PRD file will be `docs/prd-frontend-rotation.md`.

## You start at
F1-1: farmer priorities form, built against the section 9 request shape and the fixture response in `packages/contracts/fixtures/` (available after Backend A's A2).

## You end at
F1-8: remove `apps/web/lib/twin/rotations.ts` hand-written scores once every screen reads from the API (joint task J2 with the backend pair).

## Your tasks, in order
F1-1 priorities form (select which of the 7 criteria matter, weights or weight presets: water, income, soil structure, erosion, forage) -> F1-2 constraints (low water, no specialty equipment, no local market) and allowed-crops picker -> F1-3 three-rotation comparison view (existing rotation clearly marked, plus 2 alternatives) -> F1-4 seven-criteria scorecards with units and a basis badge on every number -> F1-5 uncertainty display (p10/p90 range bars only where the API sends a range; confidence label; "needs local review" flag; rank stability text) -> F1-6 evidence cards (why suggested, evidence, benefits, information gaps, risks for local review, the support-not-replace sentence) -> F1-7 switch from fixtures to the live API (`NEXT_PUBLIC_API_MODE=live`), handle `limited_data`, `NO_FEASIBLE_ALTERNATIVES` and other error codes -> F1-8 remove `rotations.ts` scores.

## You consume
`POST /sites/{siteId}/rotation-analysis`, `GET /crops`. Scenario sliders belong to Frontend 2; when a slider changes, your results must refresh. Agree on that shared store (Zustand) with Frontend 2 first.

## Rules
- Show only what the API returns. Never invent scores, yield, profit or soil-loss figures.
- Every number: units and a basis label (measured/derived/modeled/assumed/relative). Scores are relative, say so in plain words.
- Curated sites show a "Pre-built" badge; mock data shows a "mock" badge in dev and must never reach the demo.
- Render unknown enum values neutrally instead of throwing.
- Farmer-friendly language, accessible (keyboard, contrast, labels), works at phone width.
- Commit directly to `main`, `git pull --rebase` first, small commits.

## Done when
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass. Changing weights re-ranks without changing any per-criterion score on screen. Write `docs/progress/<task>.md` per finished task.


# Frontend 2: Map, timeline, scenarios and explanations

Project: Stardew Earth crop-rotation decision support (Next.js, TypeScript, Tailwind, MapLibre GL, Zustand, Framer Motion, Recharts). Backend spec: `docs/prd-backend-rotation.md` (sections 7.4, 11, 12, 14). Rules: `CLAUDE.md`. Frontend PRD file will be `docs/prd-frontend-rotation.md`.

## You start at
F2-1: scenario sliders (rain change in %, temperature change in °C, plus the four presets: baseline, wetter_winters, drier_summers, both), built against fixtures. You own the shared scenario state that Frontend 1's results also read.

## You end at
F2-7: live-data pass and honesty labels (limited-data flag, Phase 2 items shown only as Roadmap, never as working).

## Your tasks, in order
F2-1 scenario sliders and presets, labelled "modeled scenario, not a forecast" -> F2-2 hazard timeline (52 weeks) with bands for bare-field periods and vulnerable seasons -> F2-3 feature charts (soil-moisture anomaly, water balance, frost/heat/extreme-rain probability) with units and basis badges -> F2-4 vulnerability zone overlays on the map (erosion risk, water-stress hotspots, frost pockets) labelled "derived from terrain and soil data, not field-measured" -> F2-5 glossary tooltips, crop-type explainers (nitrogen-fixing, cover, deep-rooting, drought-tolerant) and a "satellite vs ground-based" panel -> F2-6 Data and Methods page (every dataset with source, license, attribution; original resolution of each source) -> F2-7 switch to live API, handle `limited_data`, show Phase 2 datasets (GPM, ECOSTRESS, GEDI, GRACE) only as Roadmap.

## You consume
`GET /sites/{siteId}/features`, `hazard-calendar`, `hazards`, `zones`, `GET /glossary`. Zones are a stretch task on the backend, so build the overlay to render nothing gracefully when zones are absent.

## Rules
- Show only what the API returns. No invented numbers; no yield, profit or absolute soil-loss figures.
- Every number: units and a basis label. Satellite and ground data are explained in plain language for farmers with limited technical experience.
- "Pre-built" badge for curated sites; "mock" badge for mock data in dev, never in the demo; "limited data" flag visible for non-curated locations.
- Drone/video capture appear only as Roadmap, never working.
- Show "This tool supports, and does not replace, local agronomic expertise." where results appear.
- Render unknown enum values neutrally; accessible and usable at phone width.
- Commit directly to `main`, `git pull --rebase` first, small commits.

## Done when
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass. Moving a slider updates charts and Frontend 1's results from one shared state. Write `docs/progress/<task>.md` per finished task.
