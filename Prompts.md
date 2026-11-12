Paste-ready prompts for building FieldTwin from `prd.md`. One prompt is one short Claude Code session.

## How to use

1. **Run Phase 0 first, in order.** It sets up the repo, the shared rules file (`CLAUDE.md`), and the frozen contract. After **Prompt 06**, everyone can work in parallel.
2. **Pick a track.** Each person takes one track (FE-A, FE-B, BE-A, …) and runs that track's prompts **in order**. The "Needs" column says which prompts must be merged first.
3. **Start a fresh Claude Code session for each prompt** (`/clear` or a new terminal). Each prompt is self-contained and tells Claude what to read. This keeps sessions short and avoids drift.
4. **Review between prompts.** Look at the result, run it, ask for tweaks in the same session, and commit when happy. Then `/clear` and paste the next one.
5. **Pull `main` before each prompt.** Merge your branch after each prompt (or every few prompts) so others get your work.
6. **Progress log:** every prompt writes a short note to `docs/progress/<prompt-number>.md`. The next session reads these instead of guessing.

> Heads-up (PRD §12.3 Q3): check with the Vancouver organizers whether writing code before Nov 14 is allowed. Prompt R1 (data research) is likely fine before the event; code prompts may not be.

### Tracks at a glance

| Track                               | Who                                   | Prompts |
| ----------------------------------- | ------------------------------------- | ------- |
| **Phase 0 — Foundation**            | 1–2 people, in order                  | 01 → 06 |
| **R — Research**                    | anyone, early                         | R1      |
| **FE-A — Shell & content pages**    | Front-end person 1                    | 07 → 13 |
| **FE-B — 3D viewer**                | Front-end person 2                    | 14 → 18 |
| **FE-C — Land Scan**                | Front-end person 3 (or FE-A after 13) | 19 → 20 |
| **FE-D — Simulator & Rotation Lab** | Front-end person 2 or 4               | 21 → 28 |
| **BE-A — Terrain**                  | Back-end person 1                     | 29 → 33 |
| **BE-B — Imagery & cover**          | Back-end person 2                     | 34 → 36 |
| **BE-C — Weather**                  | Back-end person 3                     | 37 → 39 |
| **BE-D — Crops & rotations**        | Back-end person 3 (after 39) or 4     | 40 → 41 |
| **BE-E — Simulation & insights**    | Back-end person 1 or 4                | 42 → 47 |
| **BE-F — Orchestration & tests**    | Back-end person 2 (after 36)          | 48 → 49 |
| **Phase I — Integration & demo**    | whoever is free, mostly in order      | 50 → 62 |

### Full index

| #   | Track    | Task (PRD id)                                              | Pri | Needs                             |
| --- | -------- | ---------------------------------------------------------- | --- | --------------------------------- |
| 01  | Phase 0  | Repo scaffold + `CLAUDE.md` rules                          | P0  | —                                 |
| 02  | Phase 0  | OpenAPI contract (BE-00)                                   | P0  | 01                                |
| 03  | Phase 0  | Procedural terrain + frame fixtures (BE-00)                | P0  | 02                                |
| 04  | Phase 0  | JSON + SSE fixtures (BE-00)                                | P0  | 02                                |
| 05  | Phase 0  | FastAPI skeleton serving fixtures (BE-00)                  | P0  | 03, 04                            |
| 06  | Phase 0  | Next.js scaffold, types, mock/live API client (FE-00)      | P0  | 03, 04                            |
| R1  | Research | Verify curated sites, data access, licenses                | P0  | —                                 |
| 07  | FE-A     | Design tokens + base components + styleguide (FE-00)       | P0  | 06                                |
| 08  | FE-A     | App shell: nav, footer, routes, store (FE-00)              | P0  | 07                                |
| 09  | FE-A     | Explore Sites page (FE-02)                                 | P0  | 08                                |
| 10  | FE-A     | Data & Methods page (FE-08)                                | P0  | 08                                |
| 11  | FE-A     | Landing page, static sections (FE-01)                      | P0  | 08                                |
| 12  | FE-A     | Learn page (FE-09)                                         | P1  | 08                                |
| 13  | FE-A     | About & Roadmap page (FE-10)                               | P1  | 08                                |
| 14  | FE-B     | Viewer: terrain mesh + texture + orbit (FE-04)             | P0  | 06                                |
| 15  | FE-B     | Viewer: analysis layers + legends (FE-04)                  | P0  | 14                                |
| 16  | FE-B     | Viewer: water frames + risk overlay (FE-04)                | P0  | 15                                |
| 17  | FE-B     | Viewer: picking, scale bar, camera modes, perf (FE-04)     | P0  | 16                                |
| 18  | FE-B     | Viewer: 2D fallback (FE-04)                                | P0  | 16                                |
| 19  | FE-C     | Scan wizard steps 1–2 (FE-03)                              | P0  | 08                                |
| 20  | FE-C     | Scan terraform sequence (FE-03)                            | P0  | 14, 19                            |
| 21  | FE-D     | Simulator layout + storm/rotation controls (FE-05)         | P0  | 08, 16                            |
| 22  | FE-D     | Simulator timeline, playback, HUD (FE-05)                  | P0  | 21                                |
| 23  | FE-D     | Simulator A/B split + difference (FE-05)                   | P0  | 22                                |
| 24  | FE-D     | Insight pins + pop-ups (FE-07)                             | P0  | 22                                |
| 25  | FE-D     | Right panel: tips, metrics, layers tabs (FE-07)            | P0  | 24                                |
| 26  | FE-D     | Rotation Lab core (FE-06)                                  | P0  | 08                                |
| 27  | FE-D     | Rotation Lab crop swap + sliders (FE-06)                   | P1  | 26                                |
| 28  | FE-D     | Trends view (FE-11)                                        | P1  | 08                                |
| 29  | BE-A     | Terrain interface + grid utils + PrecomputedSource (BE-01) | P0  | 05                                |
| 30  | BE-A     | HRDEM adapter (BE-01)                                      | P0  | 29, R1                            |
| 31  | BE-A     | NASADEM fallback + fallback chain (BE-01)                  | P0  | 29                                |
| 32  | BE-A     | Terrain analysis (BE-04)                                   | P0  | 29                                |
| 33  | BE-A     | Rendering packaging (BE-10)                                | P0  | 32                                |
| 34  | BE-B     | Upload validation + storage (BE-02)                        | P0  | 05                                |
| 35  | BE-B     | Image placement + fallback texture (BE-02)                 | P0  | 34                                |
| 36  | BE-B     | Cover classification (BE-05)                               | P0  | 35                                |
| 37  | BE-C     | NASA POWER client + cache (BE-06)                          | P0  | 05                                |
| 38  | BE-C     | Storm ranking + hyetograph (BE-06)                         | P0  | 37                                |
| 39  | BE-C     | Trends + `/weather/summary` (BE-06)                        | P0  | 37                                |
| 40  | BE-D     | Crop library + rotation presets + calendar (BE-07)         | P0  | 05                                |
| 41  | BE-D     | Rotation validation endpoint (BE-07)                       | P0  | 40                                |
| 42  | BE-E     | Sim: SCS runoff module (BE-08)                             | P0  | 05                                |
| 43  | BE-E     | Sim: routing + ponding (BE-08)                             | P0  | 42                                |
| 44  | BE-E     | Sim: erosion index + metrics (BE-08)                       | P0  | 43                                |
| 45  | BE-E     | Sim: frames, job API, caching (BE-08)                      | P0  | 44                                |
| 46  | BE-E     | Insight rule engine (BE-09)                                | P0  | 45                                |
| 47  | BE-E     | Tips library + evidence cards (BE-09)                      | P0  | 46                                |
| 48  | BE-F     | Scan orchestration + SSE (BE-03)                           | P0  | 05 (wires in others as they land) |
| 49  | BE-F     | Contract tests + smoke script (BE-12)                      | P0  | 05                                |
| 50  | Phase I  | `sites.yaml` + seed script (BE-11)                         | P0  | 30–47, R1                         |
| 51  | Phase I  | Offline mode + seed verifier (BE-11)                       | P0  | 50                                |
| 52  | Phase I  | Mock→live: Sites, Methods, Trends                          | P0  | 09, 10, 51                        |
| 53  | Phase I  | Mock→live: Land Scan                                       | P0  | 20, 48, 51                        |
| 54  | Phase I  | Mock→live: Simulator + Rotation Lab                        | P0  | 23, 25, 26, 51                    |
| 55  | Phase I  | Landing hero 3D + storm teaser (FE-01)                     | P0  | 11, 16                            |
| 56  | Phase I  | Guided demo tour (FE-12)                                   | P0  | 52–55                             |
| 57  | Phase I  | Presentation mode + reset (FE-12)                          | P0  | 56                                |
| 58  | Phase I  | Yield-stress index (BE-14)                                 | P1  | 39, 40                            |
| 59  | Phase I  | Drone map upload adapter (BE-13)                           | P2  | 29                                |
| 60  | Phase I  | Field notes (FE-07)                                        | P2  | 24                                |
| 61  | Phase I  | QA, accessibility, Playwright E2E (FE-13)                  | P0  | 57                                |
| 62  | Phase I  | Submission pack + README                                   | P0  | 61                                |

**Cut order if behind** (PRD §10.3): skip 59, 13, 28, 58, 12, 60, 27 first. **Never skip:** 20, 23, 26/47, 10, 56.

---

## Phase 0 — Foundation (run in order)

### Prompt 01 — Repo scaffold and shared rules

```text
You are setting up the FieldTwin repo for a 48-hour NASA Space Apps hackathon. The full spec is in prd.md at the repo root. Read ONLY these PRD sections now: §0, §2.7, §6.1, §8 (the "Recommended stack" paragraph and BE-00 card), §9.

Do this, and nothing else:
1. Create a branch `be/BE-00-scaffold`.
2. Create the monorepo layout from BE-00: apps/web/, services/api/, packages/contracts/, data/seed/, scripts/, docs/progress/. Add a .gitkeep where a folder is empty. Do NOT scaffold Next.js or FastAPI yet (later prompts do that).
3. Create .gitignore (Node, Python, .env, data/cache/, data/uploads/, .DS_Store), and .env.example with names only: OFFLINE, DATA_DIR, EARTHDATA_USERNAME, EARTHDATA_PASSWORD, LOG_LEVEL, NEXT_PUBLIC_API_MODE, NEXT_PUBLIC_API_BASE.
4. Create CLAUDE.md at the repo root. It is read at the start of every future session, so keep it under ~80 lines. It must contain:
   - Project one-liner and the layout above.
   - Stack: web = Next.js App Router + TypeScript + Tailwind + react-three-fiber + MapLibre GL + Framer Motion + Zustand + Recharts, pnpm. api = Python 3.11+, FastAPI, NumPy, SciPy, rasterio, scikit-image, Pillow, httpx, pytest; use `uv` if installed, else venv + pip.
   - "Source of truth" rules: prd.md §6 and packages/contracts/openapi.yaml define every schema, endpoint, file format. Never invent endpoints, fields, or enum values. If something is missing from the contract, STOP and ask the user instead of guessing.
   - Anti-hallucination rules: never invent external API URLs, parameter names, dataset names, constants, or licenses. If a fact is marked "verify" in the PRD, look it up (web) or ask; record the source URL in code comments or docs. Mark unverified values with `TODO(verify)`.
   - Scope rules: only do the task in the current prompt; do not start the next task; do not refactor unrelated code; do not touch files owned by other tracks unless the prompt says so.
   - Honesty rules from PRD §2.4 and §6.7 (basis labels, relative metrics, pre-built badges, roadmap-only drone features, support-not-replace line).
   - Git rules: work on a branch named `fe/<ID>-<slug>` or `be/<ID>-<slug>`; small commits; never commit secrets or restricted imagery.
   - End-of-task checklist: (a) run the relevant tests/lint/build and show results; (b) tick the acceptance criteria from the PRD card, saying which pass and which don't; (c) write docs/progress/<prompt-number>.md with: what was built, files touched, how to run it, known gaps, anything the next prompt must know; (d) stop and wait for the user.
   - Commands section with placeholders to fill later: `make dev`, `make test`, `make seed`, `pnpm dev`.
5. Create a root Makefile with stub targets dev, test, seed, fixtures, types that just echo "not yet implemented".
6. Replace README.md with a short overview, the layout, and a "Contract change process" section from PRD §9.1 (message the team, bump version, update fixtures).

Then follow the end-of-task checklist in CLAUDE.md (progress file: docs/progress/01.md).
```

### Prompt 02 — OpenAPI contract

```text
Read CLAUDE.md, docs/progress/01.md, and prd.md §6 (all of it). Branch: be/BE-00-contract.

Task: write packages/contracts/openapi.yaml (OpenAPI 3.1) that encodes PRD §6 EXACTLY.
- Every endpoint in §6.3 with method, path, params, request body, and response schema. Base path /api/v1.
- Component schemas for: TerrainPackage, Site, Storm, CropTemplate, Rotation, SimulationRequest, SimulationStatus, Metrics, Insight, EvidenceCard, ScanStatus, ProgressEvent (§6.5 stage enum in order), LayerCatalog, Provenance, WeatherSummary, ValidateResult, Note, Error (§6.6 with the code enum).
- Basis enum: measured | derived | modeled | assumed (plus "relative" where §6.2 uses it).
- Binary/PNG/JPEG responses described with correct content types. Describe the FTW1 frame format (§6.4) in the description field of the frames endpoint.
- For schemas the PRD leaves loose (layers catalog, provenance, weather summary, validate result, scan status), design the smallest sensible shape, and list every such decision in a "Decisions" section in docs/progress/02.md so the team can review before freeze.
- Set info.version to "1.0.0".

Also add packages/contracts/README.md explaining the heightmap decoding formula, cover_class index values, and the frame format, copied from §6.2/§6.4.

Validate the file with a real validator (e.g. `npx @redocly/cli lint` or openapi-spec-validator) and fix all errors.

Do not write any server or client code. Follow the end-of-task checklist in CLAUDE.md (progress file: docs/progress/02.md).
```

> **Pause here:** the team reviews the "Decisions" list in `docs/progress/02.md`, edits anything, then merges. **This is the contract freeze.**

### Prompt 03 — Procedural terrain and frame fixtures

```text
Read CLAUDE.md, docs/progress/02.md, packages/contracts/openapi.yaml, packages/contracts/README.md, and prd.md §6.2 (heightmap/layer encodings), §6.4, §6.8. Branch: be/BE-00-fixtures-terrain.

Task: a Python script scripts/make_fixtures_terrain.py (deterministic, fixed seed) that writes into packages/contracts/fixtures/terrain/:
1. Three terrains at 256x256: `terr_mock_hills` (smooth noise hills with one clear valley and one bowl), `terr_mock_tilted` (perfect tilted plane, for decode tests), `terr_mock_bowl` (single depression of known depth). For each:
   - heightmap.png: 16-bit grayscale, encoded with the §6.2 formula; record min_m/max_m.
   - normal.png (RGB normal map computed from the heights).
   - texture.jpg (procedural earthy color with a few "field" rectangles and a darker bare patch).
   - layers/slope.png, flow_accumulation.png, depressions.png (8-bit, simple approximations are fine and must be labeled mock), cover_class.png (indexed 0/1/2/3/255 per §6.2).
   - terrain.json: a valid TerrainPackage pointing at /api/v1/terrain/<id>/... with "mock" in the name and quality_flags.
2. A frame-file writer module packages/contracts/fixtures_lib/ftw1.py with write_ftw1() and read_ftw1() matching §6.4 byte-for-byte (little-endian). Use it to write 60-frame fake water animations for terr_mock_hills for three rotations (water gathering in the valley and bowl, different amounts per rotation): fixtures/simulations/sim_mock_001/frames/rot_existing.bin, rot_cover.bin, rot_forage.bin, plus a risk/<rot>.png for each.
3. pytest tests in packages/contracts/tests/: heightmap round-trip within 1 cm; tilted plane decodes as a plane; ftw1 write→read round-trip; header bytes exactly match §6.4.

Add a `make fixtures` target that runs this script. Keep total fixture size under ~15 MB.

Do not write JSON fixtures for other schemas (Prompt 04 does that). Follow the end-of-task checklist in CLAUDE.md (progress file: docs/progress/03.md).
```

### Prompt 04 — JSON and SSE fixtures

```text
Read CLAUDE.md, docs/progress/02.md, packages/contracts/openapi.yaml, and prd.md §6.2, §6.5, §6.8. Branch: be/BE-00-fixtures-json.
(Prompt 03 may be running in parallel and owns fixtures/terrain and fixtures/simulations/*/frames|risk. Do not touch those.)

Task: create JSON fixtures under packages/contracts/fixtures/ that validate against openapi.yaml:
- sites.json: 3 mock sites (one per region: Okanagan, Fraser Valley, Metro Vancouver) all using terrain_id "terr_mock_hills" for now, pre_built true, names containing "(mock)".
- storms/terr_mock_hills.json: 3 storms with plausible but clearly placeholder numbers and hourly hyetographs (synthetic: true).
- crops.json: 8 crops from BE-07 with source "to_verify".
- rotations/terr_mock_hills.json: exactly 3 rotations (rot_existing is_existing true, rot_cover, rot_forage) with cover calendars.
- simulations/sim_mock_001/status.json: status done, results for all 3 rotations with metrics (cover rotations clearly lower runoff/erosion), step_minutes and frame_times.
- simulations/sim_mock_001/evidence.json: 3 EvidenceCards (all five sections filled, numbers matching the metrics) + 6 Insights with anchors inside the mock bbox and some with at_time_min.
- terrain/terr_mock_hills/insights.json, layers.json (legends), provenance.json.
- weather/summary.json: annual series 1981–2025 with trend fields.
- scans/: sse_success.txt (full stage sequence from §6.5 ending in ready with terrain_id) and sse_fail_coverage.txt (fails at fetching_elevation with TERRAIN_COVERAGE_MISSING), plus scan_status.json.
- errors/: one example per error code.

Add a test packages/contracts/tests/test_fixtures_valid.py that validates every JSON fixture against its OpenAPI schema (e.g. with jsonschema / openapi-core). Make it pass.

Follow the end-of-task checklist in CLAUDE.md (progress file: docs/progress/04.md).
```

### Prompt 05 — FastAPI skeleton serving fixtures

```text
Read CLAUDE.md, docs/progress/02.md–04.md, packages/contracts/openapi.yaml, and prd.md §6.3, §6.6, §6.7, and the BE-00 card in §8. Branch: be/BE-00-api-skeleton.

Task: scaffold services/api as a FastAPI app that serves every endpoint in openapi.yaml from packages/contracts/fixtures/.
- Structure: services/api/app/main.py, app/routers/<area>.py (health, sites, scans, terrain, weather, crops, rotations, simulations, notes), app/core/config.py (env: OFFLINE, DATA_DIR, LOG_LEVEL), app/core/errors.py (one exception class + handler producing the §6.6 format), app/core/logging.py (request timing), app/providers/fixtures.py (loads fixture files).
- Design each router to call a "service" function so later prompts can swap fixture data for real logic without touching the router. Put these in app/services/<area>.py, returning fixture data for now.
- SSE for /scans/{id}/events: replay sse_success.txt with ~400 ms between events (use sse-starlette or a StreamingResponse).
- POST /simulations returns the fixture status; POST /scans returns a scan_id.
- Binary assets: correct content types, `Cache-Control: public, max-age=31536000, immutable`, gzip middleware.
- CORS for http://localhost:3000. /health returns {status, mode, version}.
- Unknown IDs return NOT_FOUND in the standard error format.
- pyproject.toml with pinned deps; Makefile targets `dev` (uvicorn on :8000 with reload) and `test` (pytest for services/api and packages/contracts).
- Tests: every GET route returns 200 with a body that validates against openapi.yaml; one 404 test; SSE test reads all events in order.

Update CLAUDE.md "Commands" section with the real commands. Follow the end-of-task checklist in CLAUDE.md (progress file: docs/progress/05.md).
```

### Prompt 06 — Next.js scaffold, types, mock/live API client

```text
Read CLAUDE.md, docs/progress/02.md–04.md, packages/contracts/openapi.yaml, and prd.md §6.1, §6.8, §7 (stack paragraph, "Rules for every FE task", and the FE-00 card). Branch: fe/FE-00-scaffold.

Task: scaffold apps/web and its data layer. No UI design yet.
1. Next.js (App Router, TypeScript strict, Tailwind, ESLint) with pnpm. Install: three, @react-three/fiber, @react-three/drei, maplibre-gl, framer-motion, zustand, recharts, openapi-typescript.
2. `pnpm types` generates apps/web/lib/api/schema.d.ts from packages/contracts/openapi.yaml. Add `make types` that calls it.
3. `pnpm sync-mocks` copies packages/contracts/fixtures into apps/web/public/mock/ (gitignored copy).
4. apps/web/lib/api/client.ts: typed functions for every endpoint (getSites, getSite, startScan, getScan, subscribeScanEvents, getTerrain, getLayers, getInsights, getProvenance, getWeatherSummary, getStorms, getCrops, getRotationPresets, validateRotation, runSimulation, getSimulation, getEvidence, getDiff) plus assetUrl(path) for PNG/JPEG/bin URLs.
   - NEXT_PUBLIC_API_MODE=mock: resolve to files under /mock/ (map IDs to the fixture files; POSTs return fixture responses; subscribeScanEvents replays the SSE fixture with timers; an option to replay the failure stream).
   - NEXT_PUBLIC_API_MODE=live: fetch NEXT_PUBLIC_API_BASE (default http://localhost:8000/api/v1), use EventSource for SSE, parse §6.6 errors into a typed ApiError.
   - Export `isMock` so UI can show a "mock" badge.
5. apps/web/lib/decode/heightmap.ts (16-bit PNG → Float32Array elevations using the §6.2 formula; use a PNG decoder that keeps 16-bit precision, e.g. fast-png or UPNG — browsers' canvas drops to 8-bit) and lib/decode/ftw1.ts (§6.4 parser → {width,height,frameCount,maxDepthMm,frames: Uint8Array}). Unit tests with Vitest against the fixtures (tilted plane decodes as a plane; ftw1 header matches).
6. A throwaway page /dev/api that calls getSites and getTerrain and prints JSON, to prove both modes work.

Do not build the design system, nav, or real pages (Prompts 07–08 do that). Update CLAUDE.md Commands. Follow the end-of-task checklist (progress file: docs/progress/06.md).
```

> **After Prompt 06 merges, all tracks below can start in parallel.**

---

## R — Research (anyone, can start right away)

### Prompt R1 — Verify curated sites, data access, and licenses

```text
Read CLAUDE.md and prd.md §2.4, §8 ("External data sources" table), §12.3. Do NOT write application code.

Task: research and write docs/research/data-sources.md. Use web search and cite a URL for every claim. If you cannot confirm something, write "UNVERIFIED" — never guess.
1. NRCan HRDEM: how to find tiles for a bbox (STAC endpoint URL and collection id, or AWS bucket path), file format (COG?), CRS, vertical datum, DTM vs DSM availability, license text.
2. Coverage check for each candidate site: Sumas Prairie (Abbotsford), an Okanagan orchard/vineyard slope, UBC Farm. For each: proposed bbox (≈0.5–1.5 km side), whether HRDEM 1 m or 2 m covers it, and how you checked.
3. NASADEM: download method, auth needs, tile naming.
4. NASA POWER: exact daily point endpoint URL, parameter names for precipitation, T2M/T2M_MAX/T2M_MIN, surface and root-zone soil wetness, community value, date limits, rate limits. Include one full example request URL.
5. NASA GIBS: WMTS capabilities URL and 2–3 candidate layer names with their native resolution; say plainly if none are usable at farm scale.
6. License-clear imagery options for each site (BC open orthophotos? Sentinel-2? own photos?) with license terms.
7. A recommendation: the 3 sites to use, with bboxes, and the open risks.

End with a short "Decisions needed from the team" list. Write docs/progress/R1.md per the CLAUDE.md checklist and stop.
```

---

## FE-A — Shell and content pages

### Prompt 07 — Design tokens, base components, styleguide

```text
Read CLAUDE.md, docs/progress/06.md, and prd.md §7.0 and the FE-00 card. Branch: fe/FE-00-design-system.

Task: build the design system in apps/web.
- Tokens as CSS variables + Tailwind theme extension (no hard-coded hex in components): dark dashboard surfaces, warm light content surfaces, earth tones, one water hue family, amber→red risk scale, one accent. Fonts via next/font: one display face, one UI sans, one mono for numbers.
- Components in apps/web/components/ui/: Button, Card, Chip, Tabs, Slider, Tooltip, Popover, Modal, Toast, Skeleton, Badge (variants: pre-built, mock, cached, roadmap, offline), BasisChip (measured/derived/modeled/assumed/relative; each links to /methods#basis), ProvenanceButton (opens a popover listing sources), RiskLegend (color + icon/pattern, never color alone).
- Keyboard focus styles on everything; respect prefers-reduced-motion.
- Page /dev/styleguide showing every component and state on both dark and light surfaces.

Do not build nav, footer, or pages. Follow the end-of-task checklist (progress file: docs/progress/07.md).
```

### Prompt 08 — App shell, routes, store

```text
Read CLAUDE.md, docs/progress/06.md–07.md, and prd.md §4.1, §4.2, and the FE-00 card. Branch: fe/FE-00-shell.

Task:
- Global layout: top nav (Home, Sites, Scan, Simulator, Methods, Learn, About), footer with data attributions (NASA POWER, NASADEM, NRCan HRDEM — text only, no logos) and the line "This tool supports, and does not replace, local agronomic expertise."
- A global "mock" badge in the corner when isMock is true.
- Placeholder pages for every route in §4.2 (/, /sites, /scan, /sim/[siteId], /sim/[siteId]/rotations, /sim/[siteId]/trends, /methods, /learn, /about), each using the shell with a title and "coming soon". Dashboard routes use dark surfaces; content pages light.
- "Simulator" nav item goes to /sites if no site is chosen.
- Zustand store skeleton in apps/web/lib/store.ts: currentSiteId, selectedStormId, rotationIds (A/B), layers on/off, verticalExaggeration, playback {frameIndex, playing, speed}, presentationMode. Types only + setters, no logic yet.
- Error boundary, not-found page, loading.tsx skeletons.
- Desktop 1280–1920 px; must not break on mobile.

Follow the end-of-task checklist (progress file: docs/progress/08.md).
```

### Prompt 09 — Explore Sites page

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md the FE-02 card. Branch: fe/FE-02-sites.

Build /sites per FE-02: card grid on the left, MapLibre map of BC on the right with one pin per site (use a free style that needs no API key, e.g. a demotiles or OSM raster style; credit it). Hovering a card highlights its pin and vice-versa. Filters by region and terrain type (flat < 15 m relief, rolling < 60 m, steep otherwise — put thresholds in one constant). Card: preview image (fallback to a gradient if missing), name, region, area, relief, Pre-built badge, storm count, "Open in simulator" → /sim/[id]. Extra card "Scan a new location" → /scan. Loading skeletons, empty state, error card with retry. Fully keyboard usable.

Data only from getSites() in the API client. Follow the end-of-task checklist (progress file: docs/progress/09.md).
```

### Prompt 10 — Data & Methods page

```text
Read CLAUDE.md, docs/progress/08.md, docs/research/data-sources.md if it exists, and prd.md §2.4, §6.7, §8 (external sources table), §13.2 (verification limit), and the FE-08 card. Branch: fe/FE-08-methods.

Build /methods per FE-08:
- Datasets table (name, role, resolution, date range, license, link, attribution). Put the data in apps/web/content/methods.ts. Only use facts from data-sources.md or the PRD; mark anything unconfirmed "to verify".
- Section with id="basis": the measured/derived/modeled/assumed/relative legend with an example of each (BasisChip links land here).
- Plain-language method summaries (terrain, storms, runoff, erosion index, cover classification) with expandable technical detail (accordion).
- Limitations list, each with an id anchor and links to where it matters (/scan, /sim/...).
- If a ?site= query is given, show that site's provenance from getProvenance().
- NASA data acknowledgment, text only.

Follow the end-of-task checklist (progress file: docs/progress/10.md).
```

### Prompt 11 — Landing page (static sections)

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md §1 (pitch), §2.4, and the FE-01 card. Branch: fe/FE-01-landing.

Build / per FE-01, sections 1–7, but for the hero background and the "See the storm" teaser use clearly marked placeholders (a still image or gradient + a <div data-slot="hero-3d"> and <div data-slot="storm-teaser">). Prompt 55 will fill them with the 3D viewer later — make them easy to swap (separate components HeroBackground and StormTeaser).
- Use the copy draft from FE-01. No claims of accuracy or yield.
- CTAs to /sites and /scan. Scroll-triggered reveals with Framer Motion (respect reduced motion).
- "Built on open data" strip: text only, no logos.
- Roadmap teaser links to /about.

Follow the end-of-task checklist (progress file: docs/progress/11.md).
```

### Prompt 12 — Learn page (P1)

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md the FE-09 card. Branch: fe/FE-09-learn.

Build /learn: a card glossary for the 10 terms in FE-09. Content in apps/web/content/glossary.ts: id, term, one-sentence plain definition, a simple inline SVG illustration, and "where you see this in FieldTwin" links. Each card has an anchor (/learn#runoff). Export a <Term id="runoff">runoff</Term> component that shows a tooltip with the definition and links to the entry, for other pages to use. Keep definitions cautious and correct; if unsure about a definition, write it conservatively and flag it in the progress file for review.

Follow the end-of-task checklist (progress file: docs/progress/12.md).
```

### Prompt 13 — About & Roadmap page (P1)

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md §2.6 and the FE-10 card. Branch: fe/FE-10-about.

Build /about per FE-10: problem and motivation; team placeholders; Roadmap timeline (Now / Next / Later) with Roadmap badges; a Capture Studio explainer (simple animated SVG of the drone workflow) labeled "Concept, not available yet"; a contact form that opens a mailto link (no backend). Nothing on this page may look like a working drone feature.

Follow the end-of-task checklist (progress file: docs/progress/13.md).
```

---

## FE-B — 3D Land Viewer

### Prompt 14 — Viewer: terrain mesh, texture, orbit

```text
Read CLAUDE.md, docs/progress/06.md, apps/web/lib/decode/heightmap.ts, and prd.md §6.2 (TerrainPackage, heightmap decoding) and the FE-04 card. Branch: fe/FE-04-viewer-core.

Build apps/web/components/viewer/LandViewer.tsx (react-three-fiber) — the core only:
- Props now: terrainId, verticalExaggeration (default 1.5), className. Leave the other FE-04 props typed but unused (comment "added in Prompt 15–17").
- Load TerrainPackage via getTerrain, decode heightmap.png, build a PlaneGeometry displaced on the CPU (or via a displacement shader) with real meters: X/Y size = grid width/height × cell_size_m, Z = elevation − min_m, scaled by verticalExaggeration.
- Apply normal.png and texture.jpg. Soft directional + hemisphere light, sky, distance fog.
- OrbitControls with sensible limits; "Reset view" function exposed via ref.
- Loading and error states (Skeleton, error card).
- Dev page /dev/viewer with a dropdown for terr_mock_hills / terr_mock_tilted / terr_mock_bowl and an exaggeration slider.

Verify visually on the tilted plane (must look like a flat ramp) and the bowl. Do not add layers, water, or picking. Follow the end-of-task checklist (progress file: docs/progress/14.md).
```

### Prompt 15 — Viewer: analysis layers

```text
Read CLAUDE.md, docs/progress/14.md, the LandViewer component, and prd.md §6.2 (layer PNGs, cover_class values) and the FE-04 card (Layers). Branch: fe/FE-04-viewer-layers.

Add a `layers` prop: { imagery, slope, drainage, depressions, cover, risk } booleans. Implement as one custom shader material (or stacked materials) that blends layer textures over the imagery without reloading assets on toggle. Color ramps: slope (sequential), drainage (water hue, only where flow is high), depressions (water hue by depth), cover (categorical using cover_class indices), risk (amber→red, plus a hatch pattern so it is not color-only). Load the layer catalog via getLayers and render a LayerLegend component from it. Add layer toggles to /dev/viewer.

Follow the end-of-task checklist (progress file: docs/progress/15.md).
```

### Prompt 16 — Viewer: water frames and risk overlay

```text
Read CLAUDE.md, docs/progress/15.md, apps/web/lib/decode/ftw1.ts, and prd.md §6.4 and the FE-04 card (Water overlay). Branch: fe/FE-04-viewer-water.

Add props: waterFrames (decoded FTW1 object), frameIndex (number, may be fractional), riskGridUrl (optional).
- Upload all frames once (e.g. a DataTexture per frame or a 3D/array texture); switching frameIndex must not re-upload. Interpolate between neighbouring frames for smooth scrubbing.
- Render water as a translucent surface just above the terrain, depth → color intensity/opacity; zero depth fully transparent.
- riskGridUrl fills the risk layer from Prompt 15.
- Hook a useSimulationFrames(simId, rotationId) loader in apps/web/lib/hooks/.
- On /dev/viewer: load sim_mock_001 frames for a chosen rotation and add a play/scrub slider.

Follow the end-of-task checklist (progress file: docs/progress/16.md).
```

### Prompt 17 — Viewer: picking, scale bar, camera modes, performance

```text
Read CLAUDE.md, docs/progress/16.md, and the FE-04 card (Camera modes, Picking, Performance). Branch: fe/FE-04-viewer-ux.

Add:
- onPick(point) prop + a small readout: lon/lat, elevation (m), slope (°), cover class, and if frames are loaded water depth (mm) and risk (0–100). Each value shows a BasisChip. Read values from the decoded grids, not from pixels on screen.
- Scale bar and north arrow overlays.
- Camera modes: orbit (default), fly-through (a scripted spline over the terrain bounds), smooth transitions, reset. Expose cameraState + onCameraChange props so two viewers can be synced later (A/B in Prompt 23).
- Expose a helper projectToScreen(lon, lat) for insight pins (Prompt 24).
- Auto quality: if average frame time > 33 ms for 2 s, halve mesh resolution; show a tiny "reduced quality" note. Log fps in dev.

Ground view and instanced crops are P1 — skip them. Follow the end-of-task checklist (progress file: docs/progress/17.md).
```

### Prompt 18 — Viewer: 2D fallback

```text
Read CLAUDE.md, docs/progress/16.md, and the FE-04 card (Fallback). Branch: fe/FE-04-viewer-fallback.

Build LandViewer2D: a canvas view showing the texture, the same layers (from the layer PNGs), and water frames drawn per frameIndex, with the same props as LandViewer. Wrap both in <LandView> that detects WebGL support (and a ?nowebgl=1 query for testing) and picks one. Picking works in 2D as well.

Follow the end-of-task checklist (progress file: docs/progress/18.md).
```

---

## FE-C — Land Scan

### Prompt 19 — Scan wizard steps 1–2

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md §2.6 and the FE-03 card. Branch: fe/FE-03-scan-input.

Build /scan steps 1 and 2 with a visible 3-step progress indicator:
- Capture source tabs: "Photos + location" active; "Drone map (GeoTIFF)" and "Drone video" disabled with a Roadmap badge and one-line explainer each.
- Step 1: drop zone for 1–6 images (jpg/png/webp, size cap shown, inline UNSUPPORTED_FILE / FILE_TOO_LARGE errors), thumbnails with remove. "Use a sample farm" row from getSites() (one click fills photos + location + bbox). If an image has EXIF GPS (use a small lib like exifr), offer to use it.
- Step 2: MapLibre map with click-to-pin, a lat/lon input, and a resizable rectangle (0.25–5 km per side, limits shown). Photo thumbnail beside the map.
- "Start scan" calls startScan() and moves to step 3 (leave step 3 as a placeholder that shows the scan_id — Prompt 20 builds it).
- Sample-farm path must reach step 3 in two clicks.

Follow the end-of-task checklist (progress file: docs/progress/19.md).
```

### Prompt 20 — Scan terraform sequence

```text
Read CLAUDE.md, docs/progress/14.md and 19.md, the LandViewer component, and prd.md §6.5 and the FE-03 card (Step 3, Error handling). Branch: fe/FE-03-terraform.

Build step 3 of /scan: a full-screen sequence driven ONLY by subscribeScanEvents():
- Map each §6.5 stage to a visual step from FE-03 (thumbnails scan → map zoom → contour lines → plane rises into terrain using the real heightmap → cover colors sweep → flow lines draw → camera flies into the simulator → navigate to /sim/[siteId or terrain]).
- Each step plays a minimum duration (~800 ms) but never shows a stage the server did not report.
- On failed: stop at that step, show the error message + hint, buttons "Try a curated site" (/sites) and "Change location" (back to step 2).
- Test both mock streams (success and coverage failure; add a dev toggle).
- Respect reduced motion (cross-fades instead of motion).

Follow the end-of-task checklist (progress file: docs/progress/20.md).
```

---

## FE-D — Simulator and Rotation Lab

### Prompt 21 — Simulator layout and controls

```text
Read CLAUDE.md, docs/progress/08.md and 16.md, apps/web/lib/store.ts, and prd.md the FE-05 card. Branch: fe/FE-05-sim-layout.

Build /sim/[siteId] layout: left rail, center viewer (LandView), right panel (empty tabs Insights / Metrics / Layers for now), bottom bar placeholder.
Left rail: site name + Pre-built badge; Storm picker cards from getStorms (date range, total mm, antecedent wetness, "synthetic timing" tag); three rotation chips from getRotationPresets (existing marked); layer toggles; vertical exaggeration slider; "Run replay" button.
"Run replay" calls runSimulation for the 3 rotations, polls getSimulation, shows per-rotation progress, then loads frames for the selected rotation into the viewer. Cached results show a "cached" chip. Errors: retry; SIMULATION_TIMEOUT suggests a lower grid. All state goes through the Zustand store.

No timeline, HUD, or A/B yet. Follow the end-of-task checklist (progress file: docs/progress/21.md).
```

### Prompt 22 — Timeline, playback, HUD

```text
Read CLAUDE.md, docs/progress/21.md, and the FE-05 card (HUD, Bottom timeline, Interactions). Branch: fe/FE-05-sim-timeline.

Add:
- Bottom timeline: hyetograph bar chart (Recharts) of the storm's hourly mm, a scrubber linked to store.playback.frameIndex (map frame_times to the hyetograph x-axis), play/pause, speed 0.5×–4×, markers where insights have at_time_min.
- Playback loop with requestAnimationFrame driving fractional frameIndex.
- HUD overlay in the viewer: water volume, ponded area, peak depth for the current frame (compute from the decoded frame + cell size; label "modeled" with BasisChip, always units).
- Keyboard: Space play/pause, ←/→ step, (A/B and D are added in Prompt 23).

Follow the end-of-task checklist (progress file: docs/progress/22.md).
```

### Prompt 23 — A/B split and difference overlay

```text
Read CLAUDE.md, docs/progress/17.md and 22.md, and the FE-05 card (A/B mode, Difference). Branch: fe/FE-05-sim-ab.

Add A/B mode: two synchronized LandViews side by side (shared camera via cameraState/onCameraChange, shared frameIndex), each with its own rotation selector. Key B toggles A/B, key A swaps sides, key D toggles a Difference overlay (compute per-cell depth difference A−B in the browser from the two frame sets, or call getDiff in live mode) with a legend that is not color-only. Switching a cached rotation updates in about a second. Keep ≥30 fps target; reuse the auto-quality from Prompt 17.

Follow the end-of-task checklist (progress file: docs/progress/23.md).
```

### Prompt 24 — Insight pins and pop-ups

```text
Read CLAUDE.md, docs/progress/17.md and 22.md, and prd.md §6.2 (Insight) and the FE-07 card. Branch: fe/FE-07-insights.

Build insight pins: load getInsights(terrainId) and the insights in getEvidence(simId). Show numbered pins positioned with projectToScreen(lon, lat) that follow the camera. A pop-up card shows title, body, "Why it matters", "Try this" tip, confidence chip, and a "see data" link that turns on the referenced layer. Only one pop-up open at a time; Escape closes it. During playback, insights with at_time_min auto-open when the timeline passes that time (at most one). Respect the FE-07 content rules (no absolute claims shown without a "verify locally" cue).

Follow the end-of-task checklist (progress file: docs/progress/24.md).
```

### Prompt 25 — Right panel tabs

```text
Read CLAUDE.md, docs/progress/24.md, and the FE-07 card (Tips panel) and FE-05 (Right panel). Branch: fe/FE-07-panel.

Fill the simulator right panel:
- Insights tab: "Tips for this field" list sorted by severity, grouped Land / Storms / Rotations / Data quality; clicking one flies the camera to its anchor and opens its pop-up.
- Metrics tab: table of the 3 rotations' Metrics (units + basis chips), best value highlighted with icon not only color, link "Open Rotation Lab".
- Layers tab: layer toggles + legends (reuse LayerLegend).

Follow the end-of-task checklist (progress file: docs/progress/25.md).
```

### Prompt 26 — Rotation Lab core

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md §6.2 (Rotation, EvidenceCard, Metrics) and the FE-06 card. Branch: fe/FE-06-rotation-lab.

Build /sim/[siteId]/rotations: three columns (existing first, marked). Each: name; cover calendar strip (months × years, colored by cover fraction, bare periods hatched); key metrics with units and basis chips; evidence card with the five labeled sections (Why suggested, Supporting evidence, Benefits, Information gaps, Risks needing local review). Below: a comparison table using the same numbers. A persistent banner "This tool supports, and does not replace, local agronomic expertise." "Open replay" → /sim/[siteId]?rotation=<id> (make the simulator read that param). Cards expand to show assumptions.

Data from getRotationPresets, getCrops, getEvidence (use the latest sim id for the site from the store, or run sim if none). Follow the end-of-task checklist (progress file: docs/progress/26.md).
```

### Prompt 27 — Rotation Lab crop swap and sliders (P1)

```text
Read CLAUDE.md, docs/progress/26.md, and the FE-06 card (Interactions). Branch: fe/FE-06-rotation-edit.

Add: a crop dropdown per year in each alternative rotation (not the existing one) that calls validateRotation, shows warnings inline, and on confirm re-runs runSimulation for that rotation. Priority sliders (water conservation, erosion control, soil cover, income suitability) that re-rank the alternative columns using a transparent weighted score shown in a tooltip. Income suitability has no data yet — show it as "assumed / not modeled" and keep its weight at 0 by default.

Follow the end-of-task checklist (progress file: docs/progress/27.md).
```

### Prompt 28 — Trends view (P1)

```text
Read CLAUDE.md, docs/progress/08.md, and prd.md the FE-11 card and BE-06 card (Trends). Branch: fe/FE-11-trends.

Build /sim/[siteId]/trends with Recharts: annual precipitation, heavy-rain days, temperature, root-zone soil wetness (1981–present) with trend line and uncertainty band, units and "NASA POWER" source under each chart plus a one-line plain summary from the API. State the ~55 km resolution limit near the charts. Climate-shift sliders (rainfall intensity ±%, longer dry spells) update a "what changes" preview client-side; label it "illustrative". Data from getWeatherSummary.

Follow the end-of-task checklist (progress file: docs/progress/28.md).
```

---

## BE-A — Terrain

### Prompt 29 — Terrain interface, grid utils, PrecomputedSource

```text
Read CLAUDE.md, docs/progress/05.md, and prd.md §6.1 (CRS), §6.2 (TerrainPackage) and the BE-01 card. Branch: be/BE-01-terrain-core.

In services/api/app/terrain/:
- ElevationGrid dataclass (array float32, transform, crs, cell_size_m, nodata mask, metadata: source, native_resolution_m, model DTM|DSM, vertical_datum, license, attribution).
- TerrainSource protocol: fetch(bbox_wgs84, target_cell_m) -> ElevationGrid.
- grid utils: bbox → local UTM EPSG; choose grid so the longer side ≤ 512 cells; reproject/resample with rasterio; fill small nodata gaps (interpolation), mask big ones, compute nodata_fraction; min/max.
- PrecomputedSource reading a GeoTIFF from data/seed/<site>/elevation.tif.
- A content hash function for (bbox, cell size, source version) for caching.
- pytest: UTM zone selection for Vancouver/Okanagan, grid size cap, gap fill, determinism.

No network sources yet. Follow the end-of-task checklist (progress file: docs/progress/29.md).
```

### Prompt 30 — HRDEM adapter

```text
Read CLAUDE.md, docs/progress/29.md, docs/research/data-sources.md (from R1), and the BE-01 card. Branch: be/BE-01-hrdem.

FIRST: confirm from data-sources.md (or the official docs, cited) the exact access method for NRCan HRDEM. If it is not confirmed, STOP and tell me what is missing — do not guess URLs.

Then implement HrdemSource: find intersecting tiles (STAC search or index), read only the needed window from the COG with rasterio (windowed read over HTTP), prefer DTM, reproject to the local UTM grid, cache raw windows under data/cache/hrdem/. Timeouts + retries with backoff via httpx. Partial coverage → raise TERRAIN_COVERAGE_MISSING (never return a patched terrain). Record source, license, attribution, native resolution, vertical datum.
Tests: unit tests with a mocked STAC response; one opt-in network test (pytest -m network) for one curated bbox that checks the elevation range is plausible.

Follow the end-of-task checklist (progress file: docs/progress/30.md).
```

### Prompt 31 — NASADEM fallback and chain

```text
Read CLAUDE.md, docs/progress/29.md, docs/research/data-sources.md, and the BE-01 card. Branch: be/BE-01-nasadem.

FIRST confirm the NASADEM download method from data-sources.md or cited official docs; STOP and ask if unclear.
Implement NasaDemSource using EARTHDATA_USERNAME/PASSWORD from env (never hard-coded), caching tiles under data/cache/nasadem/, adding quality flag coarse_elevation. Implement get_terrain_source_chain(): OFFLINE → Precomputed only; else HRDEM → NASADEM → TERRAIN_COVERAGE_MISSING with hint "Try a site in southern BC or use a curated site." Tests with mocks for each branch of the chain.

Follow the end-of-task checklist (progress file: docs/progress/31.md).
```

### Prompt 32 — Terrain analysis

```text
Read CLAUDE.md, docs/progress/29.md, and prd.md the BE-04 card. Branch: be/BE-04-analysis.

In services/api/app/analysis/: slope and aspect; D8 flow direction; flow accumulation; drainage network (threshold as a named constant); depressions via priority-flood fill returning ponding depth per cell; summary stats (steepest 10% slope, largest low spot area+depth+centroid lon/lat, drainage density, main drainage line coordinates). Handle nodata. Vectorize with NumPy; use Numba only if a loop is too slow (measure first). Cite the algorithm source (e.g. Barnes et al. priority-flood) in a comment.
Tests on synthetic grids: tilted plane (one flow direction, accumulation grows downhill), bowl (one depression, known depth ±1 cm), ridge-valley (accumulation peaks in the valley). Run on the mock hills fixture and save outputs to a temp dir for a visual check.

Follow the end-of-task checklist (progress file: docs/progress/32.md).
```

### Prompt 33 — Rendering packaging

```text
Read CLAUDE.md, docs/progress/29.md and 32.md, packages/contracts/README.md, and prd.md §6.2, §6.4 and the BE-10 card. Branch: be/BE-10-packaging.

In services/api/app/packaging/: write a TerrainPackage folder data/packages/<terrain_id>/ containing heightmap.png (16-bit, §6.2 formula), normal.png, texture.jpg (passed in), layers/*.png (8-bit, encodings from the contract), layers.json legends, terrain.json. Reuse packages/contracts/fixtures_lib/ftw1.py for frames (expose write_frames()). Enforce size budgets (warn/log). Update the terrain router service to serve real packages from data/packages/ first, fixtures second, with immutable cache headers.
Tests: round-trip heightmap within 1 cm; packaged mock hills validates against the TerrainPackage schema; FE decode test fixture compatibility (decode with the same formula in Python).

Follow the end-of-task checklist (progress file: docs/progress/33.md).
```

---

## BE-B — Imagery and cover

### Prompt 34 — Upload validation and storage

```text
Read CLAUDE.md, docs/progress/05.md, and prd.md the BE-02 card and NFR-08, NFR-09 (§13.1). Branch: be/BE-02-uploads.

In services/api/app/imagery/uploads.py: validate images by content (Pillow open + verify), allowed formats jpg/png/webp, size cap and pixel-dimension cap as config constants, max 6 files. Read EXIF GPS and orientation first, return them, then save a stripped copy (no EXIF) under data/uploads/<sha256>.jpg. Errors UNSUPPORTED_FILE / FILE_TOO_LARGE / INVALID_INPUT in the §6.6 format. Tests: good jpg, png renamed as .jpg, text file named .jpg, oversized file, EXIF stripped.

Follow the end-of-task checklist (progress file: docs/progress/34.md).
```

### Prompt 35 — Image placement and fallback texture

```text
Read CLAUDE.md, docs/progress/34.md, docs/research/data-sources.md, and the BE-02 card (Behavior 2–4). Branch: be/BE-02-placement.

Implement build_texture(bbox, uploads, site_seed=None):
- Curated site: use pre-aligned bounds from the seed config.
- Arbitrary upload: stretch the first image to the bbox, add quality flag texture_alignment_assumed.
- No usable upload: fallback texture from the open imagery source confirmed in data-sources.md (GIBS WMTS or other). If none is confirmed, STOP and ask. Add flag low_resolution_texture.
- Output texture.jpg ≤ 2048², plus bounds_wgs84, source, resolution estimate, license, attribution.
Tests with mocked imagery responses.

Follow the end-of-task checklist (progress file: docs/progress/35.md).
```

### Prompt 36 — Cover classification

```text
Read CLAUDE.md, docs/progress/35.md, and prd.md §6.2 (cover_class values) and the BE-05 card. Branch: be/BE-05-cover.

In services/api/app/cover/: excess-green index for RGB (NDVI if a NIR band exists), Otsu threshold, simple water detection (document the rule), morphological clean-up, classes 0 other / 1 vegetation / 2 bare / 3 water / 255 nodata. Output cover_class array, class percentages (sum to 100), persistent_bare mask (bare clusters ≥ min area constant), confidence from class separation, and a low_confidence flag. Document the limits from BE-05 in a module docstring.
Tests: synthetic green/brown/blue image classified correctly; percentages sum to 100; deterministic.

Follow the end-of-task checklist (progress file: docs/progress/36.md).
```

---

## BE-C — Weather

### Prompt 37 — NASA POWER client and cache

```text
Read CLAUDE.md, docs/progress/05.md, docs/research/data-sources.md, and prd.md the BE-06 card and NFR-08. Branch: be/BE-06-power-client.

FIRST confirm the POWER daily point endpoint and parameter names from data-sources.md or the official docs (https://power.larc.nasa.gov/docs/services/api/), and cite them in a comment. If anything is unclear, STOP and ask.
Implement services/api/app/weather/power.py: fetch daily 1981-01-01..latest for a lat/lon (site centroid only) for precipitation, T2M, T2M_MAX, T2M_MIN, surface and root-zone soil wetness; split requests if limits require; cache raw JSON at data/cache/power/<lat>_<lon>.json (round to 3 dp); on network error use cache and set cached=True; no cache + no network → WEATHER_UNAVAILABLE; OFFLINE=1 never calls the network. Return a pandas DataFrame (or NumPy arrays) with a fill-value mask.
Tests with a recorded small fixture response; one opt-in network test.

Follow the end-of-task checklist (progress file: docs/progress/37.md).
```

### Prompt 38 — Storm ranking and hyetograph

```text
Read CLAUDE.md, docs/progress/37.md, and prd.md §6.2 (Storm) and the BE-06 card (Rank storms, Hyetograph). Branch: be/BE-06-storms.

Implement rank_storms(df, n=3): 1/2/3-day rolling rainfall; top-N distinct events separated ≥ 7 days; total, peak day, antecedent wetness (mean root-zone wetness over prior 5 days). Hyetograph: spread daily totals hourly with an SCS Type IA style profile — look up and cite the dimensionless table (TODO(verify) if no source found), flag synthetic: true. Wire GET /weather/storms?terrain_id to it (resolve terrain → centroid), keeping the fixture fallback for mock terrain ids.
Tests: fixture series with known planted events ranks them correctly; separation rule; hyetograph sums to the daily total.

Follow the end-of-task checklist (progress file: docs/progress/38.md).
```

### Prompt 39 — Trends and weather summary

```text
Read CLAUDE.md, docs/progress/37.md, and the BE-06 card (Trends) and FE-11 card. Branch: be/BE-06-trends.

Implement weather summary: annual and seasonal series for precipitation, heavy-rain days (threshold constant), mean temperature, root-zone wetness; Theil–Sen slope with confidence interval (scipy.stats.theilslopes); one plain-language summary sentence per series with cautious wording and the ~55 km resolution caveat. Wire GET /weather/summary?lat&lon. Response must validate against the contract schema.
Tests: synthetic linear series gives the right slope; summary strings never claim certainty.

Follow the end-of-task checklist (progress file: docs/progress/39.md).
```

---

## BE-D — Crops and rotations

### Prompt 40 — Crop library, presets, cover calendar

```text
Read CLAUDE.md, docs/progress/05.md, and prd.md §6.2 (CropTemplate, Rotation) and the BE-07 card. Branch: be/BE-07-crops.

Create data/crops.yaml with the 8 BE-07 crops: family, n_fixing, season_window (plant/terminate day of year), cover_curve, notes, source. Use web search for public agronomy references (e.g. BC Ministry of Agriculture, provincial/university extension) and cite URLs in `source`; any value you cannot source gets source: "to_verify". Do not invent citations.
Implement services/api/app/rotations/: load crops; preset rotations (an existing one per site from config, plus two rule-based alternatives: add overwintering cereal rye; add a perennial forage phase), always exactly 3; cover calendar (monthly cover fraction + bare days per year). Wire GET /crops and GET /rotations/presets.
Tests: always 3 rotations with one is_existing; bare-days matches two hand-computed examples (write the hand calc in the test docstring).

Follow the end-of-task checklist (progress file: docs/progress/40.md).
```

### Prompt 41 — Rotation validation

```text
Read CLAUDE.md, docs/progress/40.md, and the BE-07 card (Validation rules). Branch: be/BE-07-validate.

Implement POST /rotations/validate: warnings for same-family crops in consecutive years and for crops outside the location's season window (use latitude-based simple rule, document it as assumed). Return {valid, warnings[]} per contract. Tests for each warning type and a clean rotation.

Follow the end-of-task checklist (progress file: docs/progress/41.md).
```

---

## BE-E — Simulation and insights

### Prompt 42 — Simulation: SCS runoff

```text
Read CLAUDE.md, docs/progress/05.md, and prd.md the BE-08 card (Inputs, Method 1, tests). Branch: be/BE-08-runoff.

In services/api/app/sim/runoff.py: SCS Curve Number runoff exactly as in BE-08 (S = 25400/CN − 254 mm, Ia = 0.2·S, Q formula). Curve-number table in data/curve_numbers.yaml by cover class × crop stage × soil group (A–D) — look up and cite a USDA NRCS TR-55 / NEH Part 630 source; mark unsourced values TODO(verify). Antecedent moisture adjustment (dry/normal/wet thresholds on POWER wetness as documented assumptions; cite the AMC conversion formula). Function works per cell on NumPy arrays, cumulative over the hyetograph to get incremental runoff per time step.
Tests: zero runoff below Ia; non-decreasing in rainfall; higher cover → lower CN → never more runoff; deterministic.

Use synthetic inputs only; no other modules required. Follow the end-of-task checklist (progress file: docs/progress/42.md).
```

### Prompt 43 — Simulation: routing and ponding

```text
Read CLAUDE.md, docs/progress/42.md, the analysis module from Prompt 32 if merged (else use simple D8 on synthetic grids), and the BE-08 card (Method 2, mass balance test). Branch: be/BE-08-routing.

In services/api/app/sim/routing.py: time-stepped transfer of surface water along D8 with a slope-dependent fraction per step, depressions store ponded water with slow infiltration, edge cells outflow. Track a mass ledger (rain excess in, infiltration, outflow, storage). This is a visualization-oriented approximation — say so in the docstring. Record depth snapshots for later frame sampling.
Tests: mass conserved within 0.1%; water ends up in the bowl fixture's depression; tilted plane drains off the low edge; deterministic. Time a 256×256 run and report it.

Follow the end-of-task checklist (progress file: docs/progress/43.md).
```

### Prompt 44 — Simulation: erosion index and metrics

```text
Read CLAUDE.md, docs/progress/43.md, and prd.md §6.2 (Metrics) and the BE-08 card (Method 3–4). Branch: be/BE-08-erosion.

In services/api/app/sim/erosion.py: relative erosion index = rainfall intensity factor × constant soil factor × topographic factor (slope + upslope area; cite the LS formula you use) × cover factor from the rotation's cover on the storm date; persistent-bare cells keep reduced cover in all rotations; non-field cells masked. Normalize to 0–100 relative using a fixed reference (not per-run min/max, so rotations stay comparable). Compute Metrics per §6.2 (runoff_volume_m3, runoff_depth_mm_mean, ponded_area_ha, ponded_peak_depth_cm, erosion_index_mean, erosion_high_share_pct, bare_days_per_year, basis).
Tests: more cover never increases the index; non-decreasing in rainfall; metrics validate against the schema.

Follow the end-of-task checklist (progress file: docs/progress/44.md).
```

### Prompt 45 — Simulation: frames, job API, caching

```text
Read CLAUDE.md, docs/progress/33.md and 44.md, and prd.md §6.2 (SimulationRequest/Status), §6.4, and the BE-08 card (Frames, Caching, Failure). Branch: be/BE-08-sim-api.

Implement services/api/app/sim/run.py: run(terrain, storm, rotations, options) → per-rotation frames (~60, sampled from routing snapshots, encoded with write_frames), risk PNG, metrics. Job runner: in-process thread pool, small concurrency limit; cache by hash of (terrain_id, storm_id, rotation_id, options) under data/sims/; deterministic sim ids from the hash; per-run timeout → SIMULATION_TIMEOUT with hint; never mark partial results done; if over the time budget, retry at a lower grid with a flag. Wire POST /simulations, GET /simulations/{id}, frames, risk, and /diff (PNG + stats). Keep fixture responses for mock ids.
Tests: end-to-end on mock hills for 3 rotations; second call returns cached; frames decode with read_ftw1; timing printed.

Follow the end-of-task checklist (progress file: docs/progress/45.md).
```

### Prompt 46 — Insight rule engine

```text
Read CLAUDE.md, docs/progress/32.md, 36.md, 45.md, and prd.md §6.2 (Insight) and the BE-09 card. Branch: be/BE-09-insights.

In services/api/app/insights/: a rule engine of templates with thresholds (thresholds in data/insight_rules.yaml), each rule producing an Insight with anchor lon/lat (and at_time_min for storm rules), confidence, data_refs, severity. Rules: terrain (largest low spot, steepest section, strongest drainage line), cover (% bare, persistent patches, low confidence), storm (first water at main low spot, peak ponding time, biggest rotation difference), data quality (coarse elevation, assumed alignment, assumed soil group, coarse weather). No LLM. Wire GET /terrain/{id}/insights and the insights part of /simulations/{id}/evidence.
Tests: every insight has anchor, confidence, data_refs; rules fire on the mock hills run.

Follow the end-of-task checklist (progress file: docs/progress/46.md).
```

### Prompt 47 — Tips library and evidence cards

```text
Read CLAUDE.md, docs/progress/46.md, and prd.md §6.2 (EvidenceCard) and the BE-09 card (Tips library, Evidence cards). Branch: be/BE-09-evidence.

Create data/tips.yaml: plain-language tips keyed by condition, each with basis and verify_locally. Wording must be conditional ("consider", "may", "ask a local agronomist"); no guarantees, no financial or medical claims. Implement evidence card generation for each rotation: why_suggested, evidence (numbers pulled directly from metrics — format them, never recompute), benefits, information_gaps, risks_for_local_review, support_not_replace text. Wire GET /simulations/{id}/evidence.
Tests: every number in a card string matches a metric value; all 3 cards have all 5 sections non-empty; a banned-words test fails on "guarantee", "will increase yield", etc.

List every tip in the progress file so a human can review the wording. Follow the end-of-task checklist (progress file: docs/progress/47.md).
```

---

## BE-F — Orchestration and tests

### Prompt 48 — Scan orchestration and SSE

```text
Read CLAUDE.md, docs/progress/05.md and any of 29–39 that exist, and prd.md §6.5 and the BE-03 card. Branch: be/BE-03-orchestration.

Implement services/api/app/scans/: POST /scans validates input (via the uploads module if merged), creates a job, returns scan_id at once. Stages run in §6.5 order, each calling the real module if it exists or a clearly-named stub that returns fixture data (log "STUB" loudly). Emit progress events at stage boundaries over SSE; final ready includes terrain_id; failures emit failed with a §6.5/§6.6 error. Cache by hash(bbox, grid size, source versions, image hashes); resubmission returns the existing job. Per-stage timeouts; small concurrency limit; OFFLINE=1 allows only curated sites.
Tests: events arrive in order; repeat scan returns from cache < 1 s; injected failure at each stage ends with failed. Check SSE through the Next.js dev proxy if apps/web exists (document how).

List which stages are still stubs in the progress file. Follow the end-of-task checklist (progress file: docs/progress/48.md).
```

### Prompt 49 — Contract tests and smoke script

```text
Read CLAUDE.md, docs/progress/05.md, packages/contracts/openapi.yaml, and prd.md the BE-12 card and §13.2. Branch: be/BE-12-tests.

Add: contract tests that call every endpoint on a running test app and validate responses against openapi.yaml (schemathesis or openapi-core); scripts/smoke.py that runs the API journey (health → sites → scan a curated site → storms → simulate 3 rotations → evidence) and prints a pass/fail table with timings; scripts/bench.py for scan + sim timing; failure-injection tests (network off, bad upload, missing tile) using monkeypatch. Add `make smoke` and `make bench`.

Follow the end-of-task checklist (progress file: docs/progress/49.md).
```

---

## Phase I — Integration and demo

### Prompt 50 — sites.yaml and seed script

```text
Read CLAUDE.md, docs/research/data-sources.md, all docs/progress/*.md for BE prompts, and prd.md the BE-11 card. Branch: be/BE-11-seed.

Create data/sites.yaml for the three chosen sites (from R1's recommendation — ask me to confirm the list before writing). Fields: id, name, region, bbox, summary, image files + bounds, license, attribution, existing rotation, storm count. Implement `make seed` (scripts/seed.py): for each site build terrain package → texture → cover → analysis → weather cache → top 3 storms → 3 rotations → all simulations → evidence, writing everything under data/seed/ and data/packages/. Idempotent and reproducible. Print sizes per site and total. Make /sites serve sites.yaml-backed data instead of fixtures (fixtures still used in mock mode on the front-end).

Do not commit imagery whose license forbids redistribution; if unsure, ask. Follow the end-of-task checklist (progress file: docs/progress/50.md).
```

### Prompt 51 — Offline mode and seed verifier

```text
Read CLAUDE.md, docs/progress/50.md, and prd.md §6.7 (offline), the BE-11 card, and §11.4. Branch: be/BE-11-offline.

Enforce OFFLINE=1: a single guard in the HTTP layer that raises if any external call is attempted; all services read seed data only. scripts/verify_seed.py loads every seed asset, decodes heightmaps and frames, validates JSON against the contract, and fails loudly on anything missing. Add `make verify-seed`. Run `make smoke` with OFFLINE=1 and network disabled (or a blocked HTTP transport) and show it passes. Document how to ship seed data (repo vs release asset) in README.

Follow the end-of-task checklist (progress file: docs/progress/51.md).
```

### Prompt 52 — Mock→live: Sites, Methods, Trends

```text
Read CLAUDE.md, docs/progress/09.md, 10.md, 28.md (if done), 51.md, and prd.md §9.2. Branch: fe/INT-pages-live.

Run the API (`make dev`, OFFLINE=1) and the web app with NEXT_PUBLIC_API_MODE=live. For /sites, /methods (with ?site=), and /sim/[siteId]/trends: compare live vs mock behaviour, fix whichever side breaks the contract (smallest change; if the contract itself is wrong, STOP and tell me), make sure no "mock" badge or mock text appears in live mode. Record a short mock-vs-live table in the progress file.

Follow the end-of-task checklist (progress file: docs/progress/52.md).
```

### Prompt 53 — Mock→live: Land Scan

```text
Read CLAUDE.md, docs/progress/20.md, 48.md, 51.md, and prd.md §9.2 and the FE-03 acceptance criteria. Branch: fe/INT-scan-live.

Swap /scan to live against the local API. Verify: sample-farm scan for each curated site runs every real stage and ends in the simulator; SSE works through the dev proxy; coverage failure shows the right recovery (test a bbox outside coverage with OFFLINE=0, or the offline curated-only error with OFFLINE=1). Fix mismatches per §9.2. Report any stage that is still a stub.

Follow the end-of-task checklist (progress file: docs/progress/53.md).
```

### Prompt 54 — Mock→live: Simulator and Rotation Lab

```text
Read CLAUDE.md, docs/progress/23.md, 25.md, 26.md, 45.md, 47.md, 51.md, and the FE-05, FE-06, FE-07 acceptance criteria. Branch: fe/INT-sim-live.

Swap /sim/[siteId] and /sim/[siteId]/rotations to live for every curated site and at least two storms. Check: frames decode, A/B sync, difference overlay, HUD numbers with units and basis, insight pins at the right places and times, evidence numbers equal table numbers, cached chip shows on the second run, rotations visibly differ for at least two storms (if not, report it — that is a BE-08 tuning issue, do not fake it). Fix mismatches per §9.2.

Follow the end-of-task checklist (progress file: docs/progress/54.md).
```

### Prompt 55 — Landing hero 3D and storm teaser

```text
Read CLAUDE.md, docs/progress/11.md, 16.md, 17.md, and the FE-01 card. Branch: fe/FE-01-hero.

Replace the HeroBackground placeholder with a looping LandViewer scene of a curated site: flat plane rises into terrain, imagery fades in, water flows (reuse real seed frames), slow orbit, no controls. Replace StormTeaser with a mini A/B comparison (two rotations, swipe handle, play/pause) labeled "Pre-built example". WebGL off → still image. Measure LCP on the landing page and report it (target < ~3 s).

Follow the end-of-task checklist (progress file: docs/progress/55.md).
```

### Prompt 56 — Guided demo tour

```text
Read CLAUDE.md, docs/progress/52.md–55.md, and prd.md §11.1–11.2 and the FE-12 card (Guided tour, Rules). Branch: fe/FE-12-tour.

Build a guided tour (toggle with T) that drives the real UI through: landing → sample photos → pin → terraform → simulator → pick storm → A/B replay → insight pop-up → Rotation Lab → Methods. Steps defined in one config file (selector/route, action, caption, min duration). Arrow keys advance/back, Esc exits. Only real features on pre-built data; pre-built content stays labeled. Must finish in < 90 s per site; add a site picker to start the tour on any curated site.

Follow the end-of-task checklist (progress file: docs/progress/56.md).
```

### Prompt 57 — Presentation mode and reset

```text
Read CLAUDE.md, docs/progress/56.md, and the FE-12 card (Presentation mode). Branch: fe/FE-12-present.

Add presentation mode (toggle P, persisted in the store): hide dev tooling and dev badges, larger type scale, cursor highlight, network indicator (live / cached / offline from /health). Add a one-key reset (Shift+R) that clears local state, browser caches used by the app, and returns to / with the tour ready. Verify the full tour with the network disabled and OFFLINE=1, three times in a row from reset.

Follow the end-of-task checklist (progress file: docs/progress/57.md).
```

### Prompt 58 — Yield-stress index (P1)

```text
Read CLAUDE.md, docs/progress/39.md and 40.md, and prd.md the BE-14 card. Branch: be/BE-14-stress.

Implement a daily soil-water bucket per rotation-year using Hargreaves reference ET (temperature + latitude; cite the formula), crop coefficients by stage from data/crops.yaml (add fields with sources or TODO(verify)), → 0–1 relative water-stress index at sensitive stages and a dry-year exposure count 1981–present. Expose it in evidence cards and the weather summary, always labeled "relative index, not a yield forecast". Test: a rotation with better-timed water use scores lower stress.

Follow the end-of-task checklist (progress file: docs/progress/58.md).
```

### Prompt 59 — Drone map upload adapter (P2)

```text
Read CLAUDE.md, docs/progress/29.md and 33.md, and prd.md §2.6 and the BE-13 card. Branch: be/BE-13-drone-upload.

Implement capture adapter A3 only: accept an orthophoto GeoTIFF + elevation GeoTIFF, validate CRS and overlapping extent, resample into a TerrainPackage via the existing packaging code. Add it behind a feature flag; the front-end tab stays "Roadmap" unless the team decides otherwise. Test with a small synthetic GeoTIFF pair. Do not implement A4 or A5.

Follow the end-of-task checklist (progress file: docs/progress/59.md).
```

### Prompt 60 — Field notes (P2)

```text
Read CLAUDE.md, docs/progress/24.md, and the FE-07 card (Field notes). Branch: fe/FE-07-notes.

Add note pins: click "Add note" then a spot on the terrain, write text, reply in a thread. Store in localStorage keyed by terrain id (wrap all storage access in try/catch). "Copy share link" encodes camera view + note ids in the URL. Notes persist across reloads.

Follow the end-of-task checklist (progress file: docs/progress/60.md).
```

### Prompt 61 — QA, accessibility, E2E

```text
Read CLAUDE.md, all docs/progress/*.md, and prd.md the FE-13 card, §13.1 NFRs, and §16. Branch: fe/FE-13-qa.

1. Write a Playwright E2E test for the primary journey on each curated site (open site, run storm for 3 rotations, A/B, Rotation Lab, Methods) against the live API in offline mode.
2. Run the FE-13 checks at 1920×1080 and 1440×900: keyboard nav, focus, non-color-only encoding, contrast (axe), loading/empty/error/offline states per page, ?nowebgl=1 fallback, viewer frame times, links and attributions.
3. Write docs/qa-checklist.md: pass/fail per page and per NFR.
4. Fix P0 failures that are small and local. For anything bigger, list it with file:line and stop — do not start large refactors.

Follow the end-of-task checklist (progress file: docs/progress/61.md).
```

### Prompt 62 — Submission pack and README

```text
Read CLAUDE.md, docs/research/data-sources.md, docs/qa-checklist.md, and prd.md §2.4, §3 (submission logistics), §11, §16. Do not change app code. Branch: docs/submission.

Write:
- docs/submission/project-page.md: summary, how NASA data is used (POWER, NASADEM, GIBS if used), other data with licenses, AI tools used (disclose Claude Code), Pre-built vs Live statement, limitations, roadmap.
- docs/submission/demo-script.md: the 30-second video shot list from §11.1 and the live pitch outline from §11.2, adjusted to what actually works now (check the progress files; never script a feature that is not done).
- README.md: final setup from a clean checkout (install, seed, offline demo, tests), and the §16 checklist with each item marked done / not done based on evidence in the repo.
Flag anything that needs the 2026 judging guide re-check.

Follow the end-of-task checklist (progress file: docs/progress/62.md).
```
