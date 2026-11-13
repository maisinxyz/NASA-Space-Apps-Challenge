# Section 1 PRD: Web experience, 3D viewer, UI/UX (v0.1 DRAFT)

> Living document. v0.1 is a generic outline. The two owners must flesh it out in Prompt 01, then update it after every decision. Log changes at the bottom.

## 0. Context capsule (Claude: read this first, it replaces reading the root PRD)

- **Product:** FieldTwin. A farm photo + location becomes a 3D landscape; real NASA POWER storms replay on it; 3 crop rotations compare side by side; evidence cards explain why. Challenge: "Field Shift: Adapting Farms with NASA Data" (NASA Space Apps 2026, Vancouver). Event: starts Sat Nov 14 9:00, submit by Sun Nov 15 11:59 PM (aim 2 h early).
- **Stack (already scaffolded in `apps/web`):** Next.js 15 App Router, React 19, TypeScript strict, Tailwind 4, react-three-fiber 9 + drei 10, maplibre-gl, framer-motion, zustand, recharts, pnpm. Vitest for tests.
- **Data in:** the API contract `packages/contracts/openapi.yaml` (v1.0.0, frozen). Mock fixtures in `packages/contracts/fixtures/` are synced to `apps/web/public/mock`. Client: `apps/web/lib/api/client.ts` (mock/live via `NEXT_PUBLIC_API_MODE`). Decoders: `apps/web/lib/decode/` (16-bit heightmap, FTW1 water frames). Heightmap: row-major, row 0 = north.
- **Status:** shell and API client exist; no real pages or viewer yet. Mock terrains: `terr_mock_hills|tilted|bowl` (256x256, 2 m cells). Mock simulation: `sim_mock_001` (3 rotations x 60 frames).
- **Rules:** see `CLAUDE.md` (honesty labels, no invented endpoints, "support, not replace" text). Existing task IDs in root `prd.md` are FE-00..FE-13; this section covers FE-00..FE-08, FE-12, FE-13 plus BE-10 consumption.

## 1. Mission

Make FieldTwin the most beautiful, instantly understandable entry in the track. A judge should grasp it in 15 seconds and remember the split-screen storm. Winning-project lessons we apply: one clear decision, real-world story, polish and storytelling (Zumorroda-X), a "digital twin" feel (Crop Connect), visible honesty about data (Validity criterion), and a clear presentation (Presentation criterion).

## 2. Owners (proposal, edit freely)

| Role | Person | Focus |
| --- | --- | --- |
| S1-A: Rendering | ___ | 3D viewer, shaders, water, camera, performance |
| S1-B: Product UI/UX | ___ | Design system, pages, simulator dashboard, Rotation Lab, demo mode |

## 3. Goals

- G1 **Hero moment:** terraform rise, then A/B storm replay with difference glow. This must be flawless.
- G2 **Visual polish:** lighting, sky, fog, water shading, typography, motion. Looks like a product, not a hackathon demo.
- G3 **Clarity:** every number has units and a basis chip; plain language; "support, not replace" banner.
- G4 **Performance:** 60 fps single view, 30 fps split view on a laptop; fast first paint; no blank states.
- G5 **Reliable demo:** guided tour, reset key, offline-safe, recorded backup video.
- G6 **Field Shift hook:** a UI control to stress the storm ("what if storms get heavier / seasons shift?") that replays in 3D. Needs Section 2 support (see section 7).

## 4. Scope

In (P0): design system and shell; landing; Land Scan flow with terraform animation; 3D viewer with layers and picking; water overlay with scrubbing; A/B split and difference; simulator dashboard (storm picker, rotation chips, HUD, timeline); Rotation Lab with five-part evidence cards; insight pop-ups; Data & Methods page; guided demo mode; accessibility and performance pass.

P1: ground-level camera, fly-through, instanced crop rows, time-of-day, Field Shift slider, Learn page.

Out: auth, accounts, mobile apps, LLM chatbot, anything that fakes drone/video capture (Roadmap only).

Cut order if behind: see root `prd.md` section 10.3. Never cut: terraform, storm replay, A/B, evidence cards, Methods page, demo mode.

## 5. 3D technology decision (D1, decide in Prompt 01)

You mentioned NVIDIA Omniverse. Facts to weigh (verify before deciding, `TODO(verify)`): Omniverse is built around OpenUSD and runs as a desktop or server application; getting it into a browser generally means streaming from an RTX GPU machine. That conflicts with our need to run offline on a laptop and on a projector with flaky Wi-Fi.

Recommended default: **web-native rendering with react-three-fiber/three.js** for the live app. Use Omniverse (if the team wants it) for an **optional cinematic layer**: pre-rendered hero shots or a USD/glTF export of the curated sites, embedded as video or assets. Record the final decision and reason here.

| Option | Pros | Cons |
| --- | --- | --- |
| A. three.js only (default) | Offline, fast, matches stack and contract | Less photoreal |
| B. three.js + Omniverse pre-renders | Photoreal intro/trailer, still offline | Extra pipeline and time |
| C. Omniverse streaming | Highest fidelity | Needs GPU server and network; demo risk |

## 6. Deliverables (map to root PRD cards)

| Area | Root card | Priority |
| --- | --- | --- |
| Design system, app shell | FE-00 | P0 |
| Landing page | FE-01 | P0 (light) |
| Explore sites | FE-02 | P1 |
| Land Scan + terraform animation | FE-03 | P0 |
| 3D viewer (terrain, layers, picking, water, split) | FE-04 | P0 |
| Simulator dashboard | FE-05 | P0 |
| Rotation Lab + evidence cards | FE-06 | P0 |
| Insights and tips | FE-07 | P0 |
| Data & Methods page | FE-08 | P0 |
| Guided demo + presentation mode | FE-12 | P0 |
| QA, accessibility, performance | FE-13 | P0 |

## 7. Interfaces with Section 2

- Consume only what the contract defines. Never invent fields. Need something new? Draft a "contract request" in `progress.md`, then use the contract change process.
- Expected additions (not yet in contract): `scenario` on a simulation request (storm intensity scale, season shift), per-rotation resilience profile and uncertainty range, zone actions. Build the UI against mock versions behind a flag until Section 2 ships real data.
- Binary formats: heightmap PNG16, normal PNG, FTW1 frames, risk PNG (255 = masked). See `packages/contracts/README.md`.

## 8. Quality bar (acceptance)

- [ ] Tilted-plane fixture renders with correct relative elevation; picking readouts correct.
- [ ] Water frames scrub smoothly; A/B stays in sync (camera and time).
- [ ] Layers toggle with no reload; WebGL-off fallback works.
- [ ] Every metric shows units + basis chip; banner always visible.
- [ ] Guided tour completes in under 90 s; Reset restores start state; works with `OFFLINE=1`.
- [ ] Meets fps targets on the demo laptop at projector resolution.
- [ ] Reduced-motion respected; color is never the only signal.

## 9. Open questions (fill in during Prompt 01)

1. Omniverse decision (D1).
2. Which 3 curated sites and who verifies image licenses?
3. Visual identity: name styling, palette, display font.
4. Do we show a narrator or story character (Zumorroda-X style) or stay purely scientific?
5. Demo video: 30 s video or 7-slide deck (confirm 2026 format on Nov 13).
6. Target demo machine and resolution.

## 10. Change log

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-12 | Claude | v0.1 draft created |
