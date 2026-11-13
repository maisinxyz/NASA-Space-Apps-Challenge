# Section 1 PRD: 3D digital twin and web experience (v0.2)


Status: DRAFT for the two Section 1 owners. Supersedes the v0.1 outline. Section 2 (data, simulation, crop engine) is out of scope here and only appears as interfaces.
Rules that always apply: `CLAUDE.md` (honesty labels, no invented endpoints, "support, not replace", determinism, offline).


## 0. Context capsule


- **Product:** FieldTwin. A real or scanned landscape becomes a 3D digital twin. Real NASA POWER storms replay on it. Three crop rotations are compared side by side. Evidence cards explain why. Challenge: "Field Shift: Adapting Farms with NASA Data" (NASA Space Apps 2026).
- **Event:** starts Sat Nov 14 09:00, submit by Sun Nov 15 23:59 (aim 2 h early). Written Thu Nov 12.
- **Team for this section:** 2 owners, about 36 working hours each, both P0 paths must fit.
- **Corrected repo state (checked Nov 12):** `apps/web` is empty (only `.gitkeep`): no Next.js app, no client, no decoders. `packages/contracts/fixtures/` does not exist yet. `openapi.yaml` v1.0.0 exists and is frozen. The v0.1 draft claimed these were scaffolded; they are not, so scaffolding is the first task. **(Superseded 2026-11-12, see change log: the scaffold, client, two decoders and fixtures from commit `e83a93c` were restored and are the base.)**
- **Contract coverage:** terrain package (heightmap PNG16, normal, texture, layers), sites, storms, crops, rotations, simulations (FTW1 water frames, risk PNG, evidence, diff). It does **not** define field polygons, per-field summaries, scenario inputs or zone actions (see §4.4).


## 1. Mission and honesty


Make a judge understand the product in 15 seconds and remember one image: the same real storm hitting two rotations side by side, with the difference glowing on the land.


Honesty rules this section must enforce in UI (from `CLAUDE.md`, PRD §2.4/§6.7):


- Every simulation number shows units and a basis chip. Contract bases: `measured | derived | modeled | assumed | relative` (`Basis`, `BasisOrRelative`).
- Outputs are relative comparisons, never predictions. No yield, profit or absolute soil-loss figures.
- Curated sites show a "Pre-built" badge (`Site.pre_built`). Mock data shows a "mock" badge in dev and must never reach the demo.
- Field polygons and crop assignments on curated sites are illustrative: label them "Illustrative (synthetic)".
- Coarse data stays labelled coarse. Never present resampled coarse data as fine-scale measurement.
- Drone/video capture appear only on the Roadmap, never shown working.
- Banner everywhere the PRD asks: "This tool supports, and does not replace, local agronomic expertise."


## 2. Decision log


| ID | Decision | Reason |
| --- | --- | --- |
| D1 | **react-three-fiber / three.js on a WebGL2 baseline.** Next.js App Router, TypeScript, Tailwind, Zustand, Framer Motion, Recharts (per `CLAUDE.md`). | Runs offline on a laptop/projector, full shader control for terraform, water and diff glow, fits a 2-person 36 h budget. |
| D1a | **CesiumJS rejected.** | Its strength is Earth-scale terrain and draped vectors, but our site is about 20 ha. Local/offline terrain is awkward (custom heightmap provider has no water mask; hosting offline quantized-mesh tiles is a known pain point), and it makes terraform/water/diff effects harder. Sources: [CustomHeightmapTerrainProvider](https://cesium.com/learn/cesiumjs/ref-doc/CustomHeightmapTerrainProvider.html), [offline terrain thread](https://community.cesium.com/t/how-to-load-offline-terrain-tiles-from-cesium-terrain-builder-in-cesiumjs/43029). |
| D2 | **NVIDIA Omniverse rejected for the live app.** | Streaming needs an RTX GPU service and WebRTC to the browser (NVIDIA's current reference is Omniverse Streaming on NVCF, GA July 2026), is latency-sensitive to region, cannot run offline, and carries licence terms. Sources: [release notes](https://docs.omniverse.nvidia.com/ovas/latest/release-notes/1_12_0.html), [known limitations](https://docs.omniverse.nvidia.com/ovas/latest/deployments/infra/limitations_etc.html), [licence](https://docs.omniverse.nvidia.com/ovas/latest/common/NVIDIA_Omniverse_License_Agreement.html). Optional P2: a pre-rendered cinematic intro clip (not part of the product). |
| D2a | **WebGPU = P1 only.** | Browser support is uneven (sources disagree on Safari/Firefox, TODO(verify) on caniuse), and the WebGL2 fallback has no compute. Not needed: water frames are precomputed by the backend (FTW1), the client only plays them. |
| D3 | **Terrain from both paths.** Curated Lower Fraser Valley sites use real DEM, pre-built as heightmap PNG16. "Scan your own" uses backend-generated terrain. The viewer consumes one `TerrainPackage` either way. | Matches contract. Real DEM keeps curated sites honest. |
| D4 | **"Model of the area" recipe** = DEM terrain mesh + draped imagery + field polygons with instanced crop rows (P0) + extruded buildings/tree lines where open data is verified (P1) + water overlay. No photogrammetry, splats or drone data. | Georeferenced, offline, every pixel traceable to data. Capture other than photo is Roadmap-only. |
| D5 | **Imagery:** the Data owner verifies an openly licensed aerial/satellite layer (`TODO(verify)` source and licence). Fallback: 10 m satellite-derived imagery plus hillshade, labelled "coarse". | Avoids a licence blocker on demo day. Contract already carries `TextureInfo` and `Source`. |
| D6 | **Fields:** curated sites ship illustrative field polygons labelled synthetic. A scanned photo gets one default field. User-drawn zones are P1. Fields are a contract request. | Field selection is the bridge between the 3D twin and rotation evidence. |
| D7 | **Contract handling:** build only against v1.0.0; list needed additions as contract requests (§4.4) and mock them behind a flag `NEXT_PUBLIC_MOCK_EXTRAS=1`. Never invent fields. | `CLAUDE.md` source-of-truth rule. |
| D8 | **Demo target:** laptop with integrated or mid GPU, 1080p, fully offline, recorded backup video. 60 fps single view, 30 fps split view, auto/switchable quality tiers. | Flaky venue Wi-Fi and projector risk. |
| D9 | **Hero:** one chained flow (§3). | Gives both owners one shared thing to make flawless. |


Basis-label mapping note: the handoff doc's "Observed / Derived / Estimated / Simulated" is NOT used. The contract enum (`measured, derived, modeled, assumed, relative`) is the only set shown in UI.


## 3. Hero storyboard (target under 90 s guided tour)


| # | Beat | What the viewer sees | Owner lead |
| --- | --- | --- | --- |
| 1 | Pick site | Curated Lower Fraser Valley site card ("Pre-built" badge), or scan upload | B |
| 2 | Terraform | Flat plane rises into terrain, imagery fades in, sun and sky settle | A |
| 3 | Select field | Click a field polygon: outline glows, panel slides in (name, area, illustrative crop, data basis) | A (pick/highlight), B (panel) |
| 4 | Choose storm | Storm picker (real NASA POWER storm, hyetograph, "synthetic hourly profile" flag shown) | B |
| 5 | A/B replay | Split screen, two rotations, same camera and time, water flows, timeline scrubs | A |
| 6 | Difference | Diff glow overlay + stats (`DiffStats`: units mm, basis) | A (shader), B (stats) |
| 7 | Evidence | Evidence cards for each rotation (five-part) and insight pop-ups | B |
| 8 | Honesty | Methods link, banner, basis chips visible throughout | B |


Never cut: terraform, storm replay, A/B, evidence cards, Methods page, demo mode.


## 4. Shared interfaces


### 4.1 Coordinates and rasters
- Viewer works in local metric space from `TerrainPackage.crs` (projected, e.g. `EPSG:32611`), origin at terrain centre, +X east, +Z south (row 0 = north), Y up.
- All rasters share `grid.width x grid.height`, row-major, row 0 = north, column 0 = west.
- Heightmap: `elevation_m = min_m + (value / 65535) * (max_m - min_m)`. Layers: 255 = nodata, bytes 0 to 254 map to the legend `value_range`. Normal map: R = east, G = north, B = up. FTW1: `depth_mm = byte * max_depth_mm / 255`. Diff: `diff_mm = (byte - 128) / 127 * max_abs_diff_mm`. Risk: 255 = masked.
- Decoders live in `apps/web/lib/decode/` (to be built by A in task A1, with unit tests on the tilted-plane fixture).


### 4.2 Viewer component API (the A/B boundary)
Owner A builds and owns `<TwinViewer />`. Owner B only talks to it through this API. Change it only by agreement; log changes in §9.


```ts
type TwinViewerProps = {
  terrain: TerrainPackage;            // from contract
  fields?: FieldFeature[];            // contract request R1; mocked until shipped
  layers: LayerName[];                // visible overlays, no reload on toggle
  selectedFieldId?: string | null;
  mode: 'single' | 'split';
  rotationIds: [string] | [string, string];  // RotationId from contract
  sim?: { simId: string; results: SimulationStatus['results'] };
  timeMin: number;                    // minutes from storm start, drives water frames
  showDiff: boolean;                  // uses /simulations/{simId}/diff
  quality: 'auto' | 'low' | 'high';
  reducedMotion: boolean;
  onFieldSelect(id: string | null): void;
  onProbe(p: { lon: number; lat: number; elevation_m: number; layer?: Record<string, number> }): void;
  onReady(): void; onTerraformDone(): void; onError(e: Error): void;
};
```

The implemented, authoritative version (with the logged additions) is `apps/web/components/viewer/types.ts`.


Shared state (Zustand): `siteId, terrainId, selectedFieldId, stormId, rotationIds, timeMin, playing, mode, layers, quality, tourStep`. A owns reading `timeMin`/`mode`/`layers`/`selectedFieldId` in the viewer; B owns writing them from UI. Camera state stays inside A and is shared between the two split views by A.


### 4.3 Contract consumption
| Need | Contract surface (v1.0.0) |
| --- | --- |
| Sites list/detail, badge | `GET /sites`, `/sites/{siteId}` (`pre_built`, `attribution`) |
| Terrain mesh and imagery | `GET /terrain/{id}`, `heightmap.png`, `normal.png`, `texture.jpg` |
| Overlays + legends | `GET /terrain/{id}/layers`, `layers/{name}.png` (slope, flow_accumulation, depressions, cover_class) |
| Insights, provenance | `/terrain/{id}/insights`, `/terrain/{id}/provenance` |
| Storms, weather | `GET /weather/storms`, `/weather/summary` |
| Crops, rotations | `GET /crops`, `/rotations/presets`, `POST /rotations/validate` |
| Simulation + frames + risk | `POST /simulations`, `GET /simulations/{simId}`, `frames/{rotationId}.bin`, `risk/{rotationId}.png` |
| Evidence, difference | `/simulations/{simId}/evidence`, `/simulations/{simId}/diff` |
| Scan progress | `POST /scans`, `/scans/{scanId}`, SSE `/scans/{scanId}/events` |
| Notes | `GET/POST /notes` |


Client: `apps/web/lib/api/client.ts` with `NEXT_PUBLIC_API_MODE=mock|live` (to be built by B in task B1). Mock fixtures come from `packages/contracts/fixtures/`, owned by the contract/data side. Until they exist, A builds a tilted-plane test fixture locally and notes it in the contract-fixtures request.


### 4.4 Contract requests (NOT in v1.0.0, do not implement against them as if real)
| ID | Request | Needed by | Mock until shipped |
| --- | --- | --- | --- |
| R1 | Field polygons per terrain/site: id, name, GeoJSON polygon WGS84, `area_ha`, `illustrative_crop`, `data_status` (synthetic/derived) | A (draping, picking), B (panel) | static GeoJSON in `public/mock-extras/fields.json` (was `public/mock/fields.json`; moved because `sync-mocks` wipes `public/mock`) |
| R2 | Per-field summary: area, mean slope, dominant cover, simulated metrics per rotation with basis | B (field panel) | derive from layers in client, labelled "derived" |
| R3 | Scenario input on simulation request (storm intensity scale, season shift), for the "Field Shift" slider | B (P1 slider), A (replay) | pre-baked alternative sim ids |
| R4 | Per-rotation resilience profile and uncertainty range | B (Rotation Lab) | omit; do not fabricate |
| R5 | Zone actions (user-drawn zone to simulate) | A/B (P1) | out of P0 |


Process: draft each as a short note in `docs/progress/`, message the team, bump the contract version and fixtures per `CLAUDE.md`. Never invent fields in code.


## 5. Part A: Rendering (owner A)


**Owns:** `<TwinViewer />` and everything inside the canvas: terrain, imagery, lighting, terraform, field draping/picking, crop rows, water, A/B split, diff glow, camera, performance, WebGL-off fallback.


### 5.1 Goals
G-A1 Terraform rise and storm A/B replay are flawless and smooth. G-A2 Looks like a product: sun/sky, fog, shadows, shaded water. G-A3 Hits the performance budget on the demo laptop. G-A4 Picking/probe values are correct against the tilted-plane fixture.


### 5.2 Scope
**P0**
1. Scaffold shared R3F canvas and decoders (heightmap PNG16, normal, layer PNGs, FTW1, diff, risk) with unit tests.
2. Terrain mesh from heightmap with LOD-friendly grid (256x256 target, 2 m cells in mock), normals from `normal.png`, relative elevation correct on the tilted fixture.
3. Imagery drape from `texture.jpg`, with the fallback look (hillshade + coarse badge hook) when `texture` is coarse.
4. Lighting: sun directional light with shadows (tier-dependent), sky gradient, distance fog, ACES tone mapping.
5. Terraform animation: flat plane to terrain over about 2.5 s (vertex displacement + imagery fade), skippable, respects reduced motion, emits `onTerraformDone`.
6. Field polygons (R1) draped on terrain: outline + hover + selected glow, picking by ray against terrain mesh then point-in-polygon, `onFieldSelect`.
7. Overlay layers (slope, flow_accumulation, depressions, cover_class, risk) with legend-driven color ramps, toggle without reload.
8. Instanced crop rows inside the selected/hovered fields (simple row geometry, density tiers), colored by crop class, labelled illustrative.
9. Water overlay: upload FTW1 frames as a 3D texture or texture array, interpolate between frames by `timeMin`, shade by depth (relative to `max_depth_mm`), scrub without hitching.
10. A/B split: two viewports (or two render passes), same terrain, shared camera and time, per-side rotation frames, divider UI hook.
11. Difference glow: sample diff PNG (`diff_mm = (byte - 128)/127 * max_abs_diff_mm`) and glow where `b` is wetter/drier, colorblind-safe diverging ramp, never color as the only signal (pair with pattern or legend).
12. Camera: orbit with damping, preset angles (overview, field focus), fly-to selected field, synchronized in split view.
13. Probe/pick readout: elevation, layer values with units (emitted through `onProbe`).
14. WebGL-off and context-lost fallback (static image + message), error boundary.
15. Quality tiers (low/high/auto) with FPS monitor; low disables shadows, reduces instanced density and water resolution.


**P1 (cut first):** ground-level camera and fly-through, extruded buildings/tree lines from verified open data, time-of-day, drawn zones (R5), WebGPU renderer experiment, field-hover tooltips with crop details.


### 5.3 Performance budget (D8)
60 fps single / 30 fps split at 1080p on an integrated or mid GPU. Terrain at most 256x256 vertices per view; water frames at most 256x256x60 bytes (about 4 MB) kept as one texture; crop rows instanced with a cap per tier; one shadow map at most. First useful frame under 3 s from cached assets. Measure on the actual demo laptop during task A9.


### 5.4 Tasks and estimates (P0, hours)
| ID | Task | h |
| --- | --- | --- |
| A1 | Canvas scaffold, decoders + tests, tilted-plane fixture | 4 |
| A2 | Terrain mesh, normals, imagery drape, coarse-imagery fallback | 4 |
| A3 | Lighting, sky, fog, tone mapping, shadow tier | 3 |
| A4 | Terraform animation | 3 |
| A5 | Field draping, highlight, picking (R1 mocked) | 4 |
| A6 | Overlay layers + legends + risk | 3 |
| A7 | Water playback shader + scrubbing | 5 |
| A8 | A/B split with synced camera/time + diff glow | 5 |
| A9 | Instanced crop rows, camera presets/fly-to, probe | 3 |
| A10 | Fallbacks, quality tiers, FPS monitor, perf pass on demo laptop | 3 |
| | **P0 total** | **37** (trim crop rows or presets if behind) |


### 5.5 Acceptance (A)
- [ ] Tilted-plane fixture renders with correct relative elevation; probe readouts match decoded values.
- [ ] Layer toggles do not reload data; WebGL-off shows the fallback.
- [ ] Water scrubs without visible hitching; A/B stays in sync (camera and time) for 60 frames.
- [ ] Diff glow encodes sign and magnitude; legend uses units (mm) and basis.
- [ ] Terraform completes in about 2.5 s and is skippable; reduced motion disables it.
- [ ] Meets fps targets on the demo laptop at 1080p (measured, recorded in the progress note).


## 6. Part B: Product UI/UX (owner B)


**Owns:** everything outside the canvas: app shell, design system, all pages and panels, simulator dashboard, Rotation Lab, evidence cards, insight pop-ups, Methods page, demo mode, accessibility, data client.


### 6.1 Goals
G-B1 One clear decision, understood in 15 s. G-B2 Every number shows units and a basis chip; banner always visible. G-B3 Plain language; no blank states. G-B4 Guided demo under 90 s with reset and offline safety.


### 6.2 Scope
**P0**
1. Scaffold `apps/web` (Next.js App Router, TS strict, Tailwind, Zustand, Framer Motion, Recharts, Vitest); API client with mock/live switch; `lib/types` generated from OpenAPI (`make types`).
2. Design system: tokens (earth/neutral palette, one accent, diverging ramp for diff), typography, spacing, dark-safe panels, motion rules, focus states. Components: `BasisChip` (measured/derived/modeled/assumed/relative), `MetricValue` (value + unit + chip), `Badge` (Pre-built, mock, Illustrative), `SupportBanner`, cards, tabs, legend.
3. Landing (light): one-sentence pitch, hero loop, "Try a Fraser Valley site", Roadmap section (drone/video, never working).
4. Site chooser + Land Scan (upload photo + location, SSE progress using the documented stages, error states).
5. Viewer page: layer panel (legend + basis), field info panel (name, area, illustrative crop, derived metrics with units and basis), selected-field state, probe readout, site attribution.
6. Simulator dashboard: storm picker (hyetograph chart, total mm, antecedent wetness, "synthetic hourly profile" flag), rotation chips (max 3), play/pause/scrub timeline (minutes from storm start), HUD metrics for A vs B (runoff, ponded area/depth, erosion index, each with unit and basis), A/B and diff toggles.
7. Rotation Lab: rotation presets from `/rotations/presets`, validate via `/rotations/validate`, five-part evidence card (`why_suggested, evidence, benefits, information_gaps, risks_for_local_review`) plus the exact support-not-replace line.
8. Insight pop-ups from `/terrain/{id}/insights` (kind, severity 1 to 5, confidence, why it matters, tip), anchored to location/time, non-blocking.
9. Data & Methods page: every dataset with source, licence, attribution, basis; assumptions; limits; "relative, not predictive".
10. Guided demo/presentation mode: scripted tour of §3 under 90 s, Reset key, offline-safe (`OFFLINE=1` serves seed data), recorded backup video link, kiosk-friendly layout at 1080p.
11. Accessibility and QA: keyboard-complete, visible focus, reduced motion, color never the only signal, contrast pass, mock-badge check so no mock data reaches the demo.


**P1 (cut first):** Field Shift slider ("heavier storms / shifted seasons", needs R3), Learn page, Explore Sites page beyond basic chooser, notes UI, multi-language.


### 6.3 Tasks and estimates (P0, hours)
| ID | Task | h |
| --- | --- | --- |
| B1 | Scaffold app, client mock/live, types, shell | 4 |
| B2 | Design system and shared components (chips, badges, banner) | 5 |
| B3 | Landing (light) + site chooser | 3 |
| B4 | Land Scan flow with SSE progress and errors | 4 |
| B5 | Viewer page: layer panel, field panel, probe readout | 4 |
| B6 | Simulator dashboard: storm picker, chips, timeline, HUD | 6 |
| B7 | Rotation Lab + evidence cards + insights | 4 |
| B8 | Data & Methods page | 2 |
| B9 | Guided demo mode, reset, offline path | 3 |
| B10 | A11y, QA, demo-laptop dry run, backup video | 3 |
| | **P0 total** | **38** (cut landing polish and scan edge cases if behind) |


### 6.4 Acceptance (B)
- [ ] Every metric on screen shows units and a basis chip; banner is always visible.
- [ ] Storm, rotation chips, timeline and A/B toggle drive the viewer only through the §4.2 API.
- [ ] Evidence cards show all five parts and the exact support-not-replace sentence.
- [ ] Guided tour completes in under 90 s; Reset restores the start state; works with `OFFLINE=1`.
- [ ] Curated sites show "Pre-built"; field data shows "Illustrative (synthetic)"; no mock badge in demo build.
- [ ] Keyboard usable, reduced motion respected, color is never the only signal.


## 7. Integration schedule (A and B)


| When | A delivers | B delivers | Sync point |
| --- | --- | --- | --- |
| Thu Nov 12 (tonight) | A1 canvas + decoders on tilted fixture | B1 scaffold + client, B2 start | Agree §4.2 API; open contract requests R1/R2 with the data side |
| Fri Nov 13 | A2-A6 terrain, light, terraform, fields, layers | B2-B5 design system, landing, scan, viewer page | Mid-day: first end-to-end "pick site, terraform, select field" on mock data |
| Sat Nov 14 (event) | A7-A8 water, A/B, diff | B6-B7 simulator, Rotation Lab, evidence | Evening: full hero on mock sim `sim_mock_001`-style fixtures |
| Sun Nov 15 morning | A9-A10 perf, fallbacks | B8-B10 Methods, demo mode, QA, backup video | Freeze at about 12:00; submit by 21:59 |


If Section 2 ships real data late, ship the demo on pre-baked seed data (`OFFLINE=1`) and say so.


## 8. Risks and cut order


| Risk | Mitigation |
| --- | --- |
| Imagery licence unresolved | Fallback coarse imagery + hillshade, labelled (D5) |
| Fields (R1) not shipped | Static mock GeoJSON, labelled synthetic |
| Performance on demo laptop | Quality tiers, instancing caps, dry run early (A10) |
| Contract slip (R1 to R5) | Mock flag; P0 never depends on R3 to R5 |
| Scope too big for 36 h each | Cut order: P1 list, then crop rows, camera presets, landing polish, scan edge cases. Never cut the "never cut" list in §3 |
| Demo day failure | Recorded backup video, offline seed data, Reset key |


## 9. Open questions and change log


Open (fill during Prompt 01):
- Names for owners A and B (also fill the "Track owners" table in `Prompts.md`).
- Which 3 curated Lower Fraser Valley sites, and who verifies imagery/DEM licences (`TODO(verify)`).
- Visual identity: palette, display font, name styling.
- Narrator/story character, or purely scientific tone?
- Demo format: 30 s video or 7-slide deck (confirm 2026 format on Nov 13).
- Exact demo laptop model and projector resolution.
- WebGPU: caniuse check before any P1 work.


| Date | Who | Change |
| --- | --- | --- |
| 2026-11-12 | Claude | v0.2: stack locked (r3f/WebGL2), Cesium and Omniverse rejected, hero flow, A/B split, contract requests R1 to R5, task estimates |
| 2026-11-12 | Claude | Base restored from commit `e83a93c` (scaffold, client, heightmap/FTW1 decoders, fixtures, API), so B1 and part of A1 were already done. R1 mock moved to `public/mock-extras/fields.json`. |
| 2026-11-12 | Claude | §4.2 API additions: `layers` accepts `"risk"` (viewer-local, from `RotationResult.risk`); optional `divider`, `exaggeration`, `onStats`, `className`; `onProbe(null)` when the pointer leaves the terrain; ref handle `replay() / skipTerraform() / setCameraPreset()`. |
| 2026-11-12 | Claude | lon/lat to local metres uses a linear map over `bbox_wgs84` (no proj4 dependency). "Coarse imagery" is a viewer heuristic (`resolution_m >= 10` or `source = nasa_gibs`) because `TextureInfo` has no coarse flag. |


## 10. Claude Code prompts (paste-ready)


How to use: one prompt = one fresh Claude Code session (`/clear` first). Run your own track in order, pulling `main` before each. In each session paste the **preamble (10.0) followed by that one prompt**; do not paste the whole PRD, because the preamble tells Claude to read it from the repo. Each prompt ends by writing `docs/progress/s1-<id>.md` (built, files, how to run, gaps, what the next prompt must know). These replace the viewer/UI prompts in `Prompts.md` (14 to 26) for the Section 1 team; `CLAUDE.md` wins on any conflict. If the contract lacks something, Claude must STOP and ask, never guess.


### 10.0 Preamble (paste at the top of EVERY prompt below)


```text
You are working on FieldTwin, Section 1 (3D digital twin + web). Read, in this order: CLAUDE.md, docs/prd/section1-web-3d.md (all of it), packages/contracts/README.md, and the progress notes named in the prompt.
Rules: do only this task, do not start the next one. Never invent endpoints, fields, enum values, dataset names or URLs; if the contract lacks something, STOP and ask me. Anything in PRD section 4.4 (R1 to R5) is a contract REQUEST: use the documented mock behind NEXT_PUBLIC_MOCK_EXTRAS=1, never as if real. Every number on screen has units and a basis chip (measured/derived/modeled/assumed/relative). No yield, profit or absolute soil-loss claims. Same inputs give same outputs. OFFLINE=1 must work.
STEP 0 (before any work): read the "Track owners" table in Prompts.md (A = Rendering, B = Product UI/UX; names may be blank). Print a short block: PULL FIRST (git checkout main && git pull, and which prompts must be merged), COORDINATE WITH (who, about what), WHEN DONE, TELL (who). Check the needed docs/progress/s1-*.md files exist; if not, say who to ask and STOP.
End of task: run the relevant tests/lint/build and show results; tick this prompt's acceptance bullets (which pass, which do not); write docs/progress/s1-<id>.md; remind me to merge my branch and message the people under WHEN DONE, TELL; then stop and wait.
```


### Track A: Rendering


**A1: Canvas scaffold, decoders, tilted fixture** (needs B1 merged)
```text
Branch: fe/A1-viewer-scaffold. Read PRD 4.1 and 5.2 items 1 and 13.
Build apps/web/lib/decode/: heightmap16.ts (PNG16 to Float32 meters using elevation min_m/max_m), normal.ts, layer.ts (255 = nodata, bytes 0 to 254 map to legend value_range), ftw1.ts (magic "FTW1", width, height, frame_count, dtype, max_depth_mm; uint8 frames), diff.ts, risk.ts. Row 0 = north, column 0 = west everywhere. Vitest tests: a 16x16 tilted-plane fixture generated in code, a hand-made 3-frame FTW1 buffer, boundary values (0, 65535, 255 nodata, 128 no-change).
Build apps/web/components/viewer/TwinViewer.tsx: an R3F Canvas shell exporting the TwinViewerProps type from PRD 4.2 (only terrain/onReady/onError implemented now; the rest typed, unused, commented "added in A2+"). Add /dev/viewer loading the tilted fixture.
Do not add meshing, lighting or layers.
Acceptance: decoders pass tests; canvas mounts and calls onReady; type exported.
```


**A2: Terrain mesh, normals, imagery drape** (needs A1)
```text
Branch: fe/A2-terrain-mesh. Read docs/progress/s1-A1.md and PRD 5.2 items 2 and 3.
Build the terrain mesh in local metric space (X east, Z south, Y up), size grid.width*cell_size_m by grid.height*cell_size_m, displaced from the decoded heightmap (vertical exaggeration prop, default 1.5, shown on screen as "x1.5 exaggerated"). Apply normal.png and texture.jpg. When TextureInfo marks imagery coarse/fallback, use a hillshade look and expose a boolean so UI can show a "coarse" badge.
Acceptance: tilted plane renders as a ramp; a test asserts mesh min/max Y equal min_m/max_m scaled.
```


**A3: Lighting, sky, fog, shadows** (needs A2)
```text
Branch: fe/A3-look. Read PRD 5.2 item 4 and 5.3.
Directional sun with optional shadow map (high tier only), hemisphere fill, sky gradient (no external HDRI downloads: offline), distance fog tuned to terrain size, ACES tone mapping. quality prop controls shadows and pixel ratio. FPS readout on /dev/viewer. Do not change terrain or add layers.
```


**A4: Terraform animation** (needs A3)
```text
Branch: fe/A4-terraform. Read PRD section 3 beat 2 and 5.2 item 5.
Flat plane rises to terrain over about 2.5 s with ease-out, imagery cross-fades in, sun and fog settle. Skippable (click or Escape), jumps to final state when reducedMotion is true, emits onTerraformDone, deterministic, replayable through a replay() ref method (used by demo Reset). Use uniform-driven vertex displacement, not geometry rebuilds.
Acceptance: plays once, replays, skip works, reduced motion respected, no per-frame allocations.
```


**A5: Field draping, highlight, picking** (needs A3; R1 mocked)
```text
Branch: fe/A5-fields. Read PRD 4.4 (R1), D6, 5.2 item 6.
Create public/mock/fields.json (GeoJSON WGS84, 5 illustrative fields; properties id, name, area_ha, illustrative_crop, data_status "synthetic"), loaded only when NEXT_PUBLIC_MOCK_EXTRAS=1, with a visible "mock" marker. Convert lon/lat to the local metric frame using the terrain CRS; if that needs a new dependency (for example proj4), ask me first. Drape outlines on terrain by sampling the heightmap along edges, hover highlight, selected glow, pick by ray vs terrain then point-in-polygon, call onFieldSelect, Escape deselects.
Acceptance: click selects exactly that field; empty land deselects; selection is controlled by the selectedFieldId prop.
```


**A6: Overlay layers and legends** (needs A2)
```text
Branch: fe/A6-layers. Read PRD 5.2 item 7 and the layer section of packages/contracts/README.md.
Layers (slope, flow_accumulation, depressions, cover_class, risk) as textures blended in one material so toggling never reloads data. Ramps come from the legend (GET /terrain/{id}/layers: color_ramp, value_range, classes). Risk also uses a hatch pattern. Export legend data for owner B's panel (do not build the panel).
Acceptance: toggling is instant; nodata (255) is transparent; categorical cover_class uses legend colors.
```


**A7: Water frame playback** (needs A2)
```text
Branch: fe/A7-water. Read PRD 5.2 item 9, 5.3 and the FTW1 section of packages/contracts/README.md.
Fetch frames/{rotationId}.bin, decode, upload as one 3D/array texture. For timeMin, choose frames via RotationResult.frame_times_min and interpolate between the two nearest. Shade by depth relative to max_depth_mm (transparent at 0, deepening blue), deterministic subtle flow detail. No hitching when scrubbing; cap resolution on the low tier. If real fixtures do not exist, test with a generated fake 60-frame FTW1.
Acceptance: scrubbing 0 to 59 is smooth; depth 0 shows no water; frame lookup is unit-tested.
```


**A8: A/B split and difference glow** (needs A7, A5, A6)
```text
Branch: fe/A8-ab-diff. Read PRD section 3 beats 5 and 6, 5.2 items 10 and 11.
mode "split": same terrain rendered twice side by side, each with its rotation's frames, ONE shared camera and ONE timeMin; divider position bindable by owner B. showDiff: fetch /simulations/{simId}/diff (PNG), decode diff_mm = (byte-128)/127*max_abs_diff_mm, glow where b is wetter, a distinct hue/pattern where drier, colorblind-safe diverging ramp plus a stripe pattern so color is not the only signal. Export legend data from DiffStats.
Acceptance: camera and time identical on both sides over 60 frames (test it); diff sign and magnitude correct on a synthetic diff.
```


**A9: Crop rows, camera presets, probe** (needs A5)
```text
Branch: fe/A9-crops-camera-probe. Read PRD 5.2 items 8, 12, 13.
Instanced crop rows inside fields (InstancedMesh, density cap per quality tier), colored by crop class, labelled illustrative. Camera: damped orbit, presets overview and field-focus, fly-to selected field (about 1 s, skipped on reducedMotion), synced across split views. onProbe emits lon, lat, elevation_m and layer values with units. Cut crop rows first if behind.
```


**A10: Fallbacks, quality tiers, performance pass** (needs all of A)
```text
Branch: fe/A10-perf. Read PRD 5.3 and section 8.
WebGL-off and webglcontextlost fallback (static preview + message), error boundary calling onError. quality "auto" measures FPS for 2 s and drops to low if under 40 fps single / 20 split. Profile on the demo laptop at 1080p and record in the progress note, as measured numbers: fps single and split, draw calls, memory, first useful frame time. Fix the top 2 bottlenecks only.
Acceptance: PRD 5.3 targets met, or the gap is stated plainly.
```


### Track B: Product UI/UX


**B1: Scaffold, client, types, shell** (do first; needs nothing)
```text
Branch: fe/B1-scaffold. Read PRD 4.3 and 6.2 item 1. apps/web is empty today.
Scaffold Next.js App Router, TypeScript strict, Tailwind, pnpm; add zustand, framer-motion, recharts, vitest, react-three-fiber, drei, maplibre-gl. Build apps/web/lib/api/client.ts with NEXT_PUBLIC_API_MODE=mock|live (mock reads apps/web/public/mock, synced from packages/contracts/fixtures when they exist). Add `pnpm types` (openapi-typescript) generating lib/types from packages/contracts/openapi.yaml and update the Makefile `types` target. Shell: header, routes (/, /explore, /scan, /viewer, /simulate, /lab, /methods), SupportBanner placeholder, Zustand store with the keys in PRD 4.2.
No real pages. Acceptance: pnpm dev, build and test run clean.
```


**B2: Design system and honesty components** (needs B1)
```text
Branch: fe/B2-design-system. Read PRD section 1 and 6.2 item 2.
Tokens (earth/neutral palette, one accent, colorblind-safe diverging ramp), typography, spacing, focus styles, motion rules respecting prefers-reduced-motion. Components: BasisChip (measured/derived/modeled/assumed/relative, tooltip per basis), MetricValue (value + unit + BasisChip; throws in dev if unit or basis is missing), Badge variants (Pre-built, mock, Illustrative (synthetic), coarse), SupportBanner with the exact sentence "This tool supports, and does not replace, local agronomic expertise.", Card, Tabs, Legend. /dev/styleguide page. Vitest tests for MetricValue and BasisChip.
```


**B3: Landing (light) and site chooser** (needs B2)
```text
Branch: fe/B3-landing-sites. Read PRD section 3 beat 1 and 6.2 item 3.
Landing: one-sentence pitch, light hero (static image or loop, no heavy 3D), CTA "Try a Fraser Valley site", Roadmap section listing drone/video capture as NOT available yet. Site chooser from GET /sites: cards with Pre-built badge from pre_built, attribution, relief_m and area_ha with units and basis. No blank states: skeletons and error cards.
```


**B4: Land Scan flow** (needs B2)
```text
Branch: fe/B4-scan. Read PRD 6.2 item 4 and the scan stages in packages/contracts/README.md.
Upload photo + location form (client validation per ScanCreateForm), POST /scans, follow SSE /scans/{id}/events through the documented stages in order with plain-language progress, retry on failed. On ready navigate to /viewer with the terrain id. Mock mode simulates the SSE from fixtures.
```


**B5: Viewer page: layers, field panel, probe** (needs B2 and A1)
```text
Branch: fe/B5-viewer-page. Read PRD 4.2 and 6.2 item 5.
/viewer wires <TwinViewer /> through the Zustand store only (never import viewer internals). Layer panel with legends and basis, field info panel (name, area_ha, illustrative_crop with an "Illustrative (synthetic)" badge, derived mean slope with unit and basis chip; R2 data mocked and marked), probe readout, site attribution. Panel animation respects reduced motion.
```


**B6: Simulator dashboard** (needs B5)
```text
Branch: fe/B6-simulator. Read PRD section 3 beats 4 to 6, 6.2 item 6, and the Storm, SimulationRequest and Metrics schemas.
Storm picker (GET /weather/storms; Recharts hyetograph; total_mm, peak_day_mm, antecedent_wetness with unit and basis; show the "synthetic hourly profile" flag when hyetograph.synthetic is true), up to 3 rotation chips, POST /simulations then poll GET /simulations/{id} with progress, play/pause/scrub timeline in minutes from storm start, A/B and diff toggles driving viewer props, HUD comparing A vs B (runoff_volume_m3, ponded_area_ha, ponded_peak_depth_cm, erosion_index_mean as a RELATIVE index, with basis chips). Wording: comparisons, never predictions.
```


**B7: Rotation Lab, evidence cards, insights** (needs B6)
```text
Branch: fe/B7-lab-evidence. Read PRD 6.2 items 7 and 8, and the EvidenceCard and Insight schemas.
Rotation presets (GET /rotations/presets), messages from POST /rotations/validate, five-part evidence card (why_suggested, evidence, benefits, information_gaps, risks_for_local_review) plus the support_not_replace sentence from the response. Insight pins/pop-ups anchored by lon/lat/at_time_min: non-blocking, severity 1 to 5 shown by shape/text and not only color, with confidence, why it matters, and tip. No R3/R4 features.
```


**B8: Data & Methods page** (needs B2; independent)
```text
Branch: fe/B8-methods. Read PRD section 1 and the GET /terrain/{id}/provenance schemas (Source, ProvenanceDataset, Assumption).
List every dataset with source, licence, attribution and basis, plus assumptions, limits, and a plain statement that outputs are relative comparisons. Pull from provenance where available. Anything unverified shows TODO(verify) in dev and fails a production build check. Never invent a dataset, licence or URL.
```


**B9: Guided demo, reset, offline** (needs B5 to B7)
```text
Branch: fe/B9-demo-mode. Read PRD section 3 and 6.2 item 10.
Scripted tour of the 8 beats under 90 s (print total measured time in a dev overlay), tourStep in the store, pause/skip/back, global Reset key (R) restoring the initial store state and calling the viewer replay(). Presenter mode: larger type, dev badges hidden, 1080p safe area. OFFLINE=1 loads only local seed data and shows an "Offline: pre-built data" notice. Link to the recorded backup video.
```


**B10: Accessibility, QA, dry run** (needs B9)
```text
Branch: fe/B10-qa. Read PRD 6.4 and section 8.
Keyboard-only run through the whole hero; fix focus order and traps. Check contrast and that color is never the only signal (diff, risk, insight severity, chips). Verify prefers-reduced-motion everywhere. Search the production build for "mock" and "TODO(verify)". Dry run on the demo laptop, record the backup video, and write real findings (failed, fixed, remaining) in the progress note. Run lint, typecheck, build, vitest and show the output.
```

### Local completion follow-up — 2026-11-12

Vince's approval of the foundation restoration was confirmed by the user. The current workflow is direct commits to main (implementation-plan/README.md), superseding historical feature-branch instructions. The restored contract remains v1.0.0 unchanged.

ViewerStats now optionally exposes renderer geometry, texture and program counts. These are resource counts, not GPU memory bytes. The dev harness measures first rendered-frame latency; it is not a network load SLA or proof of performance on the demo laptop. Simulation polling and graphics recovery now discard stale async responses. R1/R2 are documented in docs/progress/s1-contract-requests.md, still pending team agreement.
