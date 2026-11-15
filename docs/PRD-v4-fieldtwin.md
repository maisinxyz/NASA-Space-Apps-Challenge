# FieldTwin v4 PRD: UBC Farm and KPU Langley digital twin, with crop rotation planning and a farm co-pilot

Status: 2026-11-15. Replaces the pasted "PRD v3.1" as the working plan. Written after a design interview with the product owner. It builds on `docs/backend-forecast-prd.md` (the engine, contract v1.2.0) and keeps `CLAUDE.md` rules unless section 2 changes them.

> **Overnight-execution scope note (added 2026-11-15, by the product owner):** for the unsupervised 4:30am-7:00am build window, B1's historical climate baseline is intentionally narrowed from the full 1991-2024 (34-year) NASA POWER record to the **most recent 10 years (2016-2026)** for every model/scenario/variable/site combination. This is a deliberate scope cut to cut NCCS THREDDS NCSS request count/time roughly 3x (each request is ~8.6s; fewer years = faster), not a data-quality fix. It must be labelled in the Methods and data page as a narrowed baseline window, not the full historical record, and can be widened back to 34 years post-demo without any code change (it's a config constant, not a structural limit).

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
- Earthdata token works for data hosts (HTTP 206 on a real HLS file). `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` arrive via the overnight credentials handoff (never printed), so AppEEARS can be used. Groq key works (HTTP 200) and stays in use until the owner rotates it.

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
| Climate trend | NASA NEX-GDDP-CMIP6 via NCCS THREDDS NetCDF Subset Service, daily `tasmax`, `tasmin`, `pr`, 0.25 degree, **historical baseline window narrowed to the most recent 10 years (2016-2026) for the overnight build** | `scripts/seed_cmip6/build_ncss.py`. No login. One variable-year at one point takes about 8.6 s; fire requests concurrently (with backoff if NCCS throttles) rather than serially | Not started (overnight) | B1 |
| Vegetation (NDVI) | NASA HLS vegetation indices (`HLSL30_VI.020`, `HLSS30_VI.020`) or MODIS `MOD13Q1.061` | AppEEARS point sample, needs Earthdata username and password | Ready once credentials land | B2 |
| Soil moisture | SMAP L4 `SPL4SMGP.008` (9 km, modeled) | AppEEARS point sample | Not started | B2 |
| Evapotranspiration | ECOSTRESS `ECO_L3T_JET.002` | AppEEARS point sample | Not started | B2 |
| Elevation | NASADEM (`NASADEM_NC.001`, 30 m) | AppEEARS area sample of about 1 km | Not started | B2 |
| Rain cross-check, groundwater | GPM IMERG `GPM_3IMERGDF`, GRACE | Optional | Not started | B2 (optional) |
| Station check | Environment and Climate Change Canada, `https://api.weather.gc.ca/collections/climate-stations` and `climate-daily` | No login. Pick a nearby active station. Candidates seen: Point Atkinson (1106200), North Vancouver Wharves (1105669), Richmond Dallyn 2 (1106764), Richmond Nature Park (1106PF7). Confirm it has daily temperature and rain | Not started | B3 |
| Vegetable planting windows | BC Ministry of Agriculture vegetable production guides and the coastal BC planting chart (SM400). Confirm with UBC Farm staff | Read, transcribe with source link on every value. Unsourced stays null | Not started | B4 |
| Water-use coefficients, yields | FAO-56 Table 12 (horticulture Kc already filled, FT-EC3), Statistics Canada BC yields (FT-EC4) | Done for the listed crops | Partly done | B4 |
| Monthly outlook | Step 1: typical year from POWER 1991 to 2024 and the engine. Step 2: Open-Meteo Seasonal API, no key; horizon length, members and licence are unverified | Point query, cache by site and month | Not started | B7 |
| 2D imagery, UBC | City of Vancouver 2022 orthophoto tiles | MapLibre raster source. Attribution "City of Vancouver 2022 Orthophoto Imagery" | Verified | F3 |
| 2D imagery, KPU | Township of Langley 2022 orthophoto service (export endpoint, EPSG:3857) | MapLibre raster source with a `{bbox-epsg-3857}` URL | Verified | F3 |
| Chatbot | Groq OpenAI-compatible API, model `openai/gpt-oss-120b` | Server-side call with `GROQ_API_KEY` from `.env` | Key arrives with overnight credentials | B9 |

Notes on AppEEARS: needs the Earthdata username and password (Basic auth, returns its own short-lived token). A point task has `task_type: point`, a date range, a layer list and coordinates; the layer names and exact request body are `TODO(verify)` against the AppEEARS API documentation.

## 6. Backend workstreams

All backend work stays in `services/api/`, `packages/contracts/`, `data/seed/`, `scripts/` and `docs/`. It never edits `apps/web/`. Each workstream ends with tests, a note in `docs/progress/FT-<ID>.md`, a commit with the ID, and `git pull --rebase` first.

**B1. Climate trend into the engine.** Build `scripts/seed_cmip6/build_ncss.py` for `site_ubc_farm` and `site_kpu_langley` over the **narrowed 10-year (2016-2026) baseline window** (see scope note at top); writes `data/seed/<site>/cmip6_delta.json.gz` and sidecar. Pass `climate_source` and `site_id` into the weather ensemble and climate outlook. Map contract presets to file keys (`drier_summers`/`wetter_winters` -> `ssp245`, `both` -> `ssp585`). Replace the "no verified CMIP6 delta" assumption string once the file exists. Tests cover the file loader and seasonal delta maths.

**B2. Satellite seeds for UBC and KPU through AppEEARS.** New `scripts/seed_appeears/`: log in with `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD` from the environment only (never print), submit point/area tasks, poll, download, write seed shapes (`ndvi.json.gz`, `smap.json.gz`, `ecostress.json.gz`, `dem.json.gz`) with sidecars. Never disable TLS verification. Acceptance: loaders return data where the task completed; `data_mode` follows what actually landed; tests run offline against small committed fixtures regardless of whether the live AppEEARS task finished in time.

**B3. Station check.** Nearest active Environment Canada station with daily temperature/rain; compare bias by month against the POWER seed; write `station.json.gz`; fill `station_bias` in the uncertainty block.

**B4. Crops: planting windows and current rotations for UBC and KPU.** Fill `season_window` only from a cited source (null if unsourced). Define each farm's "Current rotation": UBC per the exact D11 family-block order (Brassicas, Goosefoots, Alliums+Legumes, Nightshades+Garlic, Early Cucurbits, Maya Garden cycling through plots D3-1, D4-1, D6-1, D6-2, D7-2, D5-3); KPU reuses the existing FT-EC2 preset, renamed "Current rotation". Store both as editable presets.

**B5. Calibrate and sanity-check engine outputs.** Review UBC/KPU runs against cited plausible ranges; fix saturation/unit slips or relabel `assumed`/`relative` with a wider range rather than guess a fix. Document every check and its source.

**B6. Fix the KPU soil seed.** `forecast("site_kpu_langley", ...)` fails despite `data/seed/site_kpu_langley/soil.json` existing — find the loader mismatch, fix it, add a regression test covering a forecast for every demo site.

**B7. Monthly outlook (up to 12 months).** New `GET /sites/{id}/outlook` (contract v1.3.0): 12 monthly entries (temperature, rain, water balance, heat/frost risk) as p10/p50/p90 with unit/basis/confidence, plus `kind: climatology|seasonal_forecast`. Step 1 (required): typical-year outlook from POWER + the engine's water balance, `basis: derived`, labelled "typical year, not a forecast". Step 2 (optional, after step 1 ships): Open-Meteo Seasonal anomalies, verified first.

**B8. Rotation planning support.** With B4's windows, generate rotations from a pool including vegetables/grains/forage/cover crops respecting return intervals, family breaks, legume/cover rules, constraints; keep the existing rotation as index 0. Make farmer-entered `custom_strategies` scored the same way. Return plain-language rule explanations and review flags from the API.

**B9. Chatbot endpoint.** `POST /copilot/chat` (v1.3.0): server-side Groq call (`openai/gpt-oss-120b`) with the snapshot of screen state plus the forecast numbers for that snapshot. Guardrails: plain language, quote on-screen numbers with units/basis, state uncertainty and resolution limits, never give planting orders, always say what to check locally, answer only from supplied data, refuse income/fertilizer. Never return the key; rate-limit; log no secrets. Tests with a stubbed client check prompt contents and guardrails; a real-key smoke test if the Groq key works.

**B10. Custom field analysis (2D view only).** `POST /field/analyze` (v1.3.0): GeoJSON polygon + rotation -> nearest POWER/SoilGrids (live, cached by request hash) -> engine -> same strategy shapes. `data_mode: limited_data`; invalid/huge polygons -> 422; rate-limited.

**B11. Contract v1.3.0.** Bump `packages/contracts/openapi.yaml`, additive only: the three new endpoints above plus rotation-explanation fields and the `kind` field. Fixtures, contract tests, `docs/progress/forecast-requests.md` note, bump `API_VERSION`. **This goes first** so everything else can build against fixtures.

## 7. Frontend workstreams (apps/web)

Reads the engine only through `lib/api`/`lib/forecast`. Every number shows unit, basis, confidence. No income or fertilizer anywhere.

**F1. Engine-fed Future mode.** `lib/farm-future/model.ts` adapter from the real `Forecast` response, replacing synthetic fixtures section by section; keep the "Synthetic demo data" label on anything still unfed.

**F2. UBC and KPU twin.** Promote both farms to twin tier with field lists, colour fields from the year scrubber using per-field trajectories, with a legend.

**F3. 2D bird's-eye view (MapLibre).** "2D Map" toggle (pause Cesium / mount MapLibre and back); north-up first open, fit ~3km x 3km; UBC/KPU raster imagery with attribution; field outlines/popovers; custom-field draw tool -> `POST /field/analyze` -> result card. Non-blocking failure banner if imagery fails.

**F4. Dashboard: extend the farm view.** One comparison view for strategies A/B/C: crop sequence, mechanism badges, review flags, "why suggested", evidence, gaps, local risks. Hero numbers: soil health, net water vs quota, frost-free/heat-stress days. Per-field/whole-farm toggle.

**F5. Timeline and what-if.** Keep the existing bottom timeline (D5). Add a "Next 12 months" tab fed by B7. Keep sliders, debounced refetch, show scenario/source.

**F6. Farm co-pilot.** Slide-over chat wired to screen state; "Ask co-pilot" buttons; inline term tooltips; shows answers come from supplied numbers plus a local-check reminder.

**F7. Crop rotation planner.** Crop pool picker with source-per-trait, constraints form, year-by-season plan grid (existing + 2 alternatives), custom-rotation editor -> `custom_strategies`, rule explanations/role badges/review flags per rotation. No income/fertilizer.

**F8. Labels and Roadmap.** Roadmap tags on unfinished features; Methods and data page listing every dataset with source/licence/attribution, including the narrowed CMIP6 baseline window note.

## 8. Contract and endpoints

v1.3.0 additive: `GET /sites/{siteId}/outlook` (B7), `POST /copilot/chat` (B9), `POST /field/analyze` (B10), rotation-explanation fields on each forecast strategy (B8). Existing endpoints reused for everything else.

## 9. Lanes for parallel sessions

No lane edits another lane's files; cross-lane requests go as a dated note in `docs/progress/forecast-requests.md`.

| Session | Workstreams, in order | Owns |
| --- | --- | --- |
| A, data | B2, B3 | `scripts/seed_appeears/`, `scripts/seed_station/`, `data/seed/*/{ndvi,smap,ecostress,dem,station}.*` |
| B, engine | B1, B6, B4, B8, B5, B7 | `services/api/app/twin/**`, `services/api/app/features/**`, `data/seed/crops/**`, `data/seed/*/cmip6_delta.*`, `scripts/seed_cmip6/**` |
| C, API | B11 first, then B9, B10 | `services/api/app/routers/**`, `services/api/app/services/**` for new endpoints, `packages/contracts/**` |
| Frontend | F1-F8 | `apps/web/**` |

Rules for every session: read `CLAUDE.md` and this PRD first; stop only after the last workstream or a real block; after each workstream run the tests, write `docs/progress/FT-<ID>.md`, `git pull --rebase`, add files by path (never `git add -A`), commit `FT-<ID>: <summary>`, and push. Never print or commit secrets. Never edit `apps/web/` from a backend lane.

## 10. Acceptance criteria

1. **Two farms.** UBC Farm and KPU Langley both open in 3D and 2D. A forecast runs for both (KPU no longer fails).
2. **Real, labelled data.** The UBC forecast uses the six real plots, real POWER weather, SoilGrids soil and the NEX-GDDP-CMIP6 trend (10-year narrowed baseline, labelled as such). Each number shows unit, basis and confidence; absolute estimates show p10 and p90. No income or fertilizer number appears.
3. **Three strategies.** Existing rotation plus two alternatives, with vegetables allowed (B4), compared per field and for the whole farm over years 1 to 10, with review flags, "why suggested", evidence, gaps and local risks.
4. **Crop rotation.** The farmer picks a crop pool (including vegetables), pins or excludes crops, and gets the existing rotation plus at least two alternatives as a 10-year year-by-season plan. A custom rotation can be entered and is scored beside them.
5. **Timeline and sliders.** The year scrubber recolours the fields from engine data. Slider changes refetch and update under 1s (target <300ms cached); scenario and climate source visible.
6. **Monthly outlook.** 12-month view with widening ranges, labelled "typical year" or "seasonal forecast" per source.
7. **2D map.** 2022 aerial imagery with attribution, ~3km x 3km view; ten open/close cycles with no WebGL context loss; custom field draw returns a result card.
8. **Co-pilot.** "Ask co-pilot" opens chat with screen state and returns a plain-language answer quoting on-screen numbers, naming uncertainty, saying what to check locally; no planting orders, no income/fertilizer.
9. **Product rules.** Support sentence on dashboard; Methods and data page lists every dataset incl. licence/attribution and the narrowed CMIP6 window; current rotations read "Current rotation" and are editable; no income/fertilizer anywhere; nothing unfinished shown as working.
10. **Quality gates.** `services/api`, `packages/contracts` and `apps/web` tests, typecheck and lint pass.

## 11. Risks and open items

| # | Item | What settles it |
| --- | --- | --- |
| R1 | AppEEARS needs Earthdata username/password | Arrive with the overnight credentials handoff |
| R2 | Direct LP DAAC reads fail on Windows (certificate chain) | Use AppEEARS (B2); never disable TLS verification |
| R3 | NEX-GDDP-CMIP6 licence disagreement (CC0 vs CC-BY-SA 4.0) | Seed follows the stricter terms; confirm with NCCS post-demo |
| R4 | UBC/KPU current rotations are team-defined; vegetable windows partly unsourced | B4: defined from plot names and public planting guides; editable in the UI (D11) |
| R5 | Engine outputs not calibrated | B5 |
| R6 | UBC POWER cell is 55km, ~565m mean elevation (farm is near sea level) | B3 station bias |
| R7 | Open-Meteo seasonal API horizon/members/licence unverified | Read official docs before step 2 |
| R8 | KPU Langley field boundaries not defined | Choose fields from OpenStreetMap plots like UBC |
| R9 | Chatbot answers are not deterministic and depend on internet access | Guardrails/tests in B9; plain error when Groq unreachable |
| R10 | AppEEARS task queue time is NASA-side and unpredictable | Kick off B2 first thing; accept partial/scaffolded completion if the queue doesn't clear in time |

## 12. References

- Engine and earlier contract: `docs/backend-forecast-prd.md`, `docs/progress/FT-W0.md` to `FT-W10.md`, `docs/progress/FT-FE-ubc.md`.
- NASA NEX-GDDP-CMIP6: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6
- AppEEARS API: https://appeears.earthdatacloud.nasa.gov/api/
- Environment and Climate Change Canada OGC API: https://api.weather.gc.ca/collections/climate-stations
- Open-Meteo seasonal forecast API: https://open-meteo.com/en/docs/seasonal-forecast-api
- MapLibre raster tile source: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-raster-tile-source/
