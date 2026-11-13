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

- G1 **Hero moment (revised 2026-11-13):** the space-to-farm intro (§3.1), then the storm replay and living calendar on the farm. This must be flawless.
- G2 **Visual polish:** lighting, sky, fog, water shading, typography, motion. Looks like a product, not a hackathon demo.
- G3 **Clarity:** every number has units and a basis chip; plain language; "support, not replace" banner.
- G4 **Performance:** 60 fps single view, 30 fps split view on a laptop; fast first paint; no blank states.
- G5 **Reliable demo:** guided tour, reset key, offline-safe, recorded backup video.
- G6 **Field Shift hook:** a UI control to stress the storm ("what if storms get heavier / seasons shift?") that replays in 3D. Needs Section 2 support (see section 7).

### 3.1 Experience spec (owner interview 2026-11-13; decision IDs from Section 2 PRD §3)

**Aesthetic (D-24):**
- Minimalist and realistic. Not futuristic, cartoony, playful or colorful.
- Photoreal terrain and lighting, desaturated earth tones, one restrained risk accent.
- Thin-line pins (no emoji); heat maps at low opacity in a muted palette.
- Intro reference: dark space, thin white type, lots of negative space, slow camera moves. The owner cited "Helix Sensors" demos, but no matching site was found; ask the owner for the link.
- The existing tokens (paper `#f5f1e8`, ink `#26221c`, teal `#1d6b62`) fit this direction.

**Hero intro (D-25, D-26).** Built on the Cesium globe from branch `fe/S1-cesium-globe`:
1. Earth drifts into frame against stars.
2. Moving the cursor shifts the viewpoint around Earth, as if the user is an astronaut floating in orbit (subtle parallax, slow easing).
3. Earth spins slowly. Farm pins sit on it. Hovering a pin shows its country and farm name.
4. Clicking a pin starts a fast "meteor" fly-in toward the farm, through oceans, cities and trees. Use the photoreal tier where available; fall back to Cesium terrain, then the keyless offline globe.
5. The camera settles on the 3D farm. A large, bold, wide all-caps title appears top right with country, locality and farm name, then slowly fades out. Use a freely licensed (OFL) display font, not the Marvel/Avengers font, and list its license on the Methods page.
6. Free 3D exploration of the farm follows.
7. Before the event, record one video of the full intro as the offline/demo backup.

**Pins on the globe (D-32, D-33):**
- `tier: twin`: AAFC Agassiz Research and Development Centre, Pre-built.
- `tier: explore`: the other research farms, in Lite mode.
- Pin data moves from `lib/farms.ts` to `GET /sites` once contract v1.1 lands.

**Modes (D-27).** The land is always on screen.
- **Explore** (default): land insights and recommendations, ≤ 5 pins on load.
- **Weather**: climate fingerprint, storm replay, hazard calendar and catalog. This was Section 1's "Simulate".
- **Plan**: rotation comparison, scenarios, zone table, scorecard. This merges Section 1's "Compare" and "Evidence".
- **Learn**: tour, "how NASA sees your farm", Season challenge, Methods.

**Side panel rule (D-28):**
- Graphs and tables live only in a collapsible side panel.
- Hovering a week in a chart highlights the land for that week.
- Clicking a table row flies the camera to that zone.
- Charts never cover the land.

**Features:** see Section 2 PRD §4.1 (F1–F44), which gives each feature's priority, mode, UI form and endpoint. The frontend-only features are F33, F35, F38 and F40.

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

### 7.1 Data Section 1 consumes (from `../Databases.md`)

Section 1 never downloads or processes NASA data. It consumes outputs that Section 2 derives from the datasets in `../Databases.md`:

| Section 2 output | Built from (Databases.md) | S1 owner | Used for |
| --- | --- | --- | --- |
| Terrain package: heightmap PNG16, normals, metadata (existing `GET /terrain/{id}`) | DB-1 LidarBC (~1 m, curated Fraser Valley site) or DB-2 NASADEM (~30 m, everything else) | S1-A | 3D land. Must handle both resolutions and show "lower-resolution terrain" when `resolution_m` is coarse; must show `dsm_includes_vegetation` caveat when true |
| Zone outlines + icon points + terrain factor (`zones.geojson`) | DB-1 or DB-2 terrain analysis | S1-A | Soft zone highlights and marker placement on the land |
| Field markers with `active_weeks`, "why?" payload and `SourceRef` list | DB-3 to DB-8 via the algorithm | S1-A (placement), S1-B (tap card) | Markers, 12-month scrubber, "why?" source lines |
| `provenance.json` via `GET /provenance` | DB-13, built from every dataset used | S1-B | Data and Methods page, data credits, "why?" source lines. **No hard-coded dataset names, licenses or URLs in the UI** |
| `mode` (`full` / `lite`), terrain `source`, pre-built flag | DB-1 to DB-3 | S1-B | "Pre-built" badge, "Lite mode: fewer data sources" notice |
| User photo, map pin, crop per field (`POST /lite/markers` input) | DB-12 | S1-B (flow), S1-A (photo as land texture) | Land Scan flow for non-curated sites |

UI rules that come from the data:
- **Every dataset the user can see is credited.** Source name, provider, license and basis chip come from `/provenance`, not from the frontend.
- **Resolution is honest.** NASADEM terrain (30 m) must not look like 1 m LiDAR: the UI shows the source and resolution in the layer panel.
- **No yield, no disaster counts.** Those datasets are deliberately not used (`../Databases.md` §4). The UI must not show yield or disaster numbers even in mock data.
- **Photo is texture only.** Nothing derived from the photo appears as a number (no crop detection).
- **Offline.** All of the above must load from the seed with `OFFLINE=1` and no network.

Resolved 2026-11-13: both are kept. The storm replay (FTW1, A/B) stays and gets real Agassiz storms. Pins, zones and the 12-month calendar arrive through contract v1.1 (`../contract-request-v1.1.md`): new `Insight` kinds, `Zone`, `HazardCalendar`, `HazardCatalog`, `RotationComparison`, new layers and `Site` fields. Terrain stays on the existing `GET /terrain/{id}` package, so no `/sites/{id}/terrain` endpoint is needed.

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
7. ~~Which is the hero?~~ Resolved: the space-to-farm intro, then the storm replay plus the living calendar (§3.1).
8. Terrain grid size for the 1.4 km Agassiz square, and how the terrain package drapes on Cesium. Agree with S2-A (Section 2 open item 12).
9. Thin-line pin icon set for the 4 kinds and the muted zone-highlight style (D-24). Owner: S1-B.
10. The owner's "Helix Sensors" reference link, for the intro look.
11. Unknown enum values (new `Insight.kind`, `LayerName`) must render as a neutral default before contract v1.1 lands.

## 10. Change log

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-12 | Claude | v0.1 draft created |
| 2026-11-13 | Claude + product owner | Added §7.1 "Data Section 1 consumes" from `../Databases.md` (terrain package, zones, markers, provenance, user inputs); UI rules from the data (credit every dataset, honest resolution, no yield or disaster numbers, photo is texture only); open questions 7 to 9 |
| 2026-11-13 | Claude + product owner | Feature interview: §3.1 experience spec (realistic minimalist aesthetic, space-to-farm Cesium intro with recorded backup, OFL title font, globe pins by tier, Agassiz as P0 farm, modes Explore/Weather/Plan/Learn, side-panel rule); G1 revised; §7.1 conflict resolved via contract v1.1; open questions 7 resolved, 8–11 added |
