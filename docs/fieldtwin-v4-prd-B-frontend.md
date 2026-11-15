# FieldTwin v4 PRD, Part B (Person B): frontend

Status: 2026-11-15. This is **Part B of two PRDs**. It is for **Person B, who builds the frontend** (workstreams F1 to F8, section 7). **Part A** (`docs/fieldtwin-v4-prd-A-backend.md`) is for Person A, who builds the backend. Both parts share the same goals, rules, data plan, endpoint shapes (Appendix A) and acceptance list, so each can be read on its own. The full combined PRD is `docs/fieldtwin-v4-prd.md`. It builds on `docs/backend-forecast-prd.md` (the engine, contract v1.2.0) and keeps `CLAUDE.md` rules unless section 2 changes them.

## 0. How to use this part

- Read sections 1 to 4 for the goal, rules, current state and scope. Section 5 shows where the data comes from (you only need the imagery rows and the state column). Section 7 is your work. Section 8 and Appendix A are the API shapes you code against from the first minute. Section 9 says how you and Person A work in parallel without waiting for each other, and ends with your kickoff prompt. Section 10 is acceptance, section 11 risks.
- You own `apps/web/**`. You never edit `services/`, `packages/contracts/`, `data/`, `scripts/` or `.env`. If you need a backend change, add a dated line to `docs/progress/forecast-requests.md`.
- You do not need any secret. The Cesium token is already in `apps/web/.env.local`.
- Do not invent endpoints, fields, enum values or dataset names. Render unknown enum values neutrally.

## 1. Goal and decisions

FieldTwin is a website that turns a real farm into a digital twin, forecasts how climate change will affect it over 10 years, and compares three crop rotations. NASA Space Apps 2026, challenge "Field Shift". The demo covers **two farms only: UBC Farm (Vancouver) and KPU Langley (Langley, BC)**.

Decisions made in the interview (the product owner's answers, in order):

| # | Decision |
| --- | --- |
| D1 | The farm co-pilot chatbot is a must-have. Model: `openai/gpt-oss-120b` on Groq. The key stays on the server. |
| D2 | The 6-month weekly forecast is dropped. A **monthly outlook for up to 12 months** is added, in two steps: first a typical-year outlook from 34 years of weather plus the engine's water balance, then a real seasonal forecast layered on top. |
| D3 | Income and fertilizer numbers are **removed from the interface completely**. The backend may still return them. |
| D4 | Map colouring is **per field** (six UBC plots, the KPU fields), not a 30 m grid, until real elevation and satellite data exist. |
| D5 | The existing farm view is extended, not rebuilt. The bottom timeline stays as it is for now. |
| D6 | New endpoints go into one additive contract bump, v1.3.0. |
| D7 | Custom drawn fields are for the **2D bird's-eye view only**. The twin itself is only UBC and KPU Langley. The app does not need to work offline. |
| D8 | The climate trend comes from NASA NEX-GDDP-CMIP6 first. A non-NASA source is used only as a labelled fallback. |
| D9 | Satellite data is fetched through AppEEARS with the owner's Earthdata username and password. |
| D11 | The product owner cannot reach UBC Farm, so the existing rotations for UBC and KPU Langley are **defined by the team** (B4) and shown as the farm's "Current rotation", editable by the user. The build carries no per-screen assumption tags. |
| D12 | The strict honesty rules in `CLAUDE.md` are relaxed by the owner for this build (section 2). |
| D10 | **Crop rotation is the core feature.** The farmer's existing rotation is compared with two alternatives built from the farmer's own crop pool, and the farmer can edit a rotation. (An earlier draft added "crop shifting" as a separate feature; the owner meant crop rotation, so it was removed.) |

## 2. Product rules

The owner relaxed the strict labelling rules in `CLAUDE.md` for this build (D12). What stays, and what changes:

1. **Numbers.** Show a unit with every number and keep the p10 to p90 range on estimates. The per-number basis chips (`measured`, `derived`, `modeled`, `assumed`, `relative`) may be shown in a details view or tooltip instead of on every line, and "assumed" or `TODO(verify)` tags do not appear on the main screens (D11).
2. **Current rotation.** Each farm's existing rotation is shown as "Current rotation" with an edit control. It is the team's defined starting rotation (B4). The app does not state that it is the farm's recorded practice.
3. **One place for the details.** A single Methods and data page lists every dataset with source, licence and attribution (a licence requirement), the climate source and scenario, and the modelling assumptions in plain words. The line "This tool supports, and does not replace, local agronomic expertise." stays on the dashboard, and the forecast is described as a scenario forecast.
4. **No income and no fertilizer figures anywhere in the UI** (D3). Prices are never invented.
5. **Unfinished features** are hidden, or tagged Roadmap where a placeholder helps the story. Nothing that does not work is shown as working. This includes the 30 m cell map and hotspot maps until their data exists (D4) and the real seasonal forecast until B7 step 2 ships.
6. **Deterministic forecasts.** The same request returns the same result. The chatbot is exempt, because a language model is not deterministic. It must not change any forecast number.
7. **Live lookups.** The demo farms may call live services. `OFFLINE=1` still serves seed data only. Custom-field lookups (B10) may call NASA POWER and SoilGrids live and must cache by request hash.
8. **Secrets** (`.env`, tokens, passwords, keys) are never printed, logged or committed.

## 3. What is true today (verified 2026-11-15)

**Real and working**
- Contract v1.2.0: `GET /sites/{id}/climate-outlook`, `GET /sites/{id}/exposure`, `GET /crop-catalog`, `POST /sites/{id}/forecast`, `POST /sites/{id}/forecast/sensitivity`. Engine in `services/api/app/twin/` (weekly water balance, ICBM soil carbon, nitrogen, pests, strategy generator and scorecards).
- Seeds for UBC Farm: NASA POWER daily 1991 to 2024 and SoilGrids soil. KPU Langley has the same files, but the forecast for KPU still fails with "No soil seed and no soil override for this site" (bug, B6).
- UBC web twin pieces from this round: six real UBC Farm plots from OpenStreetMap, a pre-built forecast file (`apps/web/public/prebuilt/site_ubc_farm_forecast.json`), an API client, a Forecast panel in Future mode, mock sites UBC and KPU Langley, UBC pin at 49.249786, -123.236786.
- Earthdata token works for data hosts (HTTP 206 on a real HLS file). `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` are now in `.env` (checked 2026-11-15; values never printed), so AppEEARS can be used. Groq key works (HTTP 200) and stays in use until the owner rotates it.

**Not real yet**
- No satellite seeds. No elevation grid. No station check. The climate-change trend files exist for both farms (`cmip6_delta.json.gz`) but the engine does not use them until B1 wires them in.
- Vegetables cannot be planned: 37 of 49 catalog crops have no planting window (`season_window` days are null), so the engine returns zero alternatives for vegetable pools. The demo pool is cereals, legumes, canola and cover crops until B4 fills the windows. Both BC farms already have a typical vegetable rotation preset (FT-EC2), currently named "Typical vegetable rotation (not this farm's records)"; B4 renames it to "Current rotation".
- Some engine outputs are implausible for UBC (soil loss about 52 to 60 t/ha/yr, nitrogen balance index about 390, alternative pest pressure stuck at 100). They need calibration (B5).
- The NASA POWER cell for UBC is 55 km wide with a mean elevation of about 565 m; the farm is near sea level. Temperature bias is unmeasured until B3.
- Most of Future mode (timeline, pills, lens cards, Soil health, Compare, the Strategy picker) reads synthetic fixtures.
- UBC is still `tier: "explore"`. KPU Langley has no forecast seed.
- Satellite downloads from LP DAAC fail on the Windows development machine ("schannel: the certificate chain is incomplete" in GDAL). Disabling certificate checks was refused and must not be used. See B2.

## 4. Scope

**In scope (must work on demo day)**
1. UBC Farm and KPU Langley in the 3D explore view and a new 2D bird's-eye view.
2. A three-strategy rotation comparison from the real engine: the existing rotation (A) and two alternatives (B and C), over 10 years, per field and for the whole farm.
3. Climate outlook from real weather plus a real climate trend (NEX-GDDP-CMIP6), with rainfall and temperature what-if sliders.
4. A monthly outlook for up to 12 months.
5. Crop rotation planning: pick the crop pool (vegetables, grains, forage, cover crops), pin or exclude crops, see the existing rotation and two generated alternatives as a year-by-season plan over 10 years, edit a custom rotation, and see why each rotation is suggested.
6. Per-field colouring driven by the year scrubber, for the six UBC plots and the KPU fields.
7. The farm co-pilot chatbot.
8. Custom field drawing in the 2D view only.

**Roadmap (shown as such, not working)**
- 30 m cell map and the erosion, water-stress and frost hotspot layers (needs elevation and satellite data, B2).
- Real seasonal forecast (until B7 step 2).
- Income and fertilizer (D3), drone and video capture, custom fields in the digital twin.

**Out of scope**: the three US sites (Beltsville, Cornell, Oakville) stay as they are and are not worked on.

## 5. Data plan

All fetching happens in seed-build scripts, not while a request waits (except B10). Each source gives a **small slice** (one point or a window of about 1 km), not a bulk download.

**Which downloads are actually needed.** For the demo core only two are worth their time, and both are small: the climate trend (done) and the station check (B3, one short API call). The satellite layers (B2) do not change the forecast numbers. They add cross-checks, uncertainty rows and zones, so B2 runs last and can be dropped from the demo without breaking anything else. If the climate trend ever needs rebuilding in a hurry, run `build_ncss.py` with one model instead of four; that is about four times faster.

| Need | Source | How we get it | State | Owner |
| --- | --- | --- | --- | --- |
| Weather, 1991 to 2024 | NASA POWER daily | Already seeded for UBC and KPU | Done | none |
| Soil | ISRIC SoilGrids 2.0 | Seeded. KPU forecast still fails (B6) | UBC done | B6 |
| Climate trend | NASA NEX-GDDP-CMIP6 via NCCS THREDDS NetCDF Subset Service, daily `tasmax`, `tasmin`, `pr`, 0.25 degree | `scripts/seed_cmip6/build_ncss.py`. No login. One variable-year at one point takes about 8.6 s | **Done** for both sites (4 models: ACCESS-CM2, ACCESS-ESM1-5, BCC-CSM2-MR, CMCC-ESM2; ssp245 and ssp585; seeds in `data/seed/<site>/cmip6_delta.json.gz`) | B1 |
| Vegetation (NDVI) | NASA HLS vegetation indices (`HLSL30_VI.020`, `HLSS30_VI.020`) or MODIS `MOD13Q1.061` | AppEEARS point sample, needs Earthdata username and password | Ready to start (credentials in `.env`) | B2 |
| Soil moisture | SMAP L4 `SPL4SMGP.008` (9 km, modeled) | AppEEARS point sample | Not started | B2 |
| Evapotranspiration | ECOSTRESS `ECO_L3T_JET.002` | AppEEARS point sample | Not started | B2 |
| Elevation | NASADEM (`NASADEM_NC.001`, 30 m) | AppEEARS area sample of about 1 km | Not started | B2 |
| Rain cross-check, groundwater | GPM IMERG `GPM_3IMERGDF`, GRACE | Optional | Not started | B2 (optional) |
| Station check | Environment and Climate Change Canada, `https://api.weather.gc.ca/collections/climate-stations` and `climate-daily` | No login. Pick a nearby active station. Candidates seen: Point Atkinson (1106200), North Vancouver Wharves (1105669), Richmond Dallyn 2 (1106764), Richmond Nature Park (1106PF7). Confirm it has daily temperature and rain | Not started | B3 |
| Vegetable planting windows | BC Ministry of Agriculture vegetable production guides (https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides) and the coastal BC planting chart (SM400). Confirm with UBC Farm staff | Read, transcribe with source link on every value. Unsourced stays null | Not started | B4 |
| Water-use coefficients, yields | FAO-56 Table 12 (horticulture Kc already filled, FT-EC3), Statistics Canada BC yields (FT-EC4) | Done for the listed crops | Partly done | B4 |
| Monthly outlook | Step 1: typical year from POWER 1991 to 2024 and the engine. Step 2: Open-Meteo Seasonal API (`https://seasonal-api.open-meteo.com/v1/seasonal`, no key; the endpoint answers; horizon length, members and licence are unverified) | Point query, cache by site and month | Not started | B7 |
| 2D imagery, UBC | City of Vancouver 2022 orthophoto tiles: `https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer/tile/{z}/{y}/{x}`. Tested: HTTP 200 with CORS | MapLibre raster source. Attribution "City of Vancouver 2022 Orthophoto Imagery" | Verified | F3 |
| 2D imagery, KPU | Township of Langley 2022 orthophoto service, `https://mapsvr.tol.ca/arcgisext02/rest/services/CachedServices/Ortho_2022/MapServer`. Its tiles use UTM zone 10 (EPSG:26910), so plain XYZ tiles return 404. The `export` endpoint with `bboxSR=3857&imageSR=3857&format=jpg` returns images with CORS (tested) | MapLibre raster source with a `{bbox-epsg-3857}` URL. Service text: "Captured Spring 2022". Attribution "Township of Langley 2022 Orthophoto Imagery" | Verified | F3 |
| Chatbot | Groq OpenAI-compatible API, model `openai/gpt-oss-120b` (also listed: `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) | Server-side call with `GROQ_API_KEY` from `.env` | Key verified | B9 |

Notes on AppEEARS: the Earthdata token returns HTTP 403 on the task list, so AppEEARS needs the Earthdata username and password (names `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` already exist in `.env.example`). The API logs in with Basic auth and returns its own short-lived token. A point task has `task_type: point`, a date range, a layer list and coordinates; the layer names for each product and the exact request body are `TODO(verify)` against the AppEEARS API documentation (`https://appeears.earthdatacloud.nasa.gov/api/`) and each product's layer list.

Licence note for NEX-GDDP-CMIP6: the AWS registry says CC0 and one published file says `cmip6_license: CC-BY-SA 4.0`. The seed follows the stricter terms (credit NASA and the CMIP6 groups, mark derived numbers CC-BY-SA 4.0). `TODO(verify)` with NCCS before the demo.

## 7. Frontend workstreams (apps/web)

Owner: Person B. Reads the engine only through `lib/api` and `lib/forecast`. Every number shows a unit and keeps its range; the basis detail lives in a tooltip or details view (section 2). No income or fertilizer anywhere.

**F1. Engine-fed Future mode.** Put a data layer behind `lib/farm-future/model.ts`: a `FutureData` object built from the `Forecast` response (strategies, trajectories, review flags, climate outlook, exposure) with the current fixtures as the fallback. Replace synthetic numbers section by section; anything the engine does not provide keeps the "Synthetic demo data" label. Make the Strategy picker use the engine strategy labels. Acceptance: for UBC the strategies, soil, water, pest and flag panels show engine values with no synthetic label; tests cover the adapter.

**F2. UBC and KPU twin.** Promote both farms to the twin tier with their field lists (UBC: the six OSM plots, credited under ODbL; KPU: fields to be defined with the owner), simulation box and rotation sets. Colour each field from the year scrubber using the per-field trajectories (soil, water stress, bare weeks), with a legend. Acceptance: dragging the year changes field colours from engine data; the 3D map and the field list show the same fields.

**F3. 2D bird's-eye view (MapLibre).**
- A "2D Map" button in the farm controls. Opening it pauses the Cesium render loop and mounts MapLibre; "3D Explore" destroys MapLibre and restores Cesium at the saved camera. `maplibre-gl` is already installed.
- First open: north-up, pitch 0, fit to about 3 km by 3 km around the farm point. Save and restore each farm's 2D camera. Reset map, flat/globe projection toggle, scale bar (metric and imperial), zoom buttons, keyboard pan and zoom.
- Imagery: UBC raster tiles; KPU through the export endpoint with a `{bbox-epsg-3857}` URL. Show the source and the year 2022 as attribution, separate from the NASA forecast period.
- Layers on the map: field outlines with per-field colour (D4), field popovers with plain-language readouts.
- **Custom field drawing** (D7): a draw-polygon tool that sends the polygon to `POST /field/analyze` and shows the result in a side card. Only in this view.
- Failure: if imagery fails, show a non-blocking banner and keep the 3D Explore button available.
- Acceptance: open 2D, pan, return to 3D, and repeat ten times with no WebGL context loss and no steadily rising memory.

**F4. Dashboard: extend the farm view.** Merge the Forecast panel, `UBCComparison.tsx` (another track's work, confirm with its owner) and Compare mode into one comparison for strategies A, B and C: crop sequence, mechanism badges (nitrogen-fixing, cover, deep-rooting, drought-tolerant, from the API), review flags with severity, "Why suggested", evidence, information gaps and local review risks. Hero numbers: soil health, net water against quota, frost-free and heat-stress days. Per-field and whole-farm toggle.

**F5. Timeline and what-if.** Keep the bottom timeline and the 10-year clock as they are (D5). Add a "Next 12 months" tab fed by B7 (monthly, labelled "typical year" until the seasonal forecast lands). Keep the rainfall and temperature sliders; they refetch the forecast (debounced) and show the scenario and climate source.

**F6. Farm co-pilot.** Slide-over chat connected to the screen state (farm, field, year or month, scenario, strategy, selected field). "Ask co-pilot" buttons on strategy cards, flagged fields and review flags with prefilled questions. Inline one-sentence tooltips for terms (evapotranspiration, NDVI, soil-moisture anomaly). Show that answers come from the supplied numbers and that local checks are needed. Handle errors and slow replies plainly.

**F7. Crop rotation planner.** (1) Crop pool picker by category (vegetable, grain, forage, cover, fruit) with search, pin and exclude, from `GET /crop-catalog`, with each trait's source shown. (2) Constraints form (equipment, labour, no-till, livestock, water quota) and strategy count. (3) A year-by-season plan grid for the existing rotation and the alternatives, with crop colours and the 12-month calendar for the selected year. (4) A custom-rotation editor (drag or pick crops into the grid) that sends `custom_strategies` and shows the scored result beside the others. (5) Per rotation, the rule explanations, crop-role badges and review flags from B8. Per-field and whole-farm toggle. No income or fertilizer.

**F8. Labels and Roadmap.** Roadmap tags on the 30 m grid, hotspot layers (until B2), real seasonal forecast (until B7 step 2) and drone or video capture. Data and methods page lists every dataset with source, licence and attribution (including NEX-GDDP-CMIP6, OSM, the two municipal orthophoto services, HLS and the other satellite products as they land).

## 8. Contract and endpoints

An endpoint is a URL the web app calls on the backend. The shared contract file `packages/contracts/openapi.yaml` lists them all. v1.3.0 is additive:

| Endpoint | Purpose | Workstream |
| --- | --- | --- |
| `GET /sites/{siteId}/outlook` | Monthly outlook up to 12 months | B7 |
| `POST /copilot/chat` | Co-pilot reply | B9 |
| `POST /field/analyze` | Custom polygon analysis, 2D view only | B10 |
| Rotation explanation fields on each forecast strategy (new response fields) | Rule explanations and crop-role badges | B8 |

Existing endpoints (`/sites/{id}/forecast`, `/forecast/sensitivity`, `/climate-outlook`, `/exposure`, `/crop-catalog`) are reused for everything else. New error codes, if any, are listed in B11. The web client regenerates `schema.d.ts` after the bump.

## 9. Splitting the work between two people

### 9.1 The split

| | Person A: backend | Person B: frontend |
| --- | --- | --- |
| Workstreams | B1 to B11 (section 6) | F1 to F8 (section 7) |
| Owns (only they edit) | `services/api/**`, `packages/contracts/**`, `data/seed/**`, `data/cache/**`, `scripts/**`, `.env` | `apps/web/**` |
| Shared, append only | `docs/progress/**` (each writes their own `FT-<ID>.md`) and the dated notes in `docs/progress/forecast-requests.md` | same |
| Needs secrets | Yes: `.env` with the Earthdata login and the Groq key. Never shared. | No. Only `NEXT_PUBLIC_*` values (the Cesium token is already in `apps/web/.env.local`) |

The halves are about the same size. Neither edits the other's files. A request for a change goes into `docs/progress/forecast-requests.md` as a dated line addressed to the other person.

### 9.2 How the two halves meet without waiting

1. **The contract is the handshake.** Appendix A freezes the new endpoint shapes. Person B codes against Appendix A from the first minute, with hand-written fixtures under `apps/web/lib/**/fixtures` where the real ones do not exist yet. Person A makes B11 the first job (about 1 to 2 hours); when it is on main, Person B runs `pnpm types` and swaps the hand-written fixtures for the contract fixtures.
2. **Mock first, live later.** The web app already reads fixtures in mock mode. When an endpoint is live, Person B sets `NEXT_PUBLIC_API_MODE=live` and runs the API locally from the repo (`make dev`), or points `NEXT_PUBLIC_API_BASE` at Person A's running server.
3. **What Person B can start right now** (existing endpoints, no waiting): F1 (engine-fed Future mode), F2 (twin and field colouring), F3 (2D map: it needs only imagery and the farm points), F7 (rotation planner on `/crop-catalog` and `/forecast`), F8 (labels, Methods page). **Needs B11 fixtures:** F5 (`/outlook`), F6 (`/copilot/chat`) and the draw tool in F3 (`/field/analyze`). Until B11 lands, build those against Appendix A.
4. **Data Person B needs from Person A:** the vegetable windows and rotations (B4) make F7 show vegetables; the climate trend (B1) changes what the sliders do; the KPU fix (B6) makes KPU forecastable. Person B does not wait for them: until they land, the screens use what the engine returns today, and the improvements appear when Person A commits.
5. **Checkpoints.** Both run `git pull --rebase` before every commit and about once an hour. Person A announces each finished workstream with one dated line in `docs/progress/forecast-requests.md` ("B4 DONE: vegetable windows on main"). Person B re-runs `pnpm types` and the web tests after any contract change.
6. **Git.** Both commit to `main` and `git pull --rebase` first. Add files by explicit path, never `git add -A`. Commit messages carry the workstream ID: `FT-B4: ...` (Person A) and `FT-F3: ...` (Person B).

### 9.3 Sessions inside each half (optional)

Each person may run more than one AI session. Keep the lanes on separate folders.

- **Person A:** lane A1 (API and contract: B11, then B9, B10; owns `services/api/app/routers/**`, `services/api/app/services/**` for the new endpoints, `packages/contracts/**`); lane A2 (engine: B1, B6, B4, B8, B5, B7; owns `services/api/app/twin/**`, `services/api/app/features/**`, `data/seed/crops/**`, `data/seed/*/cmip6_delta.*`, `scripts/seed_cmip6/**`); lane A3 (data: B3, then B2; owns `scripts/seed_appeears/**`, `scripts/seed_station/**`, `data/seed/*/{ndvi,smap,ecostress,dem,imerg,grace,station}.*`). B2 goes last because it depends on NASA's queue.
- **Person B:** lane B1 (F1, F2, F4, F5, F7, F8; owns everything under `apps/web` except the two folders below) and lane B2 (F3 and F6; owns `apps/web/components/map2d/**`, `apps/web/lib/map2d/**`, `apps/web/components/copilot/**`, `apps/web/lib/copilot/**`). The two lanes touch shared files (`FarmView.tsx`, `lib/store.ts`) only to add a mount point or one store field, in a small separate commit, with a pull just before.

### 9.4 Start and stop lines

- **Person A starts:** B11. Then B1 and B6 in lane A2 and B9 and B10 in lane A1 at the same time; lane A3 starts B3 at once and B2 when the other two have committed.
- **Person A stops:** `SESSION A FINISHED` after B10 and B2 (B7 step 2 is optional), or `SESSION A BLOCKED: <question>` for a decision, a credential or a fact that cannot be verified. Finish every other workstream before blocking.
- **Person B starts:** F1, F2, F3 and F7 now, F8 whenever, F5 and F6 as soon as Appendix A is coded against or B11 lands.
- **Person B stops:** `SESSION B FINISHED` after F8 and the integration pass (section 9.5), or `SESSION B BLOCKED: <question>`.

### 9.5 Integration pass (both, at the end)

1. Person A confirms the API suite, the contract suite and a forecast run for both farms are green and tells Person B.
2. Person B turns live mode on and runs the whole web flow against the real API: both farms, three strategies, sliders, the monthly outlook, the 2D map and a custom field, the co-pilot, the rotation planner.
3. Anything wrong goes in `docs/progress/forecast-requests.md` as a dated line to the owner. Both re-run the acceptance list in section 10.

### 9.6 Rules for every session

Read `CLAUDE.md` and this PRD first. Stop only after the last workstream or a real block. After each workstream run the tests, write `docs/progress/FT-<ID>.md`, `git pull --rebase`, add files by path, commit `FT-<ID>: <summary>`, and push. Never print or commit secrets. Do not edit the other person's files.

### 9.7 Kickoff prompt

**Person B (frontend):**

```
You are Person B (frontend) on FieldTwin. Read CLAUDE.md, then docs/fieldtwin-v4-prd.md fully, including Appendix A.
Your workstreams: F1, F2, F3, F7 first (they need no new endpoints), then F8, then F5 and F6 against Appendix A until Person A's contract v1.3.0 lands on main (look for "B11 DONE" in docs/progress/forecast-requests.md), then run `pnpm types` and switch to the contract fixtures.
You own apps/web. Do not edit services, packages/contracts, data, scripts or .env. If you need a backend change, add a dated line to docs/progress/forecast-requests.md.
Rules: every number shows a unit; no income or fertilizer anywhere; no "assumed" or TODO tags on the main screens; never print, log or commit secrets; git pull --rebase before each commit; add files by explicit path.
After each workstream: run pnpm test, pnpm typecheck and pnpm lint, write docs/progress/FT-<ID>.md, commit "FT-<ID>: <summary>", push.
Stop only after F8 and the integration pass, or with "SESSION B BLOCKED: <question>".
```

## 10. Acceptance criteria

1. **Two farms.** UBC Farm and KPU Langley both open in 3D and 2D. A forecast runs for both (KPU no longer fails).
2. **Real, labelled data.** The UBC forecast uses the six real plots, real POWER weather, SoilGrids soil and the NEX-GDDP-CMIP6 trend. Each number shows unit, basis and confidence; absolute estimates show p10 and p90. No income or fertilizer number appears.
3. **Three strategies.** Existing rotation plus two alternatives, with vegetables allowed (B4), compared per field and for the whole farm over years 1 to 10, with review flags, "why suggested", evidence, gaps and local risks.
4. **Crop rotation.** The farmer picks a crop pool (including vegetables), pins or excludes crops, and gets the existing rotation plus at least two alternatives as a 10-year year-by-season plan. A custom rotation can be entered and is scored beside them. Each rotation shows which rules it meets or breaks, its crop-role badges and its review flags.
5. **Timeline and sliders.** The year scrubber recolours the fields from engine data. Slider changes refetch and update the screen in under 1 s (target under 300 ms when cached); the scenario and climate source are visible.
6. **Monthly outlook.** A 12-month view with ranges that widen with time, labelled "typical year" or "seasonal forecast" according to its source.
7. **2D map.** Opening 2D shows the 2022 aerial imagery with attribution and about a 3 km by 3 km view; ten open and close cycles show no WebGL context loss and no steadily rising memory; drawing a custom field returns a result card.
8. **Co-pilot.** Clicking "Ask co-pilot" on a field, a flag or a strategy opens the chat with the current screen state and returns a plain-language answer that quotes on-screen numbers, names its uncertainty and says what to check locally. It does not give planting orders and does not quote income or fertilizer.
9. **Product rules.** The support sentence is on the dashboard, the Methods and data page lists every dataset with source, licence and attribution, the existing rotations read "Current rotation" and are editable, no income or fertilizer number appears anywhere, and nothing unfinished is shown as working.
10. **Quality gates.** `services/api` tests, `packages/contracts` tests and `apps/web` tests, typecheck and lint pass (the three existing lint errors in `e2e/farm-view/helpers.ts` are tracked separately).

## 11. Risks and open items

| # | Item | Owner | What settles it |
| --- | --- | --- | --- |
| R1 | AppEEARS rejects the Earthdata token and needs the username and password | Product owner | Done: both are in `.env` (git-ignored). Session A confirms a login works |
| R2 | Direct LP DAAC reads fail on the Windows machine (certificate chain) | Session A | Use AppEEARS (B2). Do not disable TLS verification |
| R3 | NEX-GDDP-CMIP6 licence disagreement (CC0 versus CC-BY-SA 4.0) | Product owner | Confirm with NCCS; the seed already follows the stricter terms |
| R4 | The UBC and KPU current rotations are team-defined and the vegetable windows are unsourced | Session B | B4: defined from the plot names and public planting guides; editable in the UI (D11) |
| R5 | Engine outputs not calibrated; soil loss, nitrogen and pest values implausible | Session B | B5 |
| R6 | The UBC POWER cell is 55 km and about 565 m mean elevation | Session A | B3 station bias |
| R7 | Open-Meteo seasonal API: horizon, members, units and licence unverified | Session B | Read the official docs and record before step 2 |
| R8 | `UBCComparison.tsx` was added by another track and overlaps with the Forecast panel and Compare mode | Frontend, other track's owner | Agree one comparison view in F4 |
| R9 | The Groq key was printed once into a session log | Product owner | The owner will rotate it later; keep using the current key until then. It lives as `GROQ_API_KEY` in `.env` |
| R10 | Chatbot answers are not deterministic and depend on internet access | Session C | Guardrails and tests in B9; a plain error when Groq is unreachable |
| R11 | KPU Langley field boundaries are not defined | Session B, frontend | Choose fields from OpenStreetMap plots like UBC; the rotation is the stored preset (B4) |

## 12. References

- Engine and earlier contract: `docs/backend-forecast-prd.md`, `docs/progress/FT-W0.md` to `FT-W10.md`, `docs/progress/FT-FE-ubc.md`.
- Satellite seed contract: `docs/grok-A-earthdata-ingest.md`. Climate trend reader: `docs/progress/FT-EB4.md`.
- NASA NEX-GDDP-CMIP6: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6
- AppEEARS API: https://appeears.earthdatacloud.nasa.gov/api/
- Environment and Climate Change Canada OGC API: https://api.weather.gc.ca/collections/climate-stations
- Open-Meteo seasonal forecast API: https://open-meteo.com/en/docs/seasonal-forecast-api (confirm the page before use)
- MapLibre raster tile source: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-raster-tile-source/
- City of Vancouver 2022 orthophotos: https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/information/
- Township of Langley 2022 orthophotos: https://mapsvr.tol.ca/arcgisext02/rest/services/CachedServices/Ortho_2022/MapServer
- BC vegetable production guides: https://www2.gov.bc.ca/gov/content/industry/agriculture-seafood/animals-and-crops/crop-production/vegetables-production-guides

## Appendix A. Frozen API shapes for contract v1.3.0

These are the shapes Person A implements in B11 and Person B codes against. `Number` is the existing contract object `{ value, unit, basis, confidence, p10?, p50?, p90? }`. Unknown enum values must render neutrally (no crash, no blank screen). If a shape here must change, the person who needs it writes the change in `docs/progress/forecast-requests.md` first.

### A.1 `GET /sites/{siteId}/outlook?months=12&scenario=baseline`

`months` is 1 to 12 (default 12). `scenario` is the existing preset name.

```json
{
  "site_id": "site_ubc_farm",
  "start_month": "2026-12",
  "kind": "climatology",
  "data_mode": "limited_data",
  "months": [
    {
      "month": "2026-12",
      "kind": "climatology",
      "temperature_mean_c": { "value": 4.1, "unit": "degC", "basis": "derived", "confidence": "medium", "p10": 2.4, "p50": 4.0, "p90": 5.9 },
      "rain_mm": { "value": 210, "unit": "mm", "basis": "derived", "confidence": "medium", "p10": 120, "p50": 205, "p90": 310 },
      "water_balance_mm": { "value": 190, "unit": "mm", "basis": "modeled", "confidence": "medium", "p10": 95, "p50": 185, "p90": 290 },
      "heat_risk": { "value": 0, "unit": "days", "basis": "derived", "confidence": "low" },
      "frost_risk": { "value": 6, "unit": "days", "basis": "derived", "confidence": "medium", "p10": 2, "p50": 6, "p90": 11 }
    }
  ],
  "sources": [ { "name": "NASA POWER daily point", "role": "weather", "url": "https://power.larc.nasa.gov/docs/services/api/", "license": "...", "attribution": "..." } ],
  "support_sentence": "This tool supports, and does not replace, local agronomic expertise."
}
```

The top-level `kind` is `climatology` (typical year) or `seasonal_forecast` (at least one month uses a real forecast). Each month carries its own `kind`. Ranges widen with the month index. Errors: 404 `SITE_NOT_FOUND`, 422 `INVALID_INPUT`.

### A.2 `POST /copilot/chat`

Request:

```json
{
  "message": "Why is the Brassicas field flagged in year 5?",
  "snapshot": {
    "farm_id": "ubc-farm",
    "site_id": "site_ubc_farm",
    "field_id": "d3-brassicas",
    "horizon": "years",
    "time_index": 5,
    "scenario": { "preset": "baseline", "rain_scale_pct": 0, "temp_offset_c": 0 },
    "strategy_id": "rot_alt_1",
    "selected": { "kind": "flag", "id": "flag-id-from-the-forecast" }
  },
  "history": [ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ]
}
```

Limits: `message` up to 1000 characters; `history` up to 6 entries; `field_id`, `strategy_id` and `selected` may be null. `horizon` is `years` or `months`. `selected.kind` is `field`, `flag` or `strategy`.

Response 200:

```json
{
  "reply": "plain-language answer that quotes the numbers it was given",
  "referenced_layers": ["soil_organic_index", "water_demand_mm"],
  "local_validation_tips": ["Check drainage on the north edge of the plot before planting."]
}
```

Errors: 422 `INVALID_INPUT`, 429 `RATE_LIMITED` (new code), 503 `DATA_SOURCE_UNAVAILABLE` (the language model is unreachable). The server builds the numbers from the snapshot; the client never sends forecast values.

### A.3 `POST /field/analyze` (2D view only)

Request:

```json
{
  "polygon": { "type": "Polygon", "coordinates": [[[-123.2375, 49.2498], [-123.2368, 49.2498], [-123.2368, 49.2503], [-123.2375, 49.2503], [-123.2375, 49.2498]]] },
  "rotation": "preset",
  "scenario": { "preset": "baseline" },
  "selection": { "crops": ["crop_potato", "crop_carrot", "crop_rye_cover"], "pinned": [], "excluded": [] }
}
```

`rotation` is `preset` or a list of `{ "year_index": 1, "season": "spring", "crop_id": "..." }`. `selection` is optional. The polygon is WGS84 longitude and latitude, one ring, closed, at most 200 ha.

Response 200:

```json
{
  "field_id": "custom_3f9a12",
  "area_ha": 0.43,
  "location": { "lat": 49.25, "lon": -123.2372 },
  "forecast": { "...": "the same Forecast object as POST /sites/{id}/forecast, with one field" },
  "resolution_notes": ["Weather is a 55 km NASA POWER cell.", "Soil is a 250 m SoilGrids pixel."]
}
```

Errors: 422 `INVALID_INPUT` (not a valid closed polygon, or over 200 ha), 429 `RATE_LIMITED`, 503 `DATA_SOURCE_UNAVAILABLE`.

### A.4 `rotation_explanation` on every forecast strategy

New optional object on each entry of `Forecast.fields[].strategies[]` (and the farm rollup entries):

```json
{
  "rotation_explanation": {
    "rules": [
      { "rule_id": "break_crop", "status": "broken", "text": "Two cereal years in a row with no break crop." },
      { "rule_id": "legume_in_cycle", "status": "met", "text": "A legume fixes nitrogen once in the cycle." }
    ],
    "crop_roles": [
      { "crop_id": "crop_red_clover", "role": "nitrogen_fixing", "text": "Fixes nitrogen from the air and feeds the next crop." }
    ]
  }
}
```

`status` is `met`, `broken` or `unknown`. `role` is `nitrogen_fixing`, `cover`, `deep_rooting`, `drought_tolerant` or `other`. All text comes from the API.

### A.5 New error code

`RATE_LIMITED` (HTTP 429, retryable true). All other codes already exist in contract v1.2.0.
