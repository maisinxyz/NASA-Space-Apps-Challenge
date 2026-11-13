# Section 1 Prompts: web experience, 3D viewer, UI/UX

Run in order, one per Claude Code session. Prompt 01 (kickoff) must be done by both owners before anything else.

**Status (2026-11-13):**
- The work in S1-02…S1-10 has largely been built on `main` as cards s1-A1…A10 (viewer) and s1-B1…B10 (UI); see `docs/progress/s1-*`. Re-run a prompt only for its gaps.
- The globe and farm twin are being built as cards C1…C8 on branch `fe/S1-cesium-globe`; see `docs/progress/s1-cesium-board.md` there.
- New prompts **S1-11…S1-14** implement the 2026-11-13 feature interview (PRD §3.1) and the Section 1 side of contract v1.1 (`../contract-request-v1.1.md`). They build on the Cesium branch. Merge it to `main` first, or coordinate with its lead.

## Rules for every prompt (Claude reads these once)

1. Read, in this order and nothing else unless the prompt lists it: `CLAUDE.md`, this folder's `PRD.md` section 0 and the sections the prompt names, the last 3 entries of `progress.md`.
2. For root-PRD detail, do NOT open the whole file. Run `grep -n "### FE-04" prd.md` then `sed -n '<start>,<end>p' prd.md` for that card only.
3. Do only this prompt's task. No refactors of unrelated code. Do not edit `packages/contracts/openapi.yaml`; if a change is needed, write a contract request in `progress.md` and stop.
4. Build against mock fixtures (`NEXT_PUBLIC_API_MODE=mock`). Never hard-code data that the API provides.
5. Finish with: run `pnpm lint && pnpm typecheck && pnpm test` (in `apps/web`), list which acceptance items pass, append an entry to `progress.md` (format below), update `PRD.md` if a decision changed (add a change-log row), then stop.

`progress.md` entry format (max 10 lines): `## S1-xx name | date | commit` then Built / Files / How to run / Gaps / Next prompt must know.

Commit directly to `main` with the prompt ID in the message (e.g. `S1-03: …`); `git pull --rebase` before pushing.

---

## S1-01 Kickoff: flesh out this PRD (both owners, interview style)

**Goal:** turn PRD v0.1 into a PRD the team believes in. No code.
**Read:** `PRD.md` fully (including §7.1); `../README.md`; `../Databases.md` §1 and §3 only; `../section-2-nasa-data-algorithm/PRD.md` sections 0, 7 and 9 only.
**Task:** Interview the owners one question at a time (use multiple-choice where possible) covering PRD section 9 open questions (7 is resolved in §3.1; 8 to 11: terrain grid on Cesium, thin-line icon set, the owner's Helix Sensors link, unknown-enum handling) plus: visual mood, hero shot storyboard (second by second), page list, who owns what, and the Omniverse decision (present options A/B/C from section 5, verify claims on the web, recommend). Also confirm with S2-A the grid size of the existing `GET /terrain/{id}` package for the Agassiz square, and record how the UI shows terrain source and resolution (LidarBC vs NASADEM). Then rewrite `PRD.md`: fill owners, resolve questions or mark them owned with a date, add a screen-by-screen sketch list, add measurable acceptance criteria per deliverable, add a 48-hour plan with hour marks per owner. Keep it under 250 lines.
**Done when:** PRD has no blank owners, every open question is resolved or assigned, and a change-log row exists. Append `progress.md`.

## S1-02 Design system and app shell (FE-00)

**Read:** root `prd.md` cards FE-00 and section 7.0 (design direction). Files: `apps/web/app/layout.tsx`, `globals.css`.
**Task:** Design tokens (colors, type, spacing, motion) as CSS variables and Tailwind theme; fonts (display, UI sans, mono for numbers); components: Button, Card, Chip, BasisChip (measured/derived/modeled/assumed/relative), Tabs, Tooltip, Toast, Skeleton, Slider; app shell with nav, mode badge (mock/live/offline), and the "support, not replace" footer. A `/dev/ui` showcase page. Dark dashboard surfaces, warm light content pages, water = cool hue, risk = amber to red plus icon/pattern.
**Done when:** showcase page renders all components in light/dark, keyboard focus visible, reduced-motion respected.

## S1-03 3D viewer core (FE-04, part 1)

**Read:** `packages/contracts/README.md` (encodings); `apps/web/lib/decode/*`; root `prd.md` card FE-04 only; `../Databases.md` DB-1, DB-2 and DB-12 (what the terrain and photo really are).
**Task:** Component `LandViewer` (react-three-fiber). The terrain package comes from LiDAR (~1 m, curated site) or NASADEM (~30 m, other sites): the viewer must render both from the same package shape, show the terrain `source` and `resolution_m` in the layer panel, and show a caveat when `dsm_includes_vegetation` is true. The user's farm photo is a texture only; no number may be derived from it. Load terrain from `terr_mock_hills`; displace a mesh from the 16-bit heightmap in the vertex shader; lit normal map; imagery texture; orbit controls; reset view; scale bar and north indicator. Layer toggles (imagery, slope, drainage, low spots, cover) without reloading assets. Picking returns elevation, slope, cover. WebGL-off fallback: 2D canvas map with the same layers. Include a dev page `/dev/viewer` and tests using the tilted-plane fixture.
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

**Read:** root `prd.md` cards FE-01, FE-03; `../Databases.md` DB-12 (user inputs).
**Task:** Landing hero that plays the hero moment (short loop); site gallery with Pre-built badges; Land Scan wizard (photos, map pin with MapLibre, progress via SSE fixture, terraform reveal into the viewer). Sample-farm shortcut. Clear message when a location is unsupported. For a non-curated location the flow also collects field outlines and a **crop per field** (sent to the Lite-mode endpoint, labeled "assumed"), validates photo type and size on the client, and shows "Lite mode: fewer data sources" on the result.
**Done when:** full journey works in mock mode from landing to simulator in under 90 s.

## S1-09 Insights, camera modes, Methods page (FE-07, FE-08)

**Read:** root `prd.md` cards FE-07, FE-08; `../Databases.md` §1 table and DB-13 (provenance); PRD §7.1.
**Task:** Insight pins anchored to terrain with timed pop-ups tied to timeline events; farmer-tip cards with basis and "verify locally" tags; fly-through and ground-level camera with smooth transitions; Data & Methods page rendered **from `GET /provenance`** (dataset, provider, license, attribution, accessed date, basis chip, what we use it for), plus a "not used and why" block (GRACE, yield, disaster data) copied from `Databases.md` §4. No dataset name, URL or license may be hard-coded in the UI. Add a "Lite mode: fewer data sources" notice and a terrain-resolution notice.
**Done when:** a timed insight fires at the right frame and place; Methods page lists every dataset the API reports, with attribution, and a test fails if a hard-coded dataset name appears in `apps/web`.

## S1-10 Demo mode, QA, performance, backup video (FE-12, FE-13)

**Read:** root `prd.md` cards FE-12, FE-13, section 11 (demo plan, fallbacks).
**Task:** Guided tour (`T`), presentation mode (hide dev badges, larger type, Reset key, network indicator); accessibility sweep; performance sweep at projector resolution; swap mock to live for the curated site if Section 2 is ready (coordinate with integrator); record backup video; checklist from root section 11.3.
**Done when:** tour under 90 s on all curated sites, Reset exact, offline works, fps targets met, backup video saved.

---

## S1-11 Space-to-farm intro and title card (D-25, D-26)

**Read:**
- `PRD.md` §3.1
- `docs/progress/s1-C1.md` and `s1-C2.md` (on `fe/S1-cesium-globe`)
- `apps/web/components/globe/{Globe.tsx,types.ts,GlobeHome.tsx}`
- `apps/web/components/viewer/cesium/{tiles.ts,clamp.ts}`

**Task:**
- **Intro sequence:** Earth drifts into frame against stars. Cursor movement gives astronaut-style orbit parallax with slow easing. Earth auto-spins until the first interaction.
- **Pins:** hover shows "farm, country"; `twin` vs `explore` styling uses thin lines, no emoji.
- **Fly-in:** click starts a fast, eased "meteor" fly-in to the farm. Use the tier A photoreal tiles where available and fall back through B to C. It must never stall on a missing tile tier.
- **Title card:** on arrival, show a top-right title with country, locality and farm name in an OFL bold, wide, all-caps display font, then fade it out over about 3 s. Record the font license for the Methods page.
- **Reduced motion:** replace the fly-in with a crossfade.
- **Backup video:** record one video of the full intro to `docs/demo/` as the offline backup.

**Done when:**
- the intro runs from load to farm with no page errors in tiers A, B and C
- the reduced-motion path works
- the title shows the correct fields for Agassiz
- the backup video is saved

## S1-12 Four modes and the linked side panel (D-27, D-28)

**Read:**
- `PRD.md` §3.1
- `docs/progress/s1-C3-product.md`
- `apps/web/components/farm/{TwinPanel.tsx,ComparePanel.tsx}`
- `apps/web/lib/store.ts`

**Task:**
- **Modes:** rename and regroup the twin modes to **Explore / Weather / Plan / Learn**:
  - Simulate → Weather
  - Compare + Evidence → Plan
  - add Learn (tour entry, Methods link, placeholder for the Season challenge)
- **Explore:** opens by default with at most 5 pins.
- **Collapsible side panel:** hovering a week in any chart sets a store `highlightWeek` that the land reads. Clicking a table row flies the camera to the zone.
- **Restyle:** apply the realistic, muted aesthetic (D-24): thin-line pins, low-opacity overlays, one risk accent.
- **Keyboard:** keep tab semantics and arrow keys.

**Done when:**
- all four modes render with no console errors
- `highlightWeek` and row-click camera fly work in mock mode
- Reset clears the new store keys
- tests updated

## S1-13 Contract v1.1 on the UI: pins, zones, hazards, compare (F1, F12, F13, F18, F24, F25, F29–F31)

**Read:**
- `../contract-request-v1.1.md`
- `PRD.md` §7.1
- Section 2 PRD §4.1 and §9

**Task (after the integrator applies v1.1 and regenerates types and fixtures):**
- **Unknown enums:** render unknown `Insight.kind` and `LayerName` values as a neutral default. Ship this guard first, even before v1.1.
- **Pins:** the four new `Insight` kinds as thin-line pins at `anchor`, with `active_weeks` driving visibility on the 12-month scrubber. The "why?" card shows units, basis, rank stability and sources.
- **Zones:** muted highlight from `GET /sites/{id}/zones`, and the zone table (F30) in Plan.
- **Weather mode:** the hazard calendar ring (F12) linked to the scrubber, and hazard catalog cards (F13) where a tap replays the `worst_storm_id`.
- **Plan mode:** rotation comparison on two axes with ranges (F18, F31); remove the hand-assigned scores.
- **Layers:** `wetness_index` and `planting_suitability` with legends.
- **Globe:** read globe pins from `GET /sites` (`country`, `locality`, `location`, `tier`, `sim_bbox`) instead of `lib/farms.ts`.

**Done when:**
- every new fixture renders
- every number shows units and a basis chip
- scrubbing hides and shows pins by `active_weeks`
- typecheck, lint and test pass

## S1-14 Real Agassiz data swap (Cesium card C6)

**Read:**
- Section 2 progress notes `docs/progress/s2-{A2,B2,B3,B4,B5}.md`
- `PRD.md` §7.1

**Task:** switch Agassiz from mock to live in the order Section 2 delivers it:
1. terrain and layers (S2-A2)
2. real storms and replay (S2-B2)
3. hazards (S2-B3)
4. calendars and compare (S2-A4, S2-B4)
5. pins and zones (S2-A5, S2-B5)

After each switch, check:
- basis chips are present
- the Pre-built badge shows
- `OFFLINE=1` still works
- no "mock" badge reaches the demo path

**Done when:** the full journey (globe → fly-in → Explore → Weather replay → Plan compare) runs on real Agassiz data offline.
