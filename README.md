# Stardew Earth

> Play the next ten years of your farm before you live them.

Stardew Earth turns a real farm into a **digital twin** you can explore in 3D and 2D, replays real NASA weather over it, and compares **three crop rotations** (the farm's current one plus two alternatives) with the evidence, risks and gaps behind each. Built for the **NASA Space Apps Challenge 2026 (Vancouver)**, challenge **"Field Shift: Adapting Farms with NASA Data"**.

```
 2026 ──●───────────────────────────────────────────● 2035
        ▲ drag the timeline: rain, heat, soil and erosion change on the fields
```

The demo covers two farms: **UBC Farm** (Vancouver) and **KPU Langley** (Langley, BC). Three older curated sites (USDA Beltsville, Cornell, UC Davis Oakville) remain as explore-only pins.

> This tool supports, and does not replace, local agronomic expertise. Outputs are **scenario forecasts**, not predictions of harvest or soil loss.

---

## Contents

1. [Run it locally](#run-it-locally)
2. [What it does](#what-it-does)
3. [Data we have](#data-we-have)
4. [Tech stack](#tech-stack)
5. [How the code is organised](#how-the-code-is-organised)
6. [How a forecast works](#how-a-forecast-works)
7. [Key decisions](#key-decisions)
8. [Workflow](#workflow)
9. [Testing](#testing)
10. [Configuration](#configuration)
11. [Deployment](#deployment)
12. [Docs map](#docs-map)

---

## Run it locally

You need **Node 22+** with **pnpm**, **Python 3.12+** and **[uv](https://docs.astral.sh/uv/)**.

### 1. Install

```sh
cd apps/web && pnpm install --frozen-lockfile     # front-end
cd ../../services/api && uv sync                  # back-end
cd ../.. && cp .env.example .env                  # optional: fill in keys (see Configuration)
```

### 2. Start the API (terminal 1)

```sh
make dev                  # FastAPI on http://localhost:8000, docs at /api/v1/docs
OFFLINE=1 make dev        # seed data only, no external calls
```

### 3. Start the website (terminal 2)

```sh
cd apps/web
pnpm dev                  # http://localhost:3000
```

`pnpm dev` first syncs fixtures, MapLibre and Cesium assets and fetches fonts, then starts Next.js with Turbopack.

Open **http://localhost:3000**, pick a farm on the globe (try **UBC Farm**: `http://localhost:3000/#farm=ubc-farm`), then switch the farm view to **Future**.

### API modes

| Mode | Set with | What you get |
| --- | --- | --- |
| **live** (default) | `NEXT_PUBLIC_API_MODE=live`, `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000/api/v1`) | The web app calls the real API. Forecasts are recomputed when you change a scenario. |
| **mock** | `NEXT_PUBLIC_API_MODE=mock` | Static fixtures from `packages/contracts/fixtures/`, no API needed. Mock data is labelled and must never reach the demo. |
| **offline API** | `OFFLINE=1` on the API | Serves `data/seed/` only. No NASA, SoilGrids or Groq calls. |

No API key is needed to explore. **Ask Gus** (the farm assistant) needs a `GROQ_API_KEY`, and live satellite ingestion needs Earthdata credentials.

---

## What it does

- **Globe and farm dive.** Pick a farm on a 3D globe and dive into it.
- **Digital twin.** Explore the farm in 3D (Cesium + three.js) or switch to a 2D aerial map (MapLibre) with per-field colouring.
- **Ten-year forecast.** The **Future** mode timeline runs 2026 to 2035, with a 10 yr / 1 yr zoom. A "what-if" panel shifts rain and temperature.
- **Next 12 months.** A month-by-month outlook with p10 to p90 ranges that widen with distance. It starts from a typical year built from 34 years of weather, with an optional seasonal-forecast overlay.
- **Crop rotation comparison.** The current rotation versus two alternatives built from the farmer's own crop pool, scored on soil organic matter, infiltration, erosion, irrigation need, nitrogen and pest pressure. Each shows why, evidence, benefits, gaps and risks.
- **Rotation planner.** Edit a rotation or build your own from a crop catalog (49 crops with traits and planting windows).
- **Ask Gus.** A farm assistant that answers from the current forecast context. It never changes forecast numbers.
- **Custom field (2D only).** Draw a field in the 2D view and analyse it with live NASA POWER and SoilGrids lookups.
- **Window system.** Every farm-screen panel is a draggable, resizable window with a dock and a layout that is remembered per browser. See [`DOCUMENTATION.md`](DOCUMENTATION.md).
- **Methods and data page.** Every dataset with source, licence and attribution, the climate source and scenario, and the modelling assumptions in plain words (`/methods`).
- **Learn page.** Plain-language explainers for evapotranspiration, soil moisture, NDVI, frost risk, runoff, erosion, ponding and more (`/learn`).
- **Guided tour and presenter mode.** For the demo.

Drone and video capture appear only as **Roadmap** items and are never shown working.

---

## Data we have

All seed data lives in `data/seed/<site>/` with a `.meta.json` sidecar (source, licence, attribution, retrieval date) beside every file.

| Data | Source | Used for | Where |
| --- | --- | --- | --- |
| Daily weather 1991 to 2024 | **NASA POWER** (MERRA-2, about 55 km cell) | The weather behind every forecast year and the monthly outlook | `power_daily.json.gz` |
| Climate trend | **NASA NEX-GDDP-CMIP6** (SSP2-4.5 and SSP5-8.5) | The climate-change trend layered on observed weather (UBC, KPU) | `cmip6_delta.json.gz` |
| Vegetation (NDVI) | **NASA MODIS MOD13Q1** v061 (UBC, KPU); HLS metadata for older sites | Vegetation context and cross-checks | `ndvi.json.gz` |
| Satellite imagery | **NASA GIBS** (WMTS) | 3D viewer ground layer | fetched live |
| Soil | **SoilGrids 2.0** (ISRIC, CC BY 4.0), 250 m | Texture and organic carbon per farm | `soil.json` |
| Field outlines | **OpenStreetMap** (ODbL) | Six UBC Farm plots, farmland near KPU | `apps/web/lib/farms/` |
| 2D imagery | City of Vancouver and Township of Langley 2022 orthophotos | 2D map background (captured 2022, not the forecast period) | fetched live |
| Crop traits | FAO-56 and Statistics Canada, team-authored catalog | Water use, yields, planting windows | `data/seed/crops/` |
| Station checks | Environment and Climate Change Canada | Identity and bias checks only | `station_*.json*` |
| Glossary | Team-authored | The Learn page | `data/seed/glossary.json` |

**Not retrieved yet** (the `*.gap.json` files record what is missing): NASA SMAP soil moisture, ECOSTRESS evapotranspiration, GRACE, NASADEM elevation, and NDVI values for the older sites. The Methods page lists these as roadmap. Full details and licences are in [`docs/data-and-methods.md`](docs/data-and-methods.md).

`data/cache/` and `data/uploads/` are git-ignored.

---

## Tech stack

**Front-end** (`apps/web`)

- Next.js 15 (App Router), React 19, TypeScript, Tailwind 4
- **3D:** react-three-fiber, three.js, Cesium. **2D map:** MapLibre GL
- Framer Motion (animation), Zustand (state), Recharts (charts)
- Vitest and Testing Library (unit), Playwright (browser)
- Package manager: pnpm

**Back-end** (`services/api`)

- Python 3.12+, FastAPI, Uvicorn, managed with `uv`
- NumPy, SciPy, Shapely, pyproj, rasterio, Pillow (numerics and geospatial)
- httpx (outbound calls), pytest

**Contract** (`packages/contracts`)

- OpenAPI 3 spec, JSON schemas and deterministic fixtures. Types are generated into `apps/web/lib/api/schema.d.ts` with `openapi-typescript`.

**Assistant:** Gus runs `openai/gpt-oss-120b` on Groq, with NVIDIA and OpenRouter as fallbacks. The key stays on the server.

**Deploy:** a single Docker image (`Dockerfile`, `render.yaml`) that runs the API and the Next.js server together.

---

## How the code is organised

```
apps/web/                  Next.js website
  app/                       routes: / (globe + farm), /methods, /learn, /dev/*
  components/
    globe/                   homepage globe and farm dive
    farm-view/               the farm screen (FarmView.tsx) and its panels
    farm-future/             Future mode: timeline, monthly outlook, what-if, soil
    farm-forecast/           forecast panel
    rotation-planner/        build and edit rotations
    map2d/                   2D aerial map (MapLibre), custom field drawing
    viewer/                  3D twin (three.js and Cesium)
    copilot/                 Ask Gus
    window/                  window manager UI: <Window>, Dock
  lib/
    api/                     typed client with the mock / live switch
    farms/                   one file per farm: facts, sources, twin config
    farm-future/, forecast/  stores and forecast helpers
    window/                  window geometry, config and persistence
    methods/                 dataset list for the Methods page
  e2e/                       Playwright specs

services/api/              FastAPI back-end
  app/routers/               thin HTTP layer (one file per resource)
  app/services/              business logic behind each router
  app/twin/                  the forecast engine (water, soil, nitrogen, pests, scoring)
  app/rotation/              rotation engine, evidence and crop traits
  app/weather/               NASA POWER and seasonal outlook
  app/terrain/, imagery/     terrain and imagery helpers
  tests/                     pytest

packages/contracts/        OpenAPI, JSON schemas, fixtures (the shared contract)
data/seed/                 pre-built data for curated sites
scripts/                   seed builders, fixture generators, smoke tests, hosted runner
docs/                      PRDs, handoffs, data notes; docs/progress/ has one note per finished task
```

**The seam between the halves is the contract.** The front-end builds against fixtures and the back-end against the same spec, so neither waits for the other.

### Main API endpoints

All under `/api/v1` (interactive docs at `/api/v1/docs`):

| Endpoint | Purpose |
| --- | --- |
| `GET /sites`, `/sites/{id}` | Curated sites |
| `POST /sites/{id}/forecast` | Ten-year rotation forecast for a scenario |
| `POST /sites/{id}/forecast/sensitivity` | How sensitive the ranking is to inputs |
| `GET /sites/{id}/outlook` | Next 12 months |
| `GET /sites/{id}/climate-outlook`, `/exposure` | Climate path and exposure |
| `GET /crop-catalog` | Crops, traits and planting windows |
| `POST /copilot/chat` | Ask Gus |
| `POST /field/analyze` | Custom drawn field (2D) |
| `GET /weather/summary`, `/weather/storms` | Weather and storm summaries |
| `GET /health` | Health check |

---

## How a forecast works

1. **Weather.** Each forecast year replays an observed year from the 1991 to 2024 NASA POWER record, shifted by the climate trend (NEX-GDDP-CMIP6 deltas) and by the what-if sliders. Changes phase in linearly from year 0 to year 10.
2. **Soil and crops.** SoilGrids gives the soil. The crop catalog gives water use, planting windows and traits.
3. **Engine** (`services/api/app/twin/`). A weekly water balance, a soil carbon model (ICBM), nitrogen and pest modules run for each rotation.
4. **Scoring.** Each rotation is scored on indices that start at 100 in year 0, so strategies compare with each other. Absolute estimates carry units and a **p10 to p90** range across the replayed years.
5. **Explain.** Each strategy returns a `rotation_explanation` (why, evidence, benefits, gaps, risks).

The same request always returns the same result. Only Gus is exempt, and Gus never changes a forecast number.

**Known limits** (also on the Methods page): weather is one coarse cell with a measured cool bias against local stations, soil is one 250 m pixel not measured on these fields, and the farms' "Current rotation" is a team-defined starting point that users can edit.

---

## Key decisions

The full list is in [`docs/stardew-earth-v4-prd.md`](docs/stardew-earth-v4-prd.md). The ones that shape the code:

| Decision | Why |
| --- | --- |
| **Contract first, mocks and live behind a switch** | Two people build in parallel without blocking each other. |
| **Crop rotation is the core feature** | It is what the challenge asks for: compare at least three strategies, including the current one. |
| **Deterministic forecasts** | The same inputs give the same outputs, so results can be trusted and tested. |
| **NASA data first** | Weather from POWER, climate trend from NEX-GDDP-CMIP6. A non-NASA source is only a labelled fallback. |
| **Per-field colouring, not a 30 m grid** | Until real elevation and satellite data exist, a fine grid would imply precision we do not have. |
| **Monthly outlook replaces the 6-month weekly forecast** | More honest about how uncertainty grows. |
| **No income or fertilizer figures in the UI** | Prices come from the farmer and are never invented. |
| **Gus is a must-have, with the key on the server** | A farmer can ask about what they are looking at. It cannot alter results. |
| **Custom drawn fields are 2D only** | The twin itself covers UBC Farm and KPU Langley only. |
| **Honest labelling** | Units, p10 to p90 ranges, a "Pre-built" badge on curated sites, "mock" badges on mock data, and a Methods page with every dataset and licence. Unverified values are marked `TODO(verify)`. |
| **One window manager, one z-order store** | A crowded screen needs user-controlled layout; see `DOCUMENTATION.md`. |

---

## Workflow

- **Work on `main`.** Commit directly to `main`; run `git pull --rebase` before starting and before pushing. Keep commits small and `main` runnable. Put the task ID in the message (for example `FV-WIN: ...`).
- **One task per session.** Task prompts live in [`Prompts.md`](Prompts.md); when a task is done, write `docs/progress/<task-id>.md` (what was built, files touched, how to run, known gaps).
- **Rules for Claude Code sessions** are in [`CLAUDE.md`](CLAUDE.md): never invent endpoints, fields, dataset names, URLs or licences, and mark anything unverified `TODO(verify)`.
- **Never commit** `.env`, secrets, or imagery whose licence forbids redistribution.
- **Changing the contract** (`packages/contracts/openapi.yaml`):
  1. Message the whole team before merging.
  2. Bump the version in `openapi.yaml`.
  3. Update the fixtures in `packages/contracts/fixtures/` so mock mode still matches.
  4. Run `make types` and commit the regenerated `apps/web/lib/api/schema.d.ts`.

### Handy commands

| Command | What it does |
| --- | --- |
| `make dev` | Start the API on :8000 (`OFFLINE=1 make dev` for offline) |
| `make test` | pytest for contracts and API, plus Vitest for the web app |
| `make seed` | Rebuild curated-site seed data |
| `make fixtures` | Regenerate the deterministic mock fixtures |
| `make types` | Regenerate TypeScript types from the OpenAPI spec |
| `pnpm dev` / `build` / `lint` / `typecheck` / `test` (in `apps/web`) | Web app tasks |

---

## Testing

```sh
make test                                # contracts + API (pytest) + web (Vitest)
cd apps/web && pnpm typecheck && pnpm lint && pnpm build

# Browser tests (need a running dev server)
cd apps/web
QA_BASE_URL=http://localhost:3000 pnpm exec playwright test -c e2e/farm-view/playwright.config.ts
```

Seed data is checked by tests, and the production web build runs `check-build` to catch unverified markers in built code.

---

## Configuration

Copy `.env.example` to `.env` (git-ignored) and fill in what you need. Names only are listed here:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `OFFLINE` | API | `1` serves seed data only, with no network calls |
| `DATA_DIR`, `LOG_LEVEL` | API | Data folder (default `data/`) and log level |
| `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | API | Allowed web origins (default `http://localhost:3000`) |
| `GROQ_API_KEY` | API | Ask Gus (primary provider) |
| `NVIDIA_API_KEY`, `OPENROUTER_API_KEY` | API | Gus fallbacks |
| `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, `EARTHDATA_TOKEN` | Seed scripts | NASA Earthdata downloads (AppEEARS) |
| `OPEN_METEO_SEASONAL` | API | Optional seasonal-forecast overlay for the monthly outlook |
| `NEXT_PUBLIC_API_MODE`, `NEXT_PUBLIC_API_BASE` | Web | `live` or `mock`, and the API URL |
| `NEXT_PUBLIC_MOCK_EXTRAS` | Web | Dev-only illustrative field polygons for mock mode |
| `NEXT_PUBLIC_BACKUP_VIDEO_URL` | Web | Optional recorded backup video for the tour |

Secrets are never printed, logged or committed.

---

## Deployment

The `Dockerfile` builds the API (uv) and the web app (pnpm, Next.js) into one image. The web server proxies `/api/v1` to the API on `127.0.0.1:8000` (`STARDEW_EARTH_API_ORIGIN`). `render.yaml` describes a Render web service with `/api/v1/health` as its health check. `.vercelignore` is included for Vercel deploys of the web app; in that case set `NEXT_PUBLIC_API_BASE` and the API's `CORS_ORIGINS`.

---

## Docs map

| Doc | Read it for |
| --- | --- |
| [`prd.md`](prd.md) | The original spec (schemas, endpoints, file formats) |
| [`docs/stardew-earth-v4-prd.md`](docs/stardew-earth-v4-prd.md) | The v4 build: UBC Farm and KPU Langley, decisions D1 to D12, product rules |
| [`docs/data-and-methods.md`](docs/data-and-methods.md) | Every dataset, licence and limit |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Where the build stands and what to do next |
| [`DOCUMENTATION.md`](DOCUMENTATION.md) | The farm-screen window system |
| [`apps/web/README.md`](apps/web/README.md) | Web app setup and browser QA |
| [`packages/contracts/README.md`](packages/contracts/README.md) | The contract and fixtures |
| `docs/progress/` | One note per finished task |

---

Built for the NASA Space Apps Challenge 2026, Vancouver. NASA data courtesy of the NASA Langley Research Center POWER Project, the NASA Center for Climate Simulation, and NASA EOSDIS LP DAAC and GIBS.
