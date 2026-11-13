# Section 2 PRD: NASA data and the FieldTwin algorithm (v0.2)

> Living document. v0.2 records the design agreed in the 2026-11-12 design interview ("grilling" session) with the product owner. Every decision below has an ID (`D-xx`) so prompts, code comments and commits can point to it. Change a decision only by editing its row and adding a change-log entry.

---

## 0. Context capsule (Claude: read this first; it replaces reading anything else)

- **Product:** FieldTwin. A farm becomes a 3D landscape that the user walks around. A NASA-data engine finds *when* and *where* the farm is exposed to harm (wet winters on bare soil, dry spells on sensitive crops) and places a few minimalist, game-style markers on the land (Hay Day / Clash of Clans feel, SaaS look). Tapping a marker shows a one-line headline, one action, and "why?" with the numbers and NASA sources.
- **Challenge:** "Field Shift: Adapting Farms with NASA Data", NASA Space Apps 2026. Statement (as quoted by other teams; re-check on the official page): *"Create a decision-support tool that uses NASA Earth observations along with local soil information, crop characteristics, and farmer priorities to help farmers explore rotation strategies that could strengthen soil health and adapt their farms to changing conditions."* Page: https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/
- **Event:** Sat Nov 14 09:00 to Sun Nov 15 23:59, 2026. **Pre-building data before the event is allowed** (D-03).
- **Section 2 scope:** backend only: data ingestion, the algorithm, and the outputs the UI consumes. Visual design is Section 1's job; this PRD only states what the backend must *give* the UI (§9).
- **Repo state (2026-11-12):** the "revamped repo" commit removed the old code, `CLAUDE.md`, root `prd.md`, and `packages/contracts/`. The repo now contains only `implementation-plan/`. The old FastAPI skeleton and fixtures can still be read in git history (`git show e83a93c:<path>`), but nothing depends on them.
- **Stack (proposed, unchanged):** Python 3.12+, FastAPI, Pydantic v2, NumPy, SciPy, rasterio, scikit-image, Shapely, httpx, pytest, `uv`.
- **Interface rule (D-19):** there is **no hand-written contract file**. Pydantic response models in `services/api` are the source of truth; FastAPI publishes `/openapi.json`; Section 1 generates TypeScript types from it.
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
| D-19 | Interface | **No contract file.** Pydantic models are the contract, exported via FastAPI `/openapi.json` | Speed, while still catching mismatches at type-check |
| D-20 | UI output form | **Field markers**, not dashboards (§9): 4 kinds, ≤ 5 per view, zone highlight + one icon, active weeks for a 12-month scrubber, numbers only after "why?" | Owner's Hay Day-style, minimalist SaaS direction |
| D-21 | Backtest | **Nov 2021 atmospheric river** (Sumas Prairie flooding) | Local, well documented, strong demo and validity evidence |
| D-22 | Curated sites | **1 Fraser Valley farm first** (best quality), then **2 contrasting climates** if time allows (e.g. US Midwest corn–soy; a dry Mediterranean or South Asian site) | Depth first, breadth if time |

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
- No LLM in the numeric path. Any text is template-generated from computed values.
- No dashboard of charts. Charts may exist only behind "why?", if at all.
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

- **Proposed module layout** (`services/api/app/`): `ingest/` (one module per source; httpx; cache-first), `fusion/`, `calendar/`, `terrain/`, `engine/` (hazard, exposure, bootstrap, scenarios, optimizer), `markers/`, `models/` (Pydantic, the contract per D-19), `routes/`.
- **Engine purity:** `engine/` and `markers/` take arrays and return arrays/models. No network, no file I/O, no clock, no LLM. Unit tests run in milliseconds.
- **Caching:** raw downloads in `data/cache/` (gitignored); derived, license-safe tables in `data/seed/<site_id>/` (committed): `hazard.json`, `calendars.json`, `zones.geojson`, `exposure.json`, `bootstrap.json`, `scenarios.json`, `optimizer.json`, `provenance.json`.
- **OFFLINE=1:** ingest modules refuse network calls and read `data/seed/` only. A test enforces it (network blocked → curated site still returns markers).
- **Budget:** runtime endpoints < 1 s (table lookups). The bootstrap (1000 × rotations × zones × 52) is precomputed and stored as summary statistics, not raw samples.

---

## 9. What Section 2 gives Section 1

### 9.1 UI direction the backend must support (owner's words, summarized)

- The user **moves around the 3D farm**. Based on the farm's land, crops, and what the algorithm finds, **minimalist game-style markers** appear: a hazard symbol over a patch of land, and/or the patch softly highlighted (Hay Day / Clash of Clans feel).
- **Sleek, minimalist, SaaS aesthetic.** Not a dashboard of numbers and graphs.
- **Icons must be minimalist and match the app's aesthetic.** This is a Section 1 design task; the backend only sends `kind`.

### 9.2 Field marker (Pydantic model sketch: the contract per D-19)

```python
class MarkerKind(str, Enum):
    winter_wet = "winter_wet"      # ⚠️
    summer_dry = "summer_dry"      # 🌵
    opportunity = "opportunity"    # 💡
    protected = "protected"        # ✅

class Basis(str, Enum):
    measured = "measured"; derived = "derived"; modeled = "modeled"
    assumed = "assumed"; relative = "relative"

class SourceRef(BaseModel):
    dataset: str          # e.g. "NASA POWER"
    detail: str           # e.g. "daily precipitation 1981–2025, bias-corrected to GPM IMERG"
    url: str              # dataset landing page (verified)

class Evidence(BaseModel):          # the "why?" layer, shown only after a tap
    metric: str           # e.g. "winter_exposure"
    value: float
    units: str            # e.g. "relative index (field mean = 1)"
    basis: Basis
    comparison: str | None    # e.g. "−48% vs current practice"
    rank_stability: str | None  # e.g. "lower than Rotation A in 91% of resampled histories"; None in Lite
    sources: list[SourceRef]
    caveats: list[str]    # e.g. ["Lite mode: fewer data sources", "calendar assumed for this crop"]

class FieldMarker(BaseModel):
    id: str
    kind: MarkerKind
    severity: int = Field(ge=1, le=5)
    zone_ids: list[str]
    icon_point: LonLat            # pole of inaccessibility
    outline: GeoJSONPolygon       # for the soft highlight
    active_weeks: list[int]       # 0–51, week 0 starts Jan 1; wraps
    headline: str = Field(max_length=60)
    action: str                   # one sentence
    evidence: Evidence
    rotation_id: str
    scenario: Literal["baseline", "wetter_winters", "drier_summers", "both"]
    mode: Literal["full", "lite"]
```

Field names are a proposal. Once the models exist in code, **`/openapi.json` is authoritative**, and Section 1 regenerates types from it.

### 9.3 Endpoints (proposal)

| Endpoint | Returns | Notes |
| --- | --- | --- |
| `GET /sites` | Curated sites with a "Pre-built" flag | |
| `GET /sites/{id}/terrain` | **Terrain package** from LidarBC or NASADEM: 16-bit heightmap PNG, normal map, metadata (grid size, cell size m, CRS, elevation range, `source`, `resolution_m`, `dsm_includes_vegetation`) | **Proposal, new.** Feeds the 3D land (S1-A). Encoding follows the old decoder contract (row-major, row 0 = north); see `Databases.md` DB-1. Final grid size agreed with S1-A |
| `GET /sites/{id}/zones` | Zone outlines + terrain factor | For layer views |
| `GET /sites/{id}/rotations` | Curated rotations + their calendars (52 weeks) | |
| `GET /sites/{id}/markers?rotation=&scenario=&week=&all=` | ≤ 5 `FieldMarker` (or all) | `week` filters to active markers for the scrubber |
| `GET /sites/{id}/compare?rotations=a,b,c&scenario=` | Two axes per rotation + rank stability | UI shows it minimally (e.g. two small meters), not a chart |
| `POST /lite/markers` | Same shape, `mode = "lite"` | Location + field polygons + crop per field |
| `GET /provenance` | Every dataset with source, license, attribution, accessed date, basis | Data credits page. Built from `Databases.md` facts (DB-13); a test fails if a dataset used in any seed table is missing |

### 9.4 Interface rules

- Section 1 builds against fixtures generated **from the Pydantic models** (one script writes example JSON for every endpoint).
- Any change to a model is announced in the team chat the same hour.
- A type-check failure on the generated types is treated as a broken build.

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
| Fraser Valley farm | **P0, build first** | LidarBC | AAFC crop map | Exact farm `TODO(owner)`: pick it, or choose fields from the AAFC map near Sumas Prairie / Abbotsford / Chilliwack. Backtest site |
| Contrasting site 2 | P1 (time permitting) | NASADEM / local open LiDAR | Local crop map or user-assigned | e.g. US Midwest corn–soy |
| Contrasting site 3 | P1 (time permitting) | NASADEM | User-assigned | e.g. dry Mediterranean or South Asian site |

Each curated site shows a "Pre-built" badge in the UI.

---

## 12. Plan (pre-event → event)

| When | S2-A (Data) | S2-B (Algorithm) |
| --- | --- | --- |
| Pre-event, day −2 | S2-01: verify every dataset (§5), read the official Resources list, Earthdata accounts, pick the Fraser Valley farm | Pydantic models (§9.2) + fixture generator; engine skeleton with invariant tests on synthetic data |
| Pre-event, day −1 | Ingest + cache POWER, IMERG, SMAP; HLS + AAFC calendars; LidarBC terrain + zones | Fusion, hazard odds, exposure engine, bootstrap on real cached data |
| Event, Sat AM | Backtest data for Nov 2021 | Scenarios (analog years), optimizer, marker generator |
| Event, Sat PM | `data/seed/` for site 1; OFFLINE test | Endpoints live on site 1; Section 1 swaps to live |
| Event, Sun AM | Lite mode (POWER live + NASADEM) | Sensitivity table, backtest score, `algorithm.md` |
| Event, Sun PM | Sites 2–3 if time; provenance page data | "How we use NASA data" one-pager; freeze by Sun 21:00 |

`Prompts.md` was rewritten on 2026-11-13 to follow this plan and `../Databases.md` (prompts S2-01…S2-12). Each data task above maps to a `Databases.md` section (DB-1…DB-13).

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
| No shared contract (D-19) | Silent mismatch between sections | Generated types + fixtures from models; announce changes |
| Time | Sites 2–3 missing | Depth first (D-22); Lite mode still shows global reach |

---

## 15. Open items

| # | Item | Owner |
| --- | --- | --- |
| 1 | Pick the exact Fraser Valley farm (coordinates, field boundaries) | Product owner |
| 2 | Read and record the official 2026 Resources list for the challenge | S2-A |
| 3 | Verify every row in §5 (names, variables, coverage, access, license, sample request) | S2-A |
| 4 | Confirm Nov 2021 event dates and an observation source for the backtest | S2-A |
| 5 | Check CSA RADARSAT open access/license (D-18) | S2-A |
| 6 | Choose `τ_bare`, default percentiles, and smoothing width from literature; record sources | S2-B |
| 7 | Define the 3 curated Fraser Valley rotations with the owner (e.g. silage corn with/without winter cover; perennial grass) | S2-B + owner |
| 8 | Update `../README.md` (contract rule → D-19) and Section 1 PRD (markers §9, icon requirement) | Integrator |
| 9 | ~~Rewrite `Prompts.md` for v0.2~~ Done 2026-11-13 (see `Databases.md` for the data tasks) | S2-B |
| 10 | Fill in owners (§2) | Team |
| 11 | Decide SMAP L4 vs L3 (`Databases.md` DB-5) | S2-A + S2-B |
| 12 | Agree terrain package shape and grid size with S1-A (new `GET /sites/{id}/terrain`) | S2-A + S1-A + Integrator |
| 13 | Create Earthdata accounts for everyone and test one download each | Everyone |

---

## 16. Change log

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-12 | Claude | v0.1 draft created |
| 2026-11-12 | Claude + product owner | v0.2: design interview decisions D-01…D-22; Risk Window Calendar spec; data table; marker output; validation incl. Nov 2021 backtest; prior art; plan |
| 2026-11-13 | Claude + product owner | v0.2.1: added `../Databases.md` as the detailed data plan; ECOSTRESS row (P2); SMAP L4 vs L3 open decision; GRACE, yield and disaster data recorded as not used; proposed `GET /sites/{id}/terrain`; `/provenance` tied to `Databases.md`; `Prompts.md` rewritten |
