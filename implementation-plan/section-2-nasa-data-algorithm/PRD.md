# Section 2 PRD: NASA data and the FieldTwin algorithm (v0.3)

> Living document. v0.2 recorded the 2026-11-12 design interview. v0.3 records the 2026-11-13 feature interview (decisions D-23…D-36, feature catalog §4.1). Every decision has an ID (`D-xx`) so prompts, code comments and commits can point to it. Change a decision only by editing its row and adding a change-log entry.

---

## 0. Context capsule (Claude: read this first; it replaces reading anything else)

- **Product:** FieldTwin. A farm becomes a 3D landscape that the user walks around. A NASA-data engine finds *when* and *where* the farm is exposed to harm (wet winters on bare soil, dry spells on sensitive crops) and places a few minimalist, realistic pins and muted zone highlights on the land (D-24). Tapping a pin shows a one-line headline, one action, and "why?" with the numbers and NASA sources. The experience opens on a spinning Earth and flies down to the farm (D-25). Features are listed in §4.1.
- **Challenge:** "Field Shift: Adapting Farms with NASA Data", NASA Space Apps 2026. Statement (as quoted by other teams; re-check on the official page): *"Create a decision-support tool that uses NASA Earth observations along with local soil information, crop characteristics, and farmer priorities to help farmers explore rotation strategies that could strengthen soil health and adapt their farms to changing conditions."* Page: https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/
- **Event:** Sat Nov 14 09:00 to Sun Nov 15 23:59, 2026. **Pre-building data before the event is allowed** (D-03).
- **Section 2 scope:** backend only: data ingestion, the algorithm, and the outputs the UI consumes. Visual design is Section 1's job; this PRD only states what the backend must *give* the UI (§9).
- **Repo state (2026-11-13):**
  - Section 1 restored the contract `packages/contracts/openapi.yaml` **v1.0.0**, its fixtures, and the FastAPI skeleton in `services/api`. Every route serves fixtures via `services/api/app/providers/fixtures.py`. There is no NASA ingestion yet, and `data/seed/` is empty.
  - The web app on `main` has the r3f viewer, water replay, A/B, layers, storm picker, Rotation Lab, Methods page and tour.
  - Branch `fe/S1-cesium-globe` (not merged) adds the Cesium globe, farm pins (`apps/web/lib/farms.ts`) and the Agassiz farm twin.
- **Stack:** Python 3.11+, FastAPI, NumPy, SciPy, rasterio, scikit-image, Shapely, httpx, pytest, `uv` (as in `services/api/pyproject.toml`).
- **Interface rule (D-19, revised by D-31):** `packages/contracts/openapi.yaml` stays the contract. New features go in as the additive **v1.1** described in [`../contract-request-v1.1.md`](../contract-request-v1.1.md). Real data replaces fixtures behind the existing swap points `services/api/app/services/*.py`, and responses must pass `fixtures_lib.contract.validate_response`.
- **Honesty rules (always):** outputs are **relative comparisons and historical odds, never forecasts** (D-04). Every number carries units and a basis label: `measured | derived | modeled | assumed | relative`. Same inputs give same outputs. `OFFLINE=1` serves pre-built data only. Never invent dataset names, URLs, parameters, or constants; mark `TODO(verify)` and record the source URL.

---

## 1. Mission

Turn decades of NASA Earth observations into **the timing and place of risk on one specific farm**, then show the farmer the smallest change that moves the farm out of harm's way.

The idea in one sentence, for judges:

> **A crop rotation can't change the weather, but it changes *when the soil is exposed*. FieldTwin measures, from 45 years of NASA data, *when* this farm's weather is dangerous and *where* on the land water goes, then overlaps that with *when* each rotation leaves the soil bare or the crop vulnerable.**

### Why this wins (and what we deliberately avoid)

Other public repos for this same challenge (§13) almost all build a **weighted score per rotation** (soil / water / resilience / income), stress-tested on a "normal, dry, hot year" preset, mostly from NASA POWER alone. None uses **field terrain**, and none reasons about **the timing overlap of bare soil and hazard**. FieldTwin's originality is that overlap, computed per terrain zone, with each NASA dataset doing a job only it can do.

---

## 2. Owners

| Role | Person | Focus |
| --- | --- | --- |
| S2-A: Data | ___ | Ingestion, caching, fusion (D-07), HLS calendars (D-08), terrain and zones (D-14), backtest data |
| S2-B: Algorithm | ___ | Hazard odds, exposure engine, bootstrap and sensitivity, analog scenarios, optimizer, marker generator |

---

## 3. Decision register (from the design interview)

| ID | Decision | Choice | Why |
| --- | --- | --- | --- |
| D-01 | Core algorithm | **Risk Window Calendar** (§6) | Original, explainable, and fuses NASA time series with field geometry |
| D-02 | Region | **Fraser Valley, BC, Canada first**; other countries later | Owner's target farm; strong local winter-storm story |
| D-03 | Pre-event work | **Allowed**: download, cache, and precompute before the event | Makes the heavy pipeline (HLS, SMAP, bootstrap) feasible |
| D-04 | Output framing | **Relative comparisons and historical odds only**, no forecasts | Defensible; matches "explore strategies"; nothing forecast-like can be validated in 48 h |
| D-05 | Hazards scored | **Both seasons**: winter wet (runoff, erosion, ponding) and summer dry (stress on sensitive crop stages) | Covers "soil health" and "changing conditions"; both are real in the Fraser Valley |
| D-06 | Nitrate leaching | **Stretch goal** using the same winter overlap | Local relevance (Abbotsford–Sumas aquifer, `TODO(verify)`), but not P0 |
| D-07 | Weather record | **Fused**: NASA POWER 1981–present, bias-corrected against GPM IMERG (rain) and SMAP (wetness) in their overlap years | Long record seen through sharper sensors; three NASA datasets, each with a clear reason |
| D-08 | Bare-soil / crop calendar | **Measured** from HLS greenness over real fields of each crop (AAFC crop map); textbook calendar only as a labeled fallback | Upgrades the core input from `assumed` to `measured` |
| D-09 | Hazard thresholds | **Site-relative percentiles** of the fused record | Works anywhere; no invented constants; sensitivity-tested |
| D-10 | Summer weighting | **FAO-56 crop-stage coefficients** weight dry weeks | Published and citable; uses the measured calendar |
| D-11 | Winter vs summer | **Two separate axes**, never one combined score; farmer priority only moves a highlight | Transparent trade-off; satisfies "farmer priorities" honestly |
| D-12 | Uncertainty | **Year bootstrap** giving rank stability, plus one-at-a-time sensitivity | Cheap, honest, easy to explain |
| D-13 | Field Shift scenarios | **Real analog years** reweighted by observed trend, not synthetic scaling | Everything shown is weather that actually happened |
| D-14 | Spatial unit | **Terrain zones**: hydrological sub-units from the DEM, clipped to fields, about 0.5–2 ha | Zones follow water, so highlights look right on the 3D land |
| D-15 | Crop per patch | Curated sites: **AAFC crop map**. User sites: user assigns a crop per field | `measured` where possible, still usable everywhere |
| D-16 | Suggestions | **Optimizer** over a bounded set of feasible farmer changes; results become 💡 markers | The concrete "what should I change" answer |
| D-17 | Non-curated locations | **Lite mode**: live POWER + NASADEM, textbook calendar, no HLS/SMAP/bootstrap, clearly labeled | Shows global reach; full quality stays on pre-built sites |
| D-18 | CSA data | **Stretch**: Canadian Space Agency radar (RADARSAT) for the backtest, after access/license check | Radar sees through winter cloud; CSA is a Space Apps partner |
| D-19 | Interface | ~~No contract file~~ **Superseded by D-31** (keep `openapi.yaml`, extend to v1.1) | Section 1 had already built against v1.0.0 |
| D-20 | UI output form | **Field pins** (§9): 4 kinds, ≤ 5 per view, muted zone highlight + one thin-line pin, active weeks for a 12-month scrubber, numbers only after "why?". Charts and tables allowed only in the side panel (D-28). ~~Hay Day style~~ replaced by D-24 | Minimalist, realistic direction |
| D-21 | Backtest | **Nov 2021 atmospheric river** (Sumas Prairie flooding) | Local, well documented, strong demo and validity evidence |
| D-22 | Curated sites | **1 Fraser Valley farm first** (best quality), then **2 contrasting climates** if time allows (e.g. US Midwest corn–soy; a dry Mediterranean or South Asian site) | Depth first, breadth if time |
| D-23 | Time focus | **Historical first.** Every output is "what happened here, how often, when". Scenarios replay real years (D-13) | Validatable; matches D-04 |
| D-24 | Aesthetic | **Minimalist, realistic, muted.** Not futuristic, cartoony, playful or colorful. Photoreal terrain, earth tones, one restrained risk accent, thin-line pins, low-opacity heat maps. Reference: dark space, thin white type, negative space, slow camera | Owner direction (2026-11-13) |
| D-25 | Hero | **Space-to-farm intro:** Earth drifts into frame → cursor orbits like an astronaut → spinning Earth with farm pins (hover: country + farm) → click: fast fly-in to the farm → bold title (country, locality, farm name) top right, fades → free 3D exploration. Inside the farm: storm replay + living calendar | Memorable opening; on-theme for NASA |
| D-26 | Intro build | Section 1's **real-time Cesium globe and fly-in** (tiers: Google photoreal → Cesium terrain → keyless offline) + **one recorded video** as demo backup. Title font: a freely licensed (OFL) bold, wide, all-caps display font, not the Marvel font | Already built on `fe/S1-cesium-globe`; offline-safe fallback |
| D-27 | Modes | **Explore** (default, ≤ 5 pins), **Weather**, **Plan**, **Learn**. The 3D land is always on screen | Organizes 44 features |
| D-28 | Analytics | Graphs and tables **only in a collapsible side panel**, linked to the 3D view (hover a week → land highlights; click a row → camera flies there) | Owner wants analytics; land stays primary |
| D-29 | Mini-game | **F39 Season challenge** P1; F40 P2 | Teaches "timing beats luck"; reuses the bootstrap |
| D-30 | Feature priorities | As in §4.1 (P0, P1, P2) | Owner sign-off 2026-11-13 |
| D-31 | Contract | Keep `openapi.yaml` v1.0.0; additive **v1.1** per `../contract-request-v1.1.md` | Protects Section 1's working UI |
| D-32 | Waypoints | Curated farm(s) = `tier: twin` (Pre-built); other research-farm pins = `tier: explore` (Lite mode, D-17) | Global reach, honest quality split |
| D-33 | P0 farm | **AAFC Agassiz Research and Development Centre**, Agassiz, BC (49.2482, −121.7637; coordinates approximate, TODO(verify) with AAFC), ~1.4 km simulation square from `fe/S1-cesium-globe` | Public research farm in the Fraser Valley; resolves open item 1 |
| D-34 | Storm library | Top **8** distinct storms by 1–3 day total (≥ 7 days apart, 1981 onward) + the **Nov 2021 atmospheric river**; each card shows rank and antecedent wetness | Real events; local story |
| D-35 | Storm shape | Storms from 2000 onward use the **IMERG half-hourly** shape (`synthetic: false`); older storms keep the assumed profile. Product name TODO(verify) | "The actual storm" on the land |
| D-36 | Backend order | §12: terrain → storms → hazards → calendars + rotations → recommendations + tables → scenarios → Lite + seed + offline. Each step leaves Agassiz working end to end | Real data replaces fixtures one step at a time |

---

## 4. Goals and non-goals

### Goals

- **G1 Use NASA data well:** at least four NASA datasets, each with a one-sentence reason (POWER = the long record; IMERG = storm intensity; SMAP = soil wetness; HLS = the bare-soil calendar; NASADEM = global terrain). Each one is credited in the "why?" layer of the markers.
- **G2 Original method:** the Risk Window Calendar + terrain zones + optimizer, with a `prior-art.md` showing how it differs (§13).
- **G3 Validity:** physical-invariant unit tests, sensitivity table, year-bootstrap stability, and the Nov 2021 backtest with an honest skill score (§10).
- **G4 Actionable:** every farm view yields at most 5 markers, each with a concrete action. At least one 💡 `opportunity` marker comes from the optimizer.
- **G5 Reliable:** deterministic, cached, and fully offline for curated sites. Interactive calls return in < 1 s from precomputed tables; anything heavy is precomputed.
- **G6 Field Shift:** analog-year scenarios that the UI can switch on and replay through the same markers.

### Non-goals (explicit)

- No yield, profit, or absolute soil-loss figures. No forecasts of next season.
- No LLM in the numeric path. (Non-goals continue below the feature catalog.)

### 4.1 Feature catalog (signed off 2026-11-13, D-30)

**How to read this table:**
- **Mode:** Explore, Weather, Plan or Learn (D-27).
- **UI form:** layer = muted heat map on the terrain; pin = thin-line marker; scrubber = 12-month or multi-year slider; panel = side drawer chart or table (D-28); split = A/B view; story = guided sequence.
- **Step:** the backend build step in §12 (D-36); "FE" = frontend-only.
- **Data:** DB-ids from `../Databases.md`.
- **Endpoint:** names refer to contract v1.1 (`../contract-request-v1.1.md`). `layers/x` = `GET /terrain/{id}/layers/x.png`; `insights` = `GET /terrain/{id}/insights`.

**A. Land insights (load automatically with the farm)**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Wetness map (TWI): where water collects | P0 | Explore | layer | DB-1/2 | 1 | `layers/wetness_index` |
| F2 | Drainage paths along the real flow network | P0 | Explore | layer (subtle flow) | DB-1/2 | 1 | `layers/flow_accumulation` |
| F3 | Ponding hollows that fill first | P0 | Explore | layer + pin | DB-1/2 | 1 | `layers/depressions`, `insights` |
| F4 | Erosion-prone slopes (slope-length) | P1 | Explore | layer | DB-1/2 | 1 | `layers/slope` |
| F5 | Seasonal soil moisture, SMAP redistributed by terrain (relative; SMAP is 9 km) | P1 | Explore | layer + scrubber | DB-5 + DB-1 | 5 | `layers/soil_moisture_relative` |
| F6 | Bare-soil calendar per field, measured from HLS | P0 | Explore | scrubber; fields fade to soil when bare | DB-6 | 4 | `/rotations/presets` (cover calendar), `/sites/{id}/zones` |
| F7 | Greenness history per field (NDVI, ~10 years) | P1 | Explore | multi-year scrubber | DB-6 | 4 | v1.2 request when built |
| F8 | Crop map per field and year | P0 | Explore | layer + labels | DB-7 | 4 | `layers/cover_class`, `Zone.crop` |
| F9 | Elevation readout and contours | P2 | Explore | hover + layer | DB-1/2 | 1 | terrain package |

**B. Weather and climate**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F10 | Climate fingerprint: typical year from 45 years | P0 | Weather | panel chart | DB-3 | 3 | `/weather/summary` (`climatology`) |
| F11 | Storm replay of real top storms on the land | P0 | Weather | hero 3D (exists) | DB-3/4 + terrain | 2 | `/weather/storms`, `/simulations` |
| F12 | Hazard calendar: 52-week odds of heavy rain on wet ground and dry spells | P0 | Weather | panel ring → drives scrubber | DB-3/4/5 | 3 | `/sites/{id}/hazard-calendar` |
| F13 | Local hazard catalog: kinds of events, how often, when; tap to replay the worst | P0 | Weather | cards | DB-3/4/5 | 3 | `/sites/{id}/hazards` |
| F14 | Trend panel (wetter winters? drier summers?) with significance | P1 | Weather | panel chart | DB-3 | 3 | `/weather/summary` (`series`) |
| F15 | Nov 2021 atmospheric-river story vs satellite-seen water | P1 | Weather | story | DB-3/4/6/10 | 2 + backtest | `/weather/storms` (`named_event`) |
| F16 | Growing season: frost dates, frost-free days, GDD | P1 | Weather | stat tiles + calendar band | DB-3 | 3 | `/weather/summary` (`climatology.growing_season`) |
| F17 | Water received per zone per year (rain + run-on): where to irrigate | P1 | Explore | layer | DB-3/4 + flow | 5 | `layers/water_received` |

**C. Simulator and scenarios**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F18 | Rotation comparison on two axes (winter wet, summer dry) | P0 | Plan | panel + split | engine | 4 | `/sites/{id}/compare` |
| F19 | Field Shift scenarios (real years reweighted by trend; not a forecast) | P0 | Plan / Weather | scenario switch | engine | 6 | `scenario` param |
| F20 | What-if builder: shift harvest, add cover, delay tillage → live exposure | P1 | Plan | panel controls; zones re-shade | engine | 6 | v1.2 request when built |
| F21 | Year replay: scrub a real year week by week | P1 | Weather | scrubber | DB-3/6 | 4 | v1.2 request when built |
| F22 | A/B split under the same storm, with difference glow | P1 | Plan | split (exists) | engine + F11 | 2 | `/simulations/{id}/diff` |
| F23 | Farmer-priority sliders change what's highlighted, not the numbers | P2 | Plan | panel | engine | 6 | client-side |

**D. Recommendations ("good spot" highlights)**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F24 | Opportunity zones: the one change that helps most here | P0 | Explore | pin + highlight | optimizer | 5 | `insights` (`opportunity`) |
| F25 | Planting suitability: water-tolerant vs drought-tolerant zones | P0 | Explore | layer + per-zone suggestion | terrain + hazard + DB-8 | 5 | `layers/planting_suitability`, `insights` |
| F26 | Irrigation priority: zones that dry first | P1 | Explore | layer | DB-1/3/5 | 5 | `layers/irrigation_priority` |
| F27 | Drainage / buffer-strip advisor along flow paths | P1 | Explore | pin + drawn strip | flow + engine | 5 | `insights` (`opportunity`) |
| F28 | Cover-crop timing: latest protective seeding date | P1 | Plan | calendar band | DB-6 + hazard | 5 | `insights` (`opportunity`, `active_weeks`) |
| F29 | Protected zones (positive feedback) | P0 | Explore | subtle pin | engine | 5 | `insights` (`protected`) |

**E. Analytics (side panel only)**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F30 | Zone table: sortable; row click flies the camera | P0 | Plan | panel table | engine | 5 | `/sites/{id}/zones` |
| F31 | Rotation scorecard with ranges and rank stability | P0 | Plan | panel | bootstrap | 5 | `/sites/{id}/compare` |
| F32 | Confidence panel: which assumptions could flip a result | P1 | Plan | panel | sensitivity | 5 | v1.2 request when built |
| F33 | Farm report export (PDF/CSV) | P2 | Plan | button | all | FE | client-side |
| F34 | Data and Methods page incl. "not used and why" | P0 | Learn | page (exists) | DB-13 | 7 | `/terrain/{id}/provenance` |

**F. Education**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F35 | Guided tour (≤ 90 s) | P0 | Learn | overlay (exists) | — | FE | — |
| F36 | "Why?" on every number: computation + satellite | P0 | all | card | all | every step | evidence / `Source` on every response |
| F37 | How NASA sees your farm: POWER cell, SMAP cell, IMERG grid, HLS pixels at true scale | P1 | Learn | layer | DB-3/4/5/6 | 7 | v1.2 request when built (cell footprints) |
| F38 | Glossary on hover | P2 | all | tooltip | — | FE | — |

**G. Mini-games (realistic, not cartoony)**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F39 | Season challenge: pick a rotation, replay a random real decade, score = soil protected vs baseline | P1 | Learn | panel + 3D replay | bootstrap | 6 | v1.2 request when built |
| F40 | Where will water pool? Guess, then reveal | P2 | Learn | 3D tap + reveal | DB-1 | FE | `layers/wetness_index` |

**H. Reach, and I. Stretch**

| ID | Feature | Pri. | Mode | UI form | Data | Step | Endpoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F41 | Lite mode for any globe pin or dropped pin | P0 | all | `tier: explore` | DB-2/3 | 7 | `POST /lite/...` (v1.2 request) |
| F42 | Compare climates: this farm vs another site | P2 | Plan | split | all | 7 | existing site endpoints |
| F43 | ECOSTRESS summer-stress check | P2 | Learn | panel | DB-9 | 7 | v1.2 request when built |
| F44 | Nitrate-leaching risk | P2 | Explore | layer | engine | 7 | v1.2 request when built |

### 4.2 Non-goals (continued) Any text is template-generated from computed values.
- The land is always primary. Charts and tables live only in the side panel (D-28), never over the 3D view.
- No full hydraulic model. The 3D water replay (if Section 1 keeps it) is visual support, not the ranking engine.
- No computer vision on the farm photo for crop detection (out of scope for 48 h).
- Drone/video capture appear only as Roadmap items.

---

## 5. Data sources

> **Detailed plans live in [`../Databases.md`](../Databases.md)** (v0.1): per dataset, why we need it, how to get it, how to implement it, what it needs, outputs, fallback, and which team owns it. This table is the summary; if the two disagree, fix both and log it. Section 2 owns ingestion (S2-A) and use (S2-B); Section 1 only consumes derived outputs (terrain package, zones, markers, provenance).

**Everything in this table is `TODO(verify)` until S2-01 confirms the product name, version, variables, resolution, coverage, access method, license, and a working sample request (recorded URL).** Values in brackets are what we believe and must check. Rows 1 to 4 and 11 have names and URLs from an unofficial catalog (see `Databases.md`); the official Resources list has not been read yet.

| # | Dataset | Owner | Role in FieldTwin | Variables we need | Believed resolution / coverage | Access (verify) | Basis label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **NASA POWER** daily | NASA | The 45-year backbone record | Precipitation, min/max temperature, root-zone soil wetness [parameter names e.g. `PRECTOTCORR`, `GWETROOT`: verify] | [~0.5° grid; 1981–present] | Public REST API, no login [verify] | measured (reanalysis/satellite-derived) |
| 2 | **GPM IMERG** (Final Run) | NASA | Corrects POWER rain intensity (D-07); real sub-daily storm shape | Precipitation rate | [0.1°, half-hourly; from 2000; latitude band limits: verify Fraser Valley ~49°N is covered] | Earthdata login (GES DISC) [verify] | measured |
| 3 | **SMAP L4** root-zone soil moisture | NASA | Corrects POWER wetness (D-07); defines "wet ground" | Root-zone soil moisture | [9 km, 3-hourly; from 2015] | Earthdata login (NSIDC) [verify] | modeled (assimilated) |
| 4 | **HLS** (Harmonized Landsat Sentinel-2) | NASA | Measured bare-soil and crop-stage calendar (D-08) | Surface reflectance → NDVI, cloud mask (Fmask) | [30 m, ~2–3 day revisit combined; from ~2013–2015] | Earthdata login (LP DAAC), cloud-optimized GeoTIFFs [verify] | measured → derived |
| 5 | **NASADEM** | NASA | Global terrain fallback; Lite mode | Elevation | [1 arc-second ≈ 30 m] | Earthdata login [verify] | measured |
| 6 | **LidarBC** DEM | Province of BC | High-res terrain for the Fraser Valley farm | Bare-earth DEM | [≈1 m where available] | Open download [license: verify Open Government Licence – BC] | measured |
| 7 | **AAFC Annual Crop Inventory** | Agriculture and Agri-Food Canada | Which crop is on which field (D-15); picks HLS sample fields (D-08) | Crop class raster | [30 m, annual] | Open download [license: verify Open Government Licence – Canada] | measured (classified) |
| 8 | **FAO-56** crop coefficients | FAO (publication) | Summer stage weights (D-10) | Kc_ini, Kc_mid, Kc_end; stage lengths | Table values | FAO Irrigation and Drainage Paper 56 [cite exact table] | assumed (published) |
| 9 | **RADARSAT Constellation Mission** (stretch, D-18) | Canadian Space Agency | Flood/saturation map for the Nov 2021 backtest | SAR backscatter | [verify] | [verify open access and license] | measured |
| 10 | **Soil texture / hydrologic group** | [BC Soil Information Finder or SoilGrids: verify] | Optional modifier of the terrain factor | Texture class | [verify] | [verify] | measured / assumed |
| 11 | **ECOSTRESS evapotranspiration** (P2, optional) | NASA | Independent check on the summer-dry axis; never feeds a score | Evapotranspiration (`ECO_L3T_JET` V003) | [~70 m, irregular ISS passes] | Earthdata login (LP DAAC) | measured |

Decisions recorded from the data review (2026-11-13):
- **SMAP product (open):** row 3 assumes L4 root-zone moisture, but the challenge catalog lists L3 enhanced `SPL3SMP_E` (surface moisture). Root zone is what matters for runoff and crop stress. Default L4; fall back to L3 with the caveat "surface moisture used as a proxy". Decide in S2-01.
- **Not used:** NASA GRACE/GRACE-FO (monthly, hundreds of km, no farm-scale signal), crop-yield data (forbidden by D-04 and the non-goals), disaster-event catalogs (hazard odds come from our own fused record plus the Nov 2021 backtest). Reasons in `Databases.md` §4.

Rules:
- NASA data must do the core work (POWER, IMERG, SMAP, HLS, NASADEM). Non-NASA sources (6–10) are labeled and licensed in the UI's data credits.
- Earthdata credentials live in `.env` (never committed); `.env.example` lists the variable names only.
- Imagery is only redistributed in `data/seed/` if its license allows it; otherwise we ship derived products (e.g. weekly bare-fraction tables) only.
- The official 2026 challenge **Resources** list must be read and copied into `data-sources.md` during S2-01. Any dataset NASA lists there that fits a role above should be preferred.

---

## 6. The algorithm: Risk Window Calendar

### 6.1 Concept

For each **rotation** `r`, each **terrain zone** `z`, and each **week of the year** `w` (52 weeks; weeks wrap around New Year so a Fraser Valley winter is continuous):

```
WinterExposure(r, z) = Σ_w  Bare_r(w) · J_wet(w) · T(z)
SummerExposure(r, z) = Σ_w  Sens_r(w) · J_dry(w) · M(z)        (M(z) = 1 in P0)
```

| Term | Meaning | Source | Basis |
| --- | --- | --- | --- |
| `Bare_r(w)` ∈ [0,1] | Fraction of fields of the crop(s) in rotation `r` that are bare in week `w` | HLS NDVI over AAFC fields (§6.3) | measured / derived |
| `Sens_r(w)` ∈ [0,1] | How water-sensitive the crop is in week `w` (0 when nothing is planted) | FAO-56 Kc curve placed on the measured calendar (§6.5) | assumed (published) |
| `J_wet(w)` ∈ [0,1] | **Joint** historical frequency: fraction of years in which week `w` had a heavy-rain day **while** the root zone was wet | Fused record (§6.2) | derived |
| `J_dry(w)` ∈ [0,1] | Fraction of years in which week `w` fell inside a dry spell | Fused record | derived |
| `T(z)` | Relative terrain factor of zone `z` (mean 1 over the field) | DEM (§6.4) | relative |
| `M(z)` | Terrain moisture modifier for the dry side (stretch: convex, well-drained zones dry first) | DEM | relative |

**Important design detail:** `J_wet` is the *joint* frequency counted directly from the record, **not** `P(storm) × P(wet)`. Heavy rain and wet soil are correlated (storms wet the soil), so multiplying them would underestimate the hazard. Counting both conditions in the same week, year by year, keeps the dependence.

The 52-week products are kept, not only their sums. They **are** the calendar: per-week contributions drive the markers' `active_weeks` (§9) and the 12-month scrubber.

### 6.2 Hazard odds from the fused record (D-07, D-09)

1. **Download** POWER daily for the site (1981–present), IMERG for 2000–present, and SMAP L4 for 2015–present. Cache them raw in `data/cache/` (gitignored).
2. **Bias-correct rain:** aggregate IMERG to daily totals over the POWER cell footprint. Over the overlap years, fit **empirical quantile mapping** POWER→IMERG, per season (DJF, MAM, JJA, SON) to respect seasonality. Apply it to all POWER years. This corrects the coarse grid's tendency to smear heavy rain. Note the limit: quantile mapping fixes the *distribution* of daily totals, not timing.
3. **Bias-correct wetness:** same method, POWER root-zone wetness → SMAP L4 root-zone moisture percentiles, overlap 2015–present.
4. **Thresholds as site percentiles (D-09):**
   - heavy-rain day: daily rain ≥ `q_rain` percentile of wet days (default 95th: assumed, sensitivity-tested);
   - wet ground: root-zone wetness ≥ `q_wet` percentile (default 80th);
   - dry spell: ≥ `n_dry` consecutive days with rain below `q_dryrain` and wetness ≤ `q_drywet` percentile (defaults 14 days, 20th percentile: assumed).
5. **Count:** for each year `y` and week `w`, flag `wet_hit(y,w)` and `dry_hit(y,w)`. Then `J_wet(w) = mean_y wet_hit(y,w)`, and the same for `J_dry`.
6. **Smooth** across neighbouring weeks with a small circular kernel (±1 week) so a calendar doesn't flicker on sampling noise. The kernel width is recorded and sensitivity-tested.

Outputs: `hazard.json` per site with `J_wet[52]`, `J_dry[52]`, per-year hit matrices (for the bootstrap), thresholds used, and the overlap-period fit diagnostics (before/after error vs IMERG/SMAP).

### 6.3 Measured crop calendar from HLS (D-08)

1. From the AAFC Annual Crop Inventory, select up to N fields per crop class near the site (same climate), several years each.
2. Build an NDVI time series per field from HLS, masking cloud/shadow/snow with the product's quality layer.
3. **Fraser Valley winter is very cloudy:** expect gaps. Composite the series by **week of year across years** (median), and interpolate the remaining gaps linearly in time. Report the number of valid observations behind every week.
4. `Bare_crop(w)` = fraction of field-years with NDVI < `τ_bare` in week `w` (default threshold: `TODO(verify)` from literature; sensitivity-tested).
5. Derive the stage dates (green-up, peak, senescence, harvest) per crop from the median curve. These place the FAO-56 stages (§6.5).
6. **Fallback:** a crop with too few valid fields/observations uses a textbook calendar, labeled `assumed`, and the marker's "why?" says so.
7. **Rotation calendars:** a rotation is a sequence of crop seasons (incl. winter cover crop or fallow). `Bare_r(w)` combines its crops' calendars across the rotation's years (average over the rotation cycle, so a 3-year rotation scores each year's exposure).

### 6.4 Terrain zones and terrain factor (D-14)

1. **DEM:** LidarBC for the Fraser Valley farm (resampled to ~2–5 m), NASADEM elsewhere and in Lite mode.
2. **Hydrology:** fill depressions (priority-flood), D8 flow direction, flow accumulation, slope, and topographic wetness index `TWI = ln(a / tan β)`.
3. **Zones:** delineate small sub-catchments by placing pour points along the flow network at a target contributing area, then clip to field boundaries. Merge slivers below a minimum area. Target zone size is 0.5–2 ha.
4. **Terrain factor `T(z)`:** a relative index combining the zone's mean TWI (where water collects and ponds) and a slope–length term (where flowing water erodes), each rank-normalized within the field, and scaled so the field mean = 1. Weights are documented and sensitivity-tested. Label: `relative`.
5. **Icon point:** for each zone, the **pole of inaccessibility** (the interior point farthest from the edge), so icons never float outside odd-shaped zones.
6. **Outline:** a simplified zone polygon (GeoJSON, lon/lat) for the UI highlight.

Prior-art note: TWI-based wetness redistribution is established science, so we present it as a technique we use, not our invention.

### 6.5 Summer sensitivity (D-10)

- Place the FAO-56 stages (initial, development, mid-season, late) on each crop's **measured** calendar dates (§6.3).
- `Sens_r(w)` = Kc in week `w` normalized to the crop's Kc_mid (so peak water demand ≈ 1). This is 0 when no crop is in the ground.
- Kc values come from FAO-56 tables with the table/row cited in code. Crops not in FAO-56 are marked `assumed` with a stated proxy crop.

### 6.6 Uncertainty: year bootstrap and sensitivity (D-12)

- **Year bootstrap:** resample whole years (with replacement) from the per-year hit matrices, `B` = 1000 times (assumed; fixed random seed), and recompute exposures for every rotation and zone.
- **Rank stability:** for each pair of rotations, the share of resamples in which one has lower exposure. This yields statements like *"Rotation B has lower winter exposure than A in 91% of resampled histories."*
- **Ranges:** the 10th–90th percentile of each exposure across resamples.
- **Sensitivity (one at a time):** vary `q_rain`, `q_wet`, `n_dry`, `τ_bare`, smoothing width, and terrain-factor weights across stated ranges. Report which assumption flips a ranking, if any. The output is `sensitivity.json` plus a short table in `algorithm.md`.
- **Determinism:** seeds are derived from a hash of the inputs, so the same inputs give byte-identical outputs.

### 6.7 Field Shift scenarios: analog years (D-13)

1. Per year, compute two indices: `wet_index(y)` = count of `wet_hit` weeks; `dry_index(y)` = count of `dry_hit` weeks.
2. Fit a Theil–Sen trend to each index over 1981–present, with a confidence interval.
3. **Scenario "more like recent trend":** reweight years in the bootstrap so their index distribution is shifted along the trend, extrapolated a stated number of years (e.g. +10 years, assumed), using importance weights. Nothing is synthesized; we only **replay real years more often**.
4. Named scenarios: `baseline`, `wetter_winters`, `drier_summers`, `both`. Each is labeled *"Scenario built from observed years (1981–present), not a forecast."*
5. If a trend is not significant, the scenario still runs but says so ("trend not significant at this site").

### 6.8 Suggestion optimizer (D-16)

- **Search space:** a small, bounded set of changes a farmer can actually make, per field or zone:
  - shift harvest date by −2, −1, +1, +2 weeks (within the crop's measured feasible window);
  - shift planting date by ±1, ±2 weeks;
  - add a winter cover crop seeded by a given date (options from the measured cover-crop calendar or a labeled assumed calendar);
  - delay fall tillage to spring;
  - convert a zone to permanent grass / vegetated buffer (zone-level only; flagged as a bigger change).
- **Evaluation:** every candidate re-runs the calendar sums. These are vector products over 52 weeks, so even hundreds of candidates take milliseconds.
- **Selection:** keep candidates that are **Pareto improvements** (winter exposure down without summer exposure rising beyond a tolerance, and vice versa). Rank them by relative reduction × zone area. A candidate is only shown if its rank stability under the bootstrap is ≥ 80% (assumed).
- **Output:** the best candidate per zone becomes an `opportunity` marker, e.g. *"Seed a cover crop by Oct 1 → −48% winter exposure here."*

### 6.9 Lite mode (D-17)

For any location without pre-built data: live NASA POWER (no fusion), NASADEM terrain and zones, a textbook crop calendar (`assumed`), percentile thresholds, no bootstrap (no rank-stability line), and the same marker output. Every Lite marker's "why?" includes *"Lite mode: fewer data sources."* Lite must return within the interactive budget, so POWER responses are cached by location.

---

## 7. Marker generation (bridge from algorithm to UI)

1. For each zone and rotation, compute `WinterExposure`, `SummerExposure`, ranges, rank stability, and the best optimizer candidate.
2. **Classify** each zone:
   - `winter_wet` ⚠️: winter exposure in the top tier for this field (relative), with a robust ranking.
   - `summer_dry` 🌵: summer exposure in the top tier.
   - `opportunity` 💡: a robust Pareto-improving change exists.
   - `protected` ✅: low exposure on both axes, *and* it's due to the current practice (e.g. the cover crop is already in place). This gives positive feedback.
3. **Merge** neighbouring zones of the same kind into one marker (union outline; icon at the union's pole of inaccessibility).
4. **Score** each marker: `severity (1–5) × zone area × fixability` (fixability = the best candidate's relative reduction; 0 for `protected`).
5. **Cap:** return the top 5 by score for the current view. "Show all" returns the full list.
6. **Active weeks:** the weeks whose contribution to that zone's exposure is above a share of its total (e.g. weeks covering 80% of the sum), so markers appear and fade with the 12-month scrubber.
7. **Text:** template-generated, no LLM. Headline ≤ 60 characters, one action sentence, plus the "why?" payload (§9.2). Templates avoid absolute guarantees ("lower relative exposure", never "prevents erosion") and always carry the line *"This tool supports, and does not replace, local agronomic expertise."* in the farm view.

---

## 8. Pipeline, compute, and storage

```
pre-event (offline batch, per curated site)            event / runtime
──────────────────────────────────────────             ────────────────────────────────
ingest_power ─┐                                         GET markers(site, rotation, scenario, week?)
ingest_imerg ─┼─► fuse ─► hazard.json ─┐                  → lookup precomputed tables
ingest_smap  ─┘                        │                  → (optional) optimizer re-rank
ingest_hls + aafc ─► calendars.json ───┼─► exposure ─►    → markers JSON (≤ 5)
dem ─► hydrology ─► zones.geojson ─────┘   bootstrap
                                           scenarios
                                           optimizer ─► data/seed/<site>/*.json
```

- **Proposed module layout** (`services/api/app/`): `ingest/` (one module per source; httpx; cache-first), `fusion/`, `calendar/`, `terrain/`, `engine/` (hazard, exposure, bootstrap, scenarios, optimizer), `markers/`. Routes stay in the existing `routers/`; services in the existing `services/*.py` call the new modules and return shapes that pass `fixtures_lib.contract.validate_response` (D-31).
- **Engine purity:** `engine/` and `markers/` take arrays and return arrays/models. No network, no file I/O, no clock, no LLM. Unit tests run in milliseconds.
- **Caching:** raw downloads in `data/cache/` (gitignored); derived, license-safe tables in `data/seed/<site_id>/` (committed): `hazard.json`, `calendars.json`, `zones.geojson`, `exposure.json`, `bootstrap.json`, `scenarios.json`, `optimizer.json`, `provenance.json`.
- **OFFLINE=1:** ingest modules refuse network calls and read `data/seed/` only. A test enforces it (network blocked → curated site still returns markers).
- **Budget:** runtime endpoints < 1 s (table lookups). The bootstrap (1000 × rotations × zones × 52) is precomputed and stored as summary statistics, not raw samples.

---

## 9. What Section 2 gives Section 1

### 9.1 UI direction the backend must support (owner's words, summarized; D-24…D-28)

- The experience opens in space: a spinning Earth with farm pins. Hovering a pin shows the country and farm; clicking it flies down to the farm, and a bold title (country, locality, farm name) fades in and out. The backend supplies the pin data through `Site` v1.1 (`country`, `locality`, `owner`, `location`, `tier`, `sim_bbox`).
- The user **moves around the 3D farm**. Based on the land, the crops and the algorithm's findings, **minimalist, realistic pins** appear and zones are softly highlighted. The style is muted earth tones with one restrained risk accent: not cartoony, playful or colorful.
- **Four modes** (D-27): Explore, Weather, Plan, Learn. Charts and tables appear only in the side panel (D-28), linked to the 3D view.
- **Icons are a Section 1 design task.** The backend only sends `kind`.

### 9.2 What the backend returns (contract v1.1, D-31)

The exact schema changes are in [`../contract-request-v1.1.md`](../contract-request-v1.1.md). In summary:

- **Pins** reuse the existing `Insight` schema with new kinds `winter_wet`, `summer_dry`, `opportunity`, `protected`, plus optional `action`, `zone_ids`, `active_weeks`, `scenario`. Its `why_it_matters`, `data_refs`, `confidence` and the evidence bundle carry the "why?" layer: metric, value, units, basis, comparison, rank stability, sources, caveats.
- **Zones** (`Zone`): outline, icon point (pole of inaccessibility), area, terrain factor, crop, winter and summer exposure (relative).
- **Hazards:** `HazardCalendar` (`j_wet[52]`, `j_dry[52]`, thresholds, caveats) and `HazardCatalog` (event kinds, years with event out of years total, peak weeks, worst storm to replay).
- **Rotation comparison** (`RotationComparison`): two axes per rotation with p10–p90 ranges and rank stability (null in Lite).
- **Storms:** existing `Storm` plus `rank`, `rank_of`, `named_event`. `hyetograph.synthetic: false` applies when the IMERG half-hourly shape is used (D-35).
- **Layers:** existing `LayerName` widened with `wetness_index`, `planting_suitability` (P0), and `soil_moisture_relative`, `irrigation_priority`, `water_received` (P1).
- **Scenario:** optional `scenario` on `SimulationRequest`, `hazard-calendar` and `compare` (`baseline | wetter_winters | drier_summers | both`).

Marker generation (§7) maps onto `Insight`: headline → `title` (≤ 60 characters), action → `action`, severity → `severity`, icon point → `anchor` (with `at_time_min: null`).

### 9.3 Endpoints (existing v1.0.0 + v1.1 additions)

| Endpoint | Status | Returns | Features |
| --- | --- | --- | --- |
| `GET /sites`, `GET /sites/{id}` | exists; v1.1 fields | Curated (`tier: twin`) and explore sites | Globe pins, title card |
| `GET /terrain/{id}` + `heightmap.png`, `normal.png`, `texture.jpg` | exists | Terrain package from LidarBC or NASADEM | 3D land |
| `GET /terrain/{id}/layers`, `/layers/{name}.png` | exists; v1.1 layer names | Layer PNGs and legends | F1–F5, F17, F25, F26 |
| `GET /terrain/{id}/insights` | exists; v1.1 kinds | Pins (≤ 5 by default) | F3, F24, F25, F27–F29 |
| `GET /terrain/{id}/provenance` | exists | Every dataset with source, license, attribution | F34, F36 |
| `GET /weather/summary` | exists; v1.1 `climatology` | Climate fingerprint, trends, growing season | F10, F14, F16 |
| `GET /weather/storms` | exists; v1.1 fields | Storm library (D-34) | F11, F13, F15 |
| `POST /simulations`, frames, risk, evidence, diff | exists; v1.1 `scenario` | Storm replay per rotation | F11, F19, F22 |
| `GET /rotations/presets`, `POST /rotations/validate` | exists | Rotations and cover calendars | F6, F18 |
| `GET /sites/{id}/hazard-calendar` | **new** | `HazardCalendar` | F12 |
| `GET /sites/{id}/hazards` | **new** | `HazardCatalog` | F13 |
| `GET /sites/{id}/zones` | **new** | `ZoneCollection` | F1, F25, F26, F30 |
| `GET /sites/{id}/compare` | **new** | `RotationComparison` | F18, F31 |
| Lite mode, what-if builder, year replay, season challenge, NDVI history, cell footprints | later (v1.2) | — | F7, F20, F21, F37, F39, F41 |

### 9.4 Interface rules

- The integrator applies contract changes (see `../README.md`). Section 2 never edits `openapi.yaml`; it writes a request like `../contract-request-v1.1.md`.
- Every real response must pass `fixtures_lib.contract.validate_response`. Real data replaces fixtures behind `services/api/app/services/*.py`, one service at a time (D-36).
- Fixtures for every new schema land with the contract change, so Section 1 can build before real data exists.
- Section 1 must handle unknown enum values (new `Insight.kind`, `LayerName`) gracefully.

---

## 10. Validation

| Check | How | Pass condition |
| --- | --- | --- |
| Invariants | Unit tests | Zero bare weeks → zero winter exposure; adding cover never raises winter exposure; raising `q_rain` never raises `J_wet`; exposures are non-negative; results are deterministic for the same inputs |
| Fusion quality | Overlap-period diagnostics | After quantile mapping, POWER's heavy-rain percentiles match IMERG's within a stated tolerance; report before/after |
| Calendar sanity | HLS vs known crop timing | Median green-up/harvest weeks fall inside agronomic windows for the Fraser Valley `TODO(verify)` source |
| Terrain sanity | Synthetic DEMs (tilted plane, bowl, ridge–valley) + curated site | Highest `T(z)` sits in valleys and concave hollows; zones follow drainage |
| Bootstrap | Repeated runs | Same seed → identical results; ranges reported |
| Sensitivity | One-at-a-time sweep | Table lists which assumption, if any, flips a rotation ranking |
| **Backtest (D-21)** | Nov 2021 atmospheric river (dates `TODO(verify)`) | Compare zones flagged `winter_wet` with satellite-observed flooded or saturated areas right after the event (HLS water index where cloud allows; SMAP change; RADARSAT if D-18 lands). Report hit rate and IoU **against an area-matched random baseline**, even if the skill is modest |

Honesty about the backtest: a fair test is one where our method beats a random selection of the same area. We report the number as is, with its limits (cloud cover, resolution mismatch, flood water vs saturation).

---

## 11. Curated sites (D-22)

| Site | Status | Terrain | Crops | Notes |
| --- | --- | --- | --- | --- |
| **Agassiz Research and Development Centre** (AAFC), Agassiz, BC (D-33) | **P0, build first** (`tier: twin`) | LidarBC (coverage TODO(verify)), NASADEM fallback | AAFC crop map; Section 1's illustrative OSM field layout until real crops exist | Simulation square `[-121.77543, 49.24461, -121.75617, 49.25719]` (~1.4 km), from `fe/S1-cesium-globe` `lib/twin/agassiz.ts`. Coordinates approximate (geocoded). Nov 2021 backtest: Agassiz is ~30 km east of Sumas Prairie, so check whether the event's flooding reached this square; if not, run the backtest on a Sumas Prairie square with the same pipeline (TODO(verify)) |
| Contrasting site 2 | P1 (time permitting) | NASADEM / local open LiDAR | Local crop map or user-assigned | Pick from the 7 research-farm pins on the globe |
| Contrasting site 3 | P1 (time permitting) | NASADEM | User-assigned | As above |
| 7 research-farm pins (IRRI Los Baños, ICRISAT Hyderabad, Rothamsted, …) | Lite mode (`tier: explore`, D-32) | NASADEM | User-assigned or textbook | Facts and sources in `apps/web/lib/farms.ts` on `fe/S1-cesium-globe`; they move into `GET /sites` in v1.1 |

Each curated site shows a "Pre-built" badge in the UI.

---

## 12. Plan (pre-event → event)

**Build order (D-36).** Each step ends with Agassiz working end to end on real data so far, while every other route keeps serving fixtures.

| Step | Delivers | Features unlocked | Prompt |
| --- | --- | --- | --- |
| 0 | Verify data, accounts, contract request sent | — | S2-01, S2-02 |
| 1 | Real terrain (LidarBC/NASADEM) + layers | F1–F4, F9 | S2-03 |
| 2 | Real storm library (POWER + IMERG), real storm replay | F11, F15, F22 | S2-04, S2-05 |
| 3 | Fusion, hazard calendar, hazard catalog, climate fingerprint | F10, F12–F14, F16 | S2-06 |
| 4 | HLS + AAFC calendars, rotation comparison | F6–F8, F18, F21 | S2-07, S2-08 |
| 5 | Zones, optimizer pins, suitability layers, zone table, scorecard | F5, F17, F24–F32 | S2-09 |
| 6 | Field Shift scenarios | F19, F20, F23, F39 | S2-10 |
| 7 | Backtest, Lite mode, seed, offline, provenance, write-up | F34, F41, F42 | S2-11, S2-12 |

| When | S2-A (Data) | S2-B (Algorithm) |
| --- | --- | --- |
| Pre-event, day −2 | Step 0; step 1 | Contract request; engine skeleton with invariant tests |
| Pre-event, day −1 | Step 2 downloads (POWER, IMERG, SMAP); HLS + AAFC downloads | Steps 2–3 |
| Event, Sat AM | Step 4 calendars | Step 4 compare; step 5 |
| Event, Sat PM | `data/seed/agassiz/`; OFFLINE test | Step 5 done; Section 1 swaps Agassiz to live |
| Event, Sun AM | Step 7: backtest data, Lite mode | Step 6; sensitivity table |
| Event, Sun PM | Sites 2–3 if time; provenance | Write-up; freeze by Sun 21:00 |

`Prompts.md` follows this order (S2-01…S2-12). Each data task maps to a `../Databases.md` section (DB-1…DB-14).

---

## 13. Prior art (to be expanded into `prior-art.md` in S2-01)

| Project | What it does | How we differ |
| --- | --- | --- |
| [BlinkFarms](https://github.com/umar-essayed/BlinkFarms-NASA-SpaceApps) | Flash-drought detection (ECOSTRESS, SMAP), TOPSIS rotation ranking | No terrain; no bare-soil timing; we score both seasons per zone |
| [FarmStack](https://github.com/anirban-islam/farmstack) | Multi-objective rotation simulator, soil health index | Generic scoring; we use measured calendars and joint hazard odds |
| [Space2Earth](https://github.com/shahkhalid030056-prog/space2earth-field-shift) | POWER-only rotation and climate-risk explorer, what-if sliders | We fuse four NASA datasets and work per terrain zone |
| [ALBOU517/Field-Shift](https://github.com/ALBOU517/Field-Shift) | Enumerates 1–4 year cycles, 5 weighted scores, normal/dry/hot stress test (data partly fictional) | Real data only; analog years instead of presets; spatial markers |
| [divyabharathi-r-code/Field-Shift](https://github.com/divyabharathi-r-code/Field-Shift) | Rotation ranking with robustness under shifting priorities | No terrain or calendar overlap; ours is spatial and time-resolved |

Established methods we use but do not claim: quantile-mapping bias correction, TWI, FAO-56 Kc curves, bootstrap resampling, Theil–Sen trends.

**What is ours:** the joint bare-soil × hazard calendar per terrain zone, measured from HLS over crop-mapped fields; the analog-year Field Shift reweighting; and the bounded Pareto optimizer that turns it all into ≤ 5 map markers.

---

## 14. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Earthdata access or download speed | Blocks IMERG/SMAP/HLS | Pre-event download (D-03); POWER-only fallback labeled "Lite" |
| Winter cloud gaps in HLS (Fraser Valley) | Weak winter calendar | Multi-year weekly median; report observations per week; textbook fallback |
| AAFC classes lack cover crops | `Bare_r` for cover-crop rotations is assumed | Label `assumed`; check whether any class or local study covers it |
| IMERG latitude coverage near 49°N | Fusion fails | Verify early; else fuse rain to POWER only and say so |
| Backtest shows low skill | Weaker validity story | Report honestly vs a random baseline; explain limits |
| Contract v1.1 not applied in time (D-31) | Section 1 can't show new features | Send the request on day −2; fixtures land with the change; v1.0.0 routes keep working meanwhile |
| Globe branch not merged / Google tiles need network and a key | Intro fails at the venue | Tier fallback to the keyless offline globe; recorded backup video (D-26) |
| Time | Sites 2–3 missing | Depth first (D-22); Lite mode still shows global reach |

---

## 15. Open items

| # | Item | Owner |
| --- | --- | --- |
| 1 | ~~Pick the exact Fraser Valley farm~~ Agassiz (D-33). Still to verify: farm centre and extent with AAFC; LidarBC coverage of the square | S2-A |
| 2 | Read and record the official 2026 Resources list for the challenge | S2-A |
| 3 | Verify every row in §5 (names, variables, coverage, access, license, sample request) | S2-A |
| 4 | Confirm Nov 2021 event dates and an observation source for the backtest | S2-A |
| 5 | Check CSA RADARSAT open access/license (D-18) | S2-A |
| 6 | Choose `τ_bare`, default percentiles, and smoothing width from literature; record sources | S2-B |
| 7 | Define the 3 curated Fraser Valley rotations with the owner (e.g. silage corn with/without winter cover; perennial grass) | S2-B + owner |
| 8 | Apply `../contract-request-v1.1.md` to `openapi.yaml`, fixtures and types; announce | Integrator |
| 9 | ~~Rewrite `Prompts.md` for v0.2~~ Done 2026-11-13 (see `Databases.md` for the data tasks) | S2-B |
| 10 | Fill in owners (§2) | Team |
| 11 | Decide SMAP L4 vs L3 (`Databases.md` DB-5) | S2-A + S2-B |
| 12 | ~~New `GET /sites/{id}/terrain`~~ Use the existing `GET /terrain/{id}` package (v1.0.0). Agree grid size for the 1.4 km square with S1-A, and how the terrain drapes on Cesium | S2-A + S1-A |
| 13 | Create Earthdata accounts for everyone and test one download each | Everyone |
| 14 | Verify the IMERG half-hourly product name and access (D-35) | S2-A |
| 15 | Check that the Nov 2021 flooding reached the Agassiz square, or pick a Sumas Prairie backtest square | S2-A |

---

## 16. Change log

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-12 | Claude | v0.1 draft created |
| 2026-11-12 | Claude + product owner | v0.2: design interview decisions D-01…D-22; Risk Window Calendar spec; data table; marker output; validation incl. Nov 2021 backtest; prior art; plan |
| 2026-11-13 | Claude + product owner | v0.2.1: added `../Databases.md` as the detailed data plan; ECOSTRESS row (P2); SMAP L4 vs L3 open decision; GRACE, yield and disaster data recorded as not used; proposed `GET /sites/{id}/terrain`; `/provenance` tied to `Databases.md`; `Prompts.md` rewritten |
| 2026-11-13 | Claude + product owner | v0.3: feature interview. Decisions D-23…D-36 (historical first, realistic aesthetic, space-to-farm hero on Cesium, four modes, side-panel analytics, mini-game, contract v1.1 replacing D-19, Agassiz as P0 farm, storm library and IMERG half-hourly shape, build order). Feature catalog §4.1 (F1–F44 with priority, mode, UI form, data, step, endpoint). §9 rewritten around contract v1.1 (`../contract-request-v1.1.md`). §11 Agassiz + Lite pins. §12 build order. Risks and open items updated |
