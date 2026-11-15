# FieldTwin v4 PRD: UBC Farm and KPU Langley digital twin, with crop rotation planning and a farm co-pilot

Status: 2026-11-15. Replaces the pasted "PRD v3.1" as the working plan. Written after a design interview with the product owner. It builds on `docs/backend-forecast-prd.md` (the engine, contract v1.2.0) and keeps `CLAUDE.md` rules unless section 2 changes them.

## 0. How to use this document

- Sections 1 to 4 say what we are building and what is true today. Section 5 lists every data source and how we get it. Sections 6 and 7 are the work, split into backend workstreams (B1 to B11) and frontend workstreams (F1 to F8). Section 8 is the contract change. Section 9 gives the lanes for parallel sessions, with where each starts and stops. Section 10 is acceptance. Section 11 lists risks and open items.
- Every value marked `TODO(verify)` must be checked against its source before the demo. Do not invent endpoints, fields, enum values, constants, dataset names, URLs or licences.

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
- No satellite seeds. No elevation grid. No station check. No climate-change trend file (B1 is building it).
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

| Need | Source | How we get it | State | Owner |
| --- | --- | --- | --- | --- |
| Weather, 1991 to 2024 | NASA POWER daily | Already seeded for UBC and KPU | Done | none |
| Soil | ISRIC SoilGrids 2.0 | Seeded. KPU forecast still fails (B6) | UBC done | B6 |
| Climate trend | NASA NEX-GDDP-CMIP6 via NCCS THREDDS NetCDF Subset Service, daily `tasmax`, `tasmin`, `pr`, 0.25 degree | `scripts/seed_cmip6/build_ncss.py`. No login. One variable-year at one point takes about 8.6 s | **Running** (4 models, ssp245 and ssp585, both sites; about an hour) | B1 |
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

## 6. Backend workstreams

All backend work stays in `services/api/`, `packages/contracts/`, `data/seed/`, `scripts/` and `docs/`. It never edits `apps/web/`. Each workstream ends with tests, a note in `docs/progress/FT-<ID>.md`, a commit to `main` with the ID, and `git pull --rebase` first.

**B1. Climate trend into the engine.**
- Let `scripts/seed_cmip6/build_ncss.py` finish for `site_ubc_farm` and `site_kpu_langley` (writes `data/seed/<site>/cmip6_delta.json.gz` and its sidecar).
- Pass `climate_source` and `site_id` from `forecast.py` into the weather ensemble and the climate outlook (the request in `docs/progress/forecast-requests.md`, from FT-EB4).
- Map contract presets to the file keys. Today `drier_summers` and `wetter_winters` read `ssp245` and `both` reads `ssp585`; confirm this mapping with the owner or add it to the contract.
- Replace the assumption "No verified CMIP6 delta table is attached" in the response when the file exists.
- Acceptance: with the file, a baseline run and an `ssp245` run give different year-10 weather; the response says which models and years produced the delta; tests cover the file loader and the seasonal delta maths (`services/api/tests/test_cmip6_ncss.py`).

**B2. Satellite seeds for UBC and KPU through AppEEARS.** Unblocked: the Earthdata username and password are in `.env`. Read them from the environment only; never print them.
- New script folder `scripts/seed_appeears/`. Log in, submit point (or small area) tasks, poll, download the CSV, write the existing seed shapes (`ndvi.json.gz`, `smap.json.gz`, `ecostress.json.gz`, `dem.json.gz`, optional `imerg`, `grace`) with sidecars, and delete the matching `.gap.json`. The seed contract is in `docs/grok-A-earthdata-ingest.md`.
- Do not use direct GDAL reads of LP DAAC files on the Windows machine and never disable TLS verification.
- Acceptance: for each site, `load_ndvi`, `load_smap`, `load_dem` return data; the climate outlook, exposure and uncertainty rows show the new layers; `data_mode` follows the data that exists; tests run offline against small committed fixtures.

**B3. Station check.** Pick the nearest active Environment Canada station with daily temperature and rain, record its climate identifier and coordinates, pull the daily record through the OGC API, and compare with the POWER seed (bias by month for temperature and rain). Write `data/seed/<site>/station.json.gz` and fill `station_bias` in the uncertainty block. Acceptance: the response shows the bias with unit, basis `derived`, years compared; the station and its distance to the farm are named.

**B4. Crops: planting windows and traits for UBC and KPU.** Fill `season_window` (planting and termination day of year) for the vegetables, covers and field crops used at the two farms, only from a cited source; keep null where no source exists. Keep the FAO-56 and Statistics Canada values already in. Define each farm's "Current rotation" ourselves, since no farm contact is available (D11). UBC: one family block per field, named by the OpenStreetMap plot names (D3-1 Brassicas, D4-1 Goosefoots, D6-1 Alliums and Legumes, D6-2 Nightshades and Garlic, D7-2 Early Cucurbits, D5-3 Maya Garden), with the families cycling through the fields in a standard market-garden order (brassicas, then alliums and legumes, then nightshades, then cucurbits, then chard and beet, with a cover crop between). KPU Langley: the typical vegetable preset already stored (FT-EC2). Store both as presets named "Current rotation" and editable in the UI. Acceptance: a UBC request with vegetables returns at least two alternatives; every filled value has `trait_sources` with a URL in the data file; the pool shown in the UI is no longer limited to field crops; the preset label reads "Current rotation".

**B5. Calibrate and sanity-check engine outputs.** Review UBC and KPU runs against known ranges (soil loss, nitrogen, pest index, yields) with cited sources. Fix saturation (pest pressure at 100), unit slips and unrealistic soil loss, or relabel as `assumed` or `relative` and widen the range. Acceptance: no output outside a documented plausible range without a review flag; a short note lists each check, source and result.

**B6. Fix the KPU soil seed.** `forecast("site_kpu_langley", ...)` fails although `data/seed/site_kpu_langley/soil.json` exists. Find the loader mismatch and fix it; add a test that runs a forecast for every demo site. Acceptance: a KPU forecast with the KPU request returns three strategies.

**B7. Monthly outlook (up to 12 months).**
- New endpoint `GET /sites/{id}/outlook` (contract v1.3.0). Response: 12 monthly entries with temperature, rain, water balance and heat or frost risk, each as p10, p50, p90 with unit, basis and confidence; plus a `kind` field saying `climatology` or `seasonal_forecast`.
- Step 1 (required): typical-year outlook from POWER 1991 to 2024 and the engine's weekly water balance, `basis: derived`, labelled "typical year, not a forecast".
- Step 2 (after step 1 ships): add anomalies from the Open-Meteo Seasonal API for the first months; verify the horizon, members, units and licence first and record them; bias-correct against the POWER climatology; mark `kind: seasonal_forecast` only for months that use it.
- Acceptance: deterministic for a given request; cached; under 300 ms cached; every month shows its basis and a widening range.

**B8. Rotation planning support.** The generator, the rotation rules and the scorecards already exist (`app/twin/generate.py`, `score.py`, request fields `selection`, `pinned`, `excluded`, `custom_strategies`, `strategy_count`, `constraints`). This workstream makes them work for UBC and KPU crops and explains them.
- With B4's windows in place, generate rotations from a pool that includes vegetables, grains, forage and cover crops; respect return intervals, host-family breaks, legume and cover-crop rules, equipment and labour constraints; keep the existing rotation as index 0.
- Make a farmer-entered custom rotation a first-class strategy (`custom_strategies`), scored the same way as the generated ones.
- Return plain-language rotation explanations from the API (templates): which rule a rotation satisfies or breaks (for example "two cereal years in a row, no break crop"), the mechanism of each crop role (nitrogen-fixing, cover, deep-rooting, drought-tolerant), and a review flag where a trait is unsourced.
- Acceptance: a UBC request with vegetables returns the existing rotation plus at least two alternatives; a custom rotation is scored and ranked next to them; every rotation carries its rule explanations and flags; results are deterministic.

**B9. Chatbot endpoint.** New endpoint `POST /copilot/chat` (v1.3.0). Server-side call to Groq (`openai/gpt-oss-120b`) with `GROQ_API_KEY`. The request carries the message and a snapshot of the screen (farm, field, year or month, scenario, strategy, selected cell or field). The server adds the forecast numbers for that snapshot and the glossary.
- System rules: plain farming language (explain NDVI, evapotranspiration and soil-moisture terms); quote the numbers on screen with their units and basis; state trade-offs and uncertainty and the resolution limit of coarse data (for example "one 9 km pixel"); never give a planting order; always say what to check locally; answer only from the supplied data, and say "not in the data" otherwise; refuse income and fertilizer figures.
- Guard: limit message size and rate per client; never return the key; time out gracefully with a plain error; log no secrets.
- Response: `reply`, `referenced_layers`, `local_validation_tips`.
- Acceptance: tests with a stubbed Groq client check the prompt contents and guardrails; an integration check with the real key answers a sample question using only supplied numbers.

**B10. Custom field analysis (2D view only).** New endpoint `POST /field/analyze` (v1.3.0). Takes a GeoJSON polygon and a rotation, finds the nearest POWER and SoilGrids data (live, cached by request hash), runs the engine, returns the same strategy shapes. This is for the 2D view only (D7). Acceptance: a polygon near UBC returns a result with `data_mode: limited_data` and the resolution notes; invalid or huge polygons return a 422 error; the call is rate-limited.

**B11. Contract v1.3.0.** Bump `packages/contracts/openapi.yaml` to 1.3.0, additive only: `GET /sites/{id}/outlook`, `POST /copilot/chat`, `POST /field/analyze`, the rotation explanation fields on each strategy, and the `kind` field. Add fixtures, contract tests and a message in `docs/progress/forecast-requests.md`. Update `API_VERSION`. This workstream goes first so the frontend can build against fixtures.

## 7. Frontend workstreams (apps/web)

Owner: the frontend session. Reads the engine only through `lib/api` and `lib/forecast`. Every number shows unit, basis and confidence. No income or fertilizer anywhere.

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

## 9. Lanes for parallel sessions

The frontend session (this chat) does F1 to F8 and never edits backend files. Three backend sessions can run at once. Nobody edits another lane's files; requests go as a dated note in `docs/progress/forecast-requests.md`.

| Session | Workstreams, in order | Owns | Starts when | Stops when |
| --- | --- | --- | --- | --- |
| A, data | B2, B3 | `scripts/seed_appeears/`, `scripts/seed_station/`, `data/seed/*/{ndvi,smap,ecostress,dem,imerg,grace,station}.*` | Now: B2 first (credentials are in `.env`), then B3 | `SESSION A FINISHED` after B3, or `SESSION A BLOCKED: <question>` for a credential or a fact it cannot verify |
| B, engine | B1, B6, B4, B8, B5, B7 | `services/api/app/twin/**`, `services/api/app/features/**`, `data/seed/crops/**`, `data/seed/*/cmip6_delta.*`, `scripts/seed_cmip6/**` | Now (B1 needs the running CMIP6 build to finish) | `SESSION B FINISHED` after B7 step 1 (step 2 is optional), or `BLOCKED` |
| C, API | B11 first, then B9, B10 | `services/api/app/routers/**`, `services/api/app/services/**` for the new endpoints, `packages/contracts/**` | Now (B11 first, within the first hours, so the frontend can build against fixtures) | `SESSION C FINISHED` after B10, or `BLOCKED` |

Rules for every session: read `CLAUDE.md` and this PRD first; stop only after the last workstream or a real block (a decision, a credential or a fact it cannot verify); after each workstream run the tests, write `docs/progress/FT-<ID>.md`, `git pull --rebase`, add files by path (never `git add -A`), commit `FT-<ID>: <summary>`, and push. Never print or commit secrets. Never edit `apps/web/`.

Suggested order for the whole project: B11 and B1 and B6 first; then B4, B3, B2 in parallel; then B8, B5, B7 step 1, B9, B10; the frontend builds F1 and F2 immediately on the existing engine, F3 and F6 against the v1.3.0 fixtures, then F4, F5, F7, F8.

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
