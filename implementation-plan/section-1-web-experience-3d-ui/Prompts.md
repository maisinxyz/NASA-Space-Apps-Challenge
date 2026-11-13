# Section 1 Prompts: web experience, 3D viewer, UI/UX

Run in order, one per Claude Code session. Prompt 01 (kickoff) must be done by both owners before anything else.

## Rules for every prompt (Claude reads these once)

1. Read, in this order and nothing else unless the prompt lists it: `CLAUDE.md`, this folder's `PRD.md` section 0 and the sections the prompt names, the last 3 entries of `progress.md`.
2. For root-PRD detail, do NOT open the whole file. Run `grep -n "### FE-04" prd.md` then `sed -n '<start>,<end>p' prd.md` for that card only.
3. Do only this prompt's task. No refactors of unrelated code. Do not edit `packages/contracts/openapi.yaml`; if a change is needed, write a contract request in `progress.md` and stop.
4. Build against mock fixtures (`NEXT_PUBLIC_API_MODE=mock`). Never hard-code data that the API provides.
5. Finish with: run `pnpm lint && pnpm typecheck && pnpm test` (in `apps/web`), list which acceptance items pass, append an entry to `progress.md` (format below), update `PRD.md` if a decision changed (add a change-log row), then stop.

`progress.md` entry format (max 10 lines): `## S1-xx name | date | branch` then Built / Files / How to run / Gaps / Next prompt must know.

Branch for each prompt: `fe/S1-xx-slug`.

---

## S1-01 Kickoff: flesh out this PRD (both owners, interview style)

**Goal:** turn PRD v0.1 into a PRD the team believes in. No code.
**Read:** `PRD.md` fully; `../README.md`; `../section-2-nasa-data-algorithm/PRD.md` section 0 and 7 only.
**Task:** Interview the owners one question at a time (use multiple-choice where possible) covering PRD section 9 open questions plus: visual mood, hero shot storyboard (second by second), page list, who owns what, and the Omniverse decision (present options A/B/C from section 5, verify claims on the web, recommend). Then rewrite `PRD.md`: fill owners, resolve questions or mark them owned with a date, add a screen-by-screen sketch list, add measurable acceptance criteria per deliverable, add a 48-hour plan with hour marks per owner. Keep it under 250 lines.
**Done when:** PRD has no blank owners, every open question is resolved or assigned, and a change-log row exists. Append `progress.md`.

## S1-02 Design system and app shell (FE-00)

**Read:** root `prd.md` cards FE-00 and section 7.0 (design direction). Files: `apps/web/app/layout.tsx`, `globals.css`.
**Task:** Design tokens (colors, type, spacing, motion) as CSS variables and Tailwind theme; fonts (display, UI sans, mono for numbers); components: Button, Card, Chip, BasisChip (measured/derived/modeled/assumed/relative), Tabs, Tooltip, Toast, Skeleton, Slider; app shell with nav, mode badge (mock/live/offline), and the "support, not replace" footer. A `/dev/ui` showcase page. Dark dashboard surfaces, warm light content pages, water = cool hue, risk = amber to red plus icon/pattern.
**Done when:** showcase page renders all components in light/dark, keyboard focus visible, reduced-motion respected.

## S1-03 3D viewer core (FE-04, part 1)

**Read:** `packages/contracts/README.md` (encodings); `apps/web/lib/decode/*`; root `prd.md` card FE-04 only.
**Task:** Component `LandViewer` (react-three-fiber). Load terrain from `terr_mock_hills`; displace a mesh from the 16-bit heightmap in the vertex shader; lit normal map; imagery texture; orbit controls; reset view; scale bar and north indicator. Layer toggles (imagery, slope, drainage, low spots, cover) without reloading assets. Picking returns elevation, slope, cover. WebGL-off fallback: 2D canvas map with the same layers. Include a dev page `/dev/viewer` and tests using the tilted-plane fixture.
**Done when:** tilted plane shows correct relative slope; picking values match fixtures; fallback works.

## S1-04 Water overlay, A/B split, difference

**Read:** S1-03 progress entry; `lib/decode/ftw1.ts`; contract README section on FTW1; root `prd.md` card FE-05 (A/B parts only).
**Task:** Upload decoded FTW1 frames as GPU textures; render translucent water by depth; interpolate between frames for smooth scrubbing; `frameIndex` prop. Implement split mode with **one canvas and two viewports** (scissor) so camera and time stay locked; rotation selector per side; difference overlay from `/simulations/{id}/diff` with a legend. Risk overlay from risk PNG (255 = masked).
**Done when:** A/B in sync, scrub smooth, difference legend correct, 30 fps in split on the dev laptop.

## S1-05 Visual polish pass (the "wow" layer)

**Read:** S1-03/04 progress entries; PRD section 3 (G2) and the hero-shot storyboard written in S1-01.
**Task:** Sky, soft shadows, distance fog, tone mapping; water shader (depth absorption, fresnel, subtle normal ripples, shoreline softness, flow-line effect along drainage); terraform animation (flat plane rises while data loads); smooth camera easing; optional time-of-day. Add a perf governor that reduces quality when frame time is high.
**Done when:** screenshots before/after saved in `docs/`, fps targets still met, animation hides load states.

## S1-06 Simulator dashboard (FE-05)

**Read:** root `prd.md` card FE-05; `lib/api/client.ts` signatures only.
**Task:** Route `/sim/[siteId]`: left rail (site, badges, storm picker cards, rotation chips, layer toggles, exaggeration slider, Run), center viewer, right panel tabs (Insights, Metrics, Layers), bottom timeline (hyetograph, scrubber, play/pause, 0.5x to 4x, event markers). HUD with live metrics, units and "modeled" chip. Shortcuts: Space, arrows, A/B swap, D for difference. States: loading, per-rotation progress, error with retry, offline.
**Done when:** user picks storm, runs 3 rotations, plays A/B; HUD changes per frame.

## S1-07 Rotation Lab, evidence cards, Field Shift control (FE-06)

**Read:** root `prd.md` cards FE-06 and the EvidenceCard schema section; PRD section 7 here.
**Task:** Route `/sim/[siteId]/rotations`: three columns (existing first), cover-calendar strip, key metrics, five-section evidence card, comparison table, persistent banner. Add a **Field Shift control** (storm intensity and season-shift sliders) wired to a mock `scenario` object behind a feature flag; show uncertainty ranges as bars when mock data provides them. Every card number must equal a table metric.
**Done when:** acceptance for FE-06 passes; flag off by default until Section 2 ships real fields.

## S1-08 Landing and Land Scan flow (FE-01, FE-03, FE-02 light)

**Read:** root `prd.md` cards FE-01, FE-03.
**Task:** Landing hero that plays the hero moment (short loop); site gallery with Pre-built badges; Land Scan wizard (photos, map pin with MapLibre, progress via SSE fixture, terraform reveal into the viewer). Sample-farm shortcut. Clear message when a location is unsupported.
**Done when:** full journey works in mock mode from landing to simulator in under 90 s.

## S1-09 Insights, camera modes, Methods page (FE-07, FE-08)

**Read:** root `prd.md` cards FE-07, FE-08.
**Task:** Insight pins anchored to terrain with timed pop-ups tied to timeline events; farmer-tip cards with basis and "verify locally" tags; fly-through and ground-level camera with smooth transitions; Data & Methods page (datasets, licenses, measured/modeled/assumed table, limits).
**Done when:** a timed insight fires at the right frame and place; Methods page lists every dataset with attribution.

## S1-10 Demo mode, QA, performance, backup video (FE-12, FE-13)

**Read:** root `prd.md` cards FE-12, FE-13, section 11 (demo plan, fallbacks).
**Task:** Guided tour (`T`), presentation mode (hide dev badges, larger type, Reset key, network indicator); accessibility sweep; performance sweep at projector resolution; swap mock to live for the curated site if Section 2 is ready (coordinate with integrator); record backup video; checklist from root section 11.3.
**Done when:** tour under 90 s on all curated sites, Reset exact, offline works, fps targets met, backup video saved.
