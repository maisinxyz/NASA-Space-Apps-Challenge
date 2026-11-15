# FieldTwin Backend PRD v3: 10-Year Scenario Forecast ("Forecast Twin")

Status: draft for team review, 2026-11-14. **Backend only: no session builds or edits anything under `apps/web/`. Everything the frontend and UI need is listed in section 12 for the frontend team.** First twin: **UBC Farm** (Vancouver, BC). Supersedes the scoring-only rotation analysis (`docs/progress/rotation-B.md`) for new work. Read `CLAUDE.md` first; its rules apply to every workstream below.

## 0. How to use this document

This PRD is split into **11 workstreams (W0–W10)** that can run in parallel, each owned by one coding agent. Each workstream lists: scope, files it owns, inputs it may rely on, outputs, and acceptance tests. Section 6 freezes the shared interfaces so agents can code against each other before the other side exists. Section 10 has a copy-paste agent prompt.

Ground rules for every agent:
1. Touch only files your workstream owns (section 8). If you need a change in someone else's file, write a request in `docs/progress/forecast-requests.md` and continue with a stub.
2. Never invent endpoints, fields, enum values, dataset names, URLs, constants, or licenses. Unknown = `TODO(verify)` plus a source URL in a comment, or stop and ask the team lead.
3. Deterministic: same request, same bytes out. Seeds come from the request hash (section 6.4). No wall-clock, no unseeded randomness, no LLM calls.
4. `OFFLINE=1` must work for the UBC Farm twin and the 3 existing curated sites with no network.
5. Small commits to `main`, `git pull --rebase` first. Commit message starts with the workstream ID (e.g. `FT-W6a: ...`). Write `docs/progress/FT-<id>.md` when done (what was built, files, how to run, known gaps).
6. Run the relevant tests and show the result before declaring done.
7. Do not create or edit any file under `apps/web/`. If you think the frontend needs something, add it to section 12 of this PRD via `docs/progress/forecast-requests.md`.

## 1. Goal and honesty position

Build a digital twin that takes **a farm's location, soil and history (NASA + partner data) and the farmer's own choices**, then projects how three or more crop-rotation strategies could evolve over **Year 1 to Year 10** under a chosen climate scenario.

This is a **scenario forecast**: the model projects absolute estimates (crop yield, forage yield, income, fertilizer need and saving, soil loss) as well as relative indices, always for a stated climate scenario. The team lead removed the earlier "relative only, no yield/profit" rules (decision D1, 2026-11-14). Every number still carries `unit`, `basis` (`measured | derived | modeled | assumed | relative`) and `confidence`, and every absolute estimate carries a p10/p90 range, because constants that are not yet verified make a single number look more certain than it is. The sentence "This tool supports, and does not replace, local agronomic expertise." appears in every forecast response.

**Open decisions for the team lead** (defaults are applied until changed):
- **[D1] DECIDED: money, yield and fertilizer numbers are allowed.** The earlier rules against yield, profit and absolute soil-loss figures are removed. The forecast now outputs crop yield and forage yield (t/ha), income (farmer-entered prices and costs, currency shown), fertilizer need and fertilizer saved (kg N/ha), and soil loss (t/ha/yr). We never invent prices: income uses the farmer's own prices, and if none are entered the income field is `null` with a review flag. Labels (unit, basis, range) stay because they tell the farmer how much to trust each number.
- **[D2] DECIDED: use NASA climate-model projections if they have the variables we need; otherwise find an alternative.** First choice: NASA NEX-GDDP-CMIP6 (`climate_source: cmip6_delta`). Session C checks (a) it provides daily rain, max and min temperature, (b) it covers UBC Farm at usable resolution, (c) the license allows our use. If any variable is missing, Session C picks another verified source (for example another downscaled projection dataset) and records why in `docs/progress/FT-W3.md`. If no future-climate dataset qualifies, the fallback is `history_resample` (34 years of real past weather shifted by the farmer's sliders, phased in over 10 years), labelled as such in the response.
- **[D3] DECIDED: a forecast covers the whole farm, which has several fields.** The request lists the fields (`fields[]`); each field has its own area, soil, slope, irrigation and current crops. Strategies are generated and simulated per field, then rolled up to a farm total (area-weighted). This is core scope, not a stretch item.

## 2. Rebuild vs reuse decision

| Layer | Decision | Reason |
| --- | --- | --- |
| Data layer: `app/weather/power.py`, `app/features/{config,pipeline,seeds}.py`, SoilGrids seeds, sidecar rule, scenario resolver, `Source` objects | **Reuse** | Works, tested, offline-safe, 34-year weekly tables. |
| `app/features/zones.py` | **Extend** | Needs UBC terrain, water-stress zones. |
| Contract v1.1.0 schemas (`Scenario`, `FeatureTable`, `HazardCalendar`, `Zone`, `Criterion`, `RotationSlot`...) | **Reuse and extend** (additive, v1.2.0) | Frontend already types against them. |
| `app/rotation/engine.py`, `app/services/rotation.py` (annual scoring, 12 commodity crops) | **Rebuild** as `app/twin/` | One-cycle score cannot produce a Year 1–10 state trajectory; crop library is commodity-only. |
| `app/rotation/evidence.py`, `glossary.json` templates | **Port** into `app/twin/explain/` | Templates are deterministic, keep that style. |
| `POST /sites/{id}/rotation-analysis`, `GET /compare` | **Keep until web switches, then delete** | Do not break the current UI; remove in W9 once the web app calls `/forecast`. |
| Celery, PostGIS, Parquet, LLM text generation | **Do not add** | Seeds are built at `make seed` time; cache is files; templates keep determinism. |

## 3. Source of truth: the five forecast groups

Every output field below must be produced by the API (the frontend team renders it; see section 12). Column "Workstream" says who builds it.

### Group 1: Future climate and water-balance conditions (`climate_outlook`)

| Output | Definition | Data | Native resolution / record | Basis | WS |
| --- | --- | --- | --- | --- | --- |
| Seasonal temperature drift | Per season: observed trend (Theil–Sen, with Mann–Kendall p-value) and scenario-adjusted mean | NASA POWER T2M, T2M_MIN, T2M_MAX | ~55 km, 1991–2024 (34 yr) | modeled | W3 |
| Heat-stress days | Days per year above each selected crop's heat limit, by year 1–10 (central + p10/p90) | POWER + crop traits | same | derived | W3 |
| Frost windows | Last spring frost and first fall frost: baseline date (median, p10/p90) and shift under scenario; frost-free season length | POWER T2M_MIN | same | derived | W3 |
| Rainfall and extremes | Seasonal totals; count of extreme-rain days (≥ p95 wet-day) and multi-day events, baseline vs scenario | POWER precipitation (name to verify) | same | modeled | W3 |
| ET and soil-moisture anomalies | Weekly ET0 (Hargreaves–Samani, existing) trend; SMAP root-zone anomaly vs 2015+ climatology; ECOSTRESS ET as a cross-check | POWER; SMAP L3/L4 (verify product); ECOSTRESS (verify) | 9 km / 70 m, 2015+/2018+ | modeled | W2, W3 |
| Net water balance | Weekly and seasonal (rain + irrigation) minus (crop ET + runoff + drainage) = surplus or deficit | Engine (W6a) | field | modeled | W6a |
| Groundwater / storage trend | Regional context only, never scored | GRACE-FO / GRACE DA (verify product) | ~25 km down-scaled, 2002+ | modeled | W2 |

### Group 2: Field-level vulnerability and seasonal timing (`exposure`)

| Output | Definition | Data | WS |
| --- | --- | --- | --- |
| Vulnerable crop seasons | Per existing-rotation crop: weeks and growth stage where hazard probability (heat, drought, frost, waterlogging) ≥ 0.25 (existing threshold) | features + traits | W4 |
| Bare-field windows | Weeks with cover below 0.25 per the rotation timeline; cross-checked with HLS/Landsat NDVI where cloud-free scenes exist | rotation plan + NDVI seed | W4 |
| Erosion zones | Slope + bare weeks + extreme-rain exposure | terrain (verify DEM source for UBC), features | W4 |
| Water-stress hotspots | Where SMAP/ECOSTRESS dryness and low water-holding soil coincide; if native resolution is coarser than the field, return one farm-level value with a `resolution_note` instead of fake sub-pixels | SMAP, ECOSTRESS, SoilGrids | W4 |
| Frost-prone pockets | Low-lying cold-air traps from DEM + POWER frost frequency | DEM, POWER | W4 |

### Group 3: Multi-year soil health and ecology per strategy (Year 1–10 trajectories)

| Metric id | Meaning | Unit | Basis | WS |
| --- | --- | --- | --- | --- |
| `soil_organic_index` | Organic matter / structure index relative to Year 0 (=100). Two-pool first-order model (carbon inputs from residue and roots, minus temperature/moisture-modified decay, bare-soil penalty). Not %SOM. | index, Year 0 = 100 | relative | W6b |
| `n_balance` | Cumulative nitrogen gain or draw: fixation + residue release − crop uptake − loss. Relative index plus kg N/ha figure labelled `assumed`; also `n_fixed_share` | index; kg N/ha (assumed) | relative / assumed | W6b |
| `infiltration_index` | Share of rain entering the root zone, changes with `soil_organic_index`, cover, tillage/compaction | index, Year 0 = 100 | modeled | W6a |
| `runoff_index` | Relative surface runoff from the water balance (absolute soil loss is `soil_loss_t_ha`, below) | index | relative | W6a |
| `pest_pressure_index` | Rises with same-family repeats vs the family's return interval; resets with non-host years | index 0–100 | assumed (rule-based) | W6b |
| `bare_weeks` | Weeks per year with cover below 0.25 | weeks/yr | derived | W6a |

### Group 4: Practical farm outcomes per strategy (`farm_fit`)

| Field | Definition | WS |
| --- | --- | --- |
| `water_vs_quota` | Modeled irrigation need (mm/season, p50 and p90) vs the **farmer-entered** quota; status `within | tight | exceeds | no_quota_given` | W7 |
| `forage_suitability` | Relative index of forage-capable crops and ley years in the plan, vs strategy A; the tonnage is `forage_yield_t_ha` (below). | W7 |
| `operational_fit` | Equipment match (needs vs farmer's equipment list) and peak-labour weeks. Relative. | W7 |
| `market_fit` | Mean of the farmer's own 1–5 buyer-demand ratings for the planted crops. Unrated crops flagged. | W7 |
| Scorecard | The 7 existing criteria recomputed from trajectories, min-max across strategies, 50 on equal (existing rule) | W7 |

**Absolute estimates added by decision D1** (each has unit, basis, p10/p50/p90 range, `confidence`, and a `TODO(verify)` list for constants):

| Output id | Meaning | Method | Owner |
| --- | --- | --- | --- |
| `yield_t_ha` (per crop and year) | Crop yield estimate | Catalog `reference_yield` scaled by water stress using the FAO Irrigation and Drainage Paper 33 yield-response relation, `1 - Ya/Ym = Ky (1 - ETa/ETm)` (verify the source and each crop's Ky), then a heat/frost penalty from the weather | W6a |
| `forage_yield_t_ha` | Forage and hay yield for forage crops and ley years | Same method with forage reference yields | W6a |
| `soil_loss_t_ha_yr` | Soil loss | RUSLE-style product of rainfall erosivity, soil erodibility, slope, cover and practice factors; every factor in `twin/config.py` with source or `TODO(verify)` | W6b |
| `n_fertilizer_need_kg_ha` and `n_fertilizer_saved_kg_ha` | Fertilizer need per year and the saving versus the existing rotation | Crop N demand minus soil supply minus legume fixation credit and residue release | W6b |
| `income_estimate` | Income per field and farm | Yield × farmer price − farmer costs; `null` plus a review flag if prices are missing | W7 |

### Group 5: Sensitivity, uncertainty and review flags

| Output | Definition | WS |
| --- | --- | --- |
| Sensitivity grid | Each strategy's key metrics at rain {-30, -15, 0, +15, +30} % × temperature {0, +1.5, +3} °C; plus rank stability across the grid | W8 |
| Uncertainty ranges | p10/p50/p90 per year from the deterministic weather ensemble (section 5.3); per-layer `native_resolution` and `confidence` table | W8 |
| Validation need | For each metric, whether local testing is needed (soil test, rain gauge, plot records) | W8 |
| Review flags | Per strategy: agronomic or market risks needing human judgment (rules in W8) | W8 |
| Evidence cards | Why / Evidence / Risks per strategy, each evidence item tied to its triggering data layer and week | W8 |

## 4. UBC Farm twin (first deliverable)

- **Site id:** `site_ubc_farm`. Name: UBC Farm, Vancouver, BC. Coordinates from the UBC Farm's published location: **TODO(verify)** (approx. 49.26 N, −123.24 W from memory; confirm from an official source and record the URL). Hemisphere north; `farm_id` must match `apps/web/lib/farms` once the web team adds the entry.
- **Climate class:** oceanic, mild wet winters, dry summers. The 34-year POWER window is the baseline (same as the curated sites).
- **Known data limits the API must report in the response (the frontend shows them):**
  - POWER cell is ~55 km and includes ocean and mountains; rainfall and temperature are regional. Mitigation: hindcast against a local station record (candidate: Environment and Climate Change Canada historical data, **TODO(verify)** station choice and license) and show the bias in `uncertainty`.
  - SMAP 9 km and GRACE cover the entire farm in one pixel. Return one farm-level value with a `resolution_note`.
  - Winter clouds limit HLS/Landsat NDVI exactly when fields are bare. Report scene counts; use planting records as the primary bare-window source.
  - DEM (NASADEM) can include canopy bias next to forest. Prefer a bare-earth source if the team can verify one (e.g. provincial LiDAR, **TODO(verify)**).
- **Farmer personalization:** the farmer picks crops, grains and forage from the catalog (W5), pins or excludes crops, enters equipment, water quota and buyer ratings. A selection of vegetable-only, grain-only or mixed pools must all generate valid strategies.
- **Other twins:** the 3 existing curated sites keep working through the same code path (acceptance test).

## 5. Methodology (the engine, `app/twin/`)

### 5.1 Time structure
Year 0 is the baseline state (index 100 for relative indices). Years 1–10 are simulated with a **weekly** step (52 weeks) for water and cover, and an **annual** update for soil carbon, nitrogen, infiltration and pest state. A strategy is a repeating cycle (1–10 years) expanded to a 10-year plan of slots `{year_index, season, crop_id}`.

### 5.2 Water balance (FAO-56 bucket, weekly)
- Crop coefficient (Kc) per stage from the crop traits (FAO-56 Table 12 where a crop is listed; otherwise `TODO(verify)`), ET0 from the existing Hargreaves–Samani pipeline.
- Soil water holding: total available water from SoilGrids water-retention or texture-derived values × effective root depth (crop trait, grows over the stage).
- Per week: `infiltrated = rain × infiltration_factor(state)`, `runoff = rain − infiltrated`, `ETc = Kc × ET0 × Ks` (Ks from depletion vs readily available water), `drainage` when storage exceeds field capacity. Irrigation need = unmet ETc (mm) when irrigation is available.
- Infiltration factor depends on `soil_organic_index`, cover curve, tillage and compaction flags (assumed coefficients in `twin/config.py`, each with a source or `TODO(verify)`).
- Do not use an annual-only balance: summer deficit in a wet-winter climate would be hidden.

### 5.3 Climate drivers and the deterministic ensemble
- Baseline weather = the 34 historical years (weekly tables from the existing feature pipeline).
- For each of **N = 30 ensemble members**, build a 10-year weather sequence by sampling historical years with `numpy.random.default_rng(seed)` where `seed = int(sha256(request_hash + member_index)[:8], 16)`. Deterministic across runs and machines.
- Apply the scenario to each simulated year: slider/preset values (existing `resolve_scenario`) with a **linear ramp** from Year 0 (no change) to Year 10 (full value); ramp shape is `assumed` and echoed in the response. `cmip6_delta` mode (per decision D2) replaces the ramp with verified per-year deltas.
- Report p10/p50/p90 across members per metric per year. Central value = median.
- Observed trends (Theil–Sen + Mann–Kendall, group 1) are **reported as context only**, never extrapolated into the 10 years.

### 5.4 Soil carbon, nitrogen, pests
- **Soil carbon index:** two pools (fast and slow), annual carbon input = Σ crop residue and root input (trait classes → assumed coefficients), decay rate modified by mean temperature and soil wetness, extra loss for bare weeks and tillage. Output relative to Year 0. Constants in `twin/config.py` with a source (e.g. published first-order models such as ICBM/RothC, **TODO(verify)** citation) or marked assumed.
- **Nitrogen:** per crop uptake class, legume fixation fraction, residue N release, simple loss term tied to drainage and bare weeks. Uncertainty is wide; confidence `low` and `needs_local_review: true` always.
- **Pests and disease:** per crop family, `return_interval_years` and `host_families` from the catalog. `pest_pressure_index` rises each year a family returns before its interval has elapsed, saturates at 100, and decays after non-host years. Specific interval values are `TODO(verify)` against provincial or university extension guides (BC Ministry of Agriculture, WSU, etc.); never present them as measured.

### 5.5 Strategy generation (W7)
- Pool = farmer-selected crops (catalog ids), `pinned` must appear, `excluded` never. Strategy A = farmer's existing rotation (entered or preset). Alternatives = deterministic search (DFS in crop-id order, capped) subject to: same-family spacing rule, season windows, equipment and labour constraints, perennial ley length, cycle length cap. Optional `custom_strategies` supplied by the farmer are evaluated as-is.
- Pick alternatives with **equal weights**, then apply the farmer's priority weights only to ranking and the scorecard (this fixes the open item "weights swap alternatives" from rotation-B decision 4).
- If fewer than the requested strategies are feasible, return what exists plus a `NO_FEASIBLE_ALTERNATIVES` warning (existing code).

### 5.6 Scoring and normalization
Seven existing criteria, recomputed from trajectories: water use, erosion/runoff, soil organic, nitrogen, pest, winter exposure, farm fit. Min-max across strategies, 50 on equal, lower-is-better flipped (existing logic). Add the Year-10 value and the Year 1–10 mean for each.

### 5.7 Scenario controls (sliders)

Sliders are the "what if the climate shifts" layer on top of the twin. They never change the farm's state (fields, soil, crops), which the farmer enters.
- **Default: named scenarios.** Presets built from the verified future-climate source (decision D2), for example low, medium and high emissions. If no source is verified, presets are the existing ones (`baseline`, `wetter_winters`, `drier_summers`, `both`). Each preset states its source in the response.
- **Optional adjustment sliders on top of the preset:** temperature offset (deg C), overall rain change (%), and a seasonal rain change (summer and winter separately, the existing `rain_scale_by_season`). Ranges stay as in `features/config.py`.
- **Timing label.** Every slider value means "reached by Year 10, phased in linearly from Year 0". The response echoes `ramp: { shape: linear, years: 10 }`.
- **Live use.** Cached runs must answer in under 100 ms (section 9) so dragging a slider updates results live; the first run after a change may take up to the cold-run budget.
- **Sensitivity grid** (W8) is the main use of the sliders: it shows whether the strategy ranking holds as the climate moves.
- **Later option (not in this build):** a slider for extreme-rain frequency and dry-spell length.

## 6. Shared interfaces (frozen by W0 on day 1)

### 6.1 Endpoints (additive, contract v1.2.0)

| Method and path | Purpose | Notes |
| --- | --- | --- |
| `GET /sites/{siteId}/climate-outlook?scenario=` | Group 1 | Fast (<150 ms cached). Powers the climate page without running strategies. |
| `GET /sites/{siteId}/exposure?crops=` | Group 2 | Crops default to the site's existing rotation preset. |
| `GET /crop-catalog?category=&site_id=` | Selectable crops, grains, forage, covers | `CropTrait` extended (6.3). `/crops` is unchanged. |
| `POST /sites/{siteId}/forecast` | Groups 3, 4 and most of 5 | Body `ForecastRequest`, response `Forecast`. |
| `POST /sites/{siteId}/forecast/sensitivity` | Group 5 sensitivity grid | Same body; response `SensitivityGrid`. Kept separate so the first paint is quick. |

Existing `/sites/{id}/features|hazard-calendar|hazards|zones` stay. Error codes reuse the existing ones; new codes (`UNKNOWN_CROP` exists): `SELECTION_TOO_SMALL` 422 (fewer than 2 crops), `INVALID_QUOTA` 422, `HORIZON_OUT_OF_RANGE` 422. W0 may rename but must keep additive.

### 6.2 Request

```yaml
ForecastRequest:
  fields:                      # 1..20 fields; if omitted, one field = the whole farm from the site record
    - field_id: string
      name: string
      area_ha: number
      slope_class: flat | gentle | moderate | steep
      soil_override: { sand_pct, silt_pct, clay_pct, organic_carbon_pct }   # optional
      irrigation: { available: boolean, quota_mm_per_season: number }      # quota optional
      polygon: GeoJSON Polygon                                              # optional
      existing_rotation: "preset" | [RotationSlot]                          # this field's current crops
      selection_override: { crops, pinned, excluded }                       # optional; default = farm selection
  farm_water_quota_mm_per_season: number      # optional farm-wide cap shared by all fields
  selection:
    crops: [CropId]            # the farmer's pool, 2..30, from /crop-catalog
    pinned: [CropId]
    excluded: [CropId]
  custom_strategies: [[RotationSlot]]    # optional
  strategy_count: integer 2..4 (default 3, counts the existing one)
  priorities: FarmerPriorities           # existing schema
  constraints:
    equipment: [EquipmentId]             # enum defined by W5
    max_cycle_years: integer 1..10
    no_till: boolean
    labour_level: low | medium | high
    livestock_on_farm: boolean
  market_ratings: { <CropId>: 1..5 }     # farmer's own buyer-demand rating, optional
  economics:                             # all farmer-entered; never defaulted silently
    currency: string
    crop_prices: { <CropId>: { value: number, unit: string } }     # e.g. per tonne
    input_costs: { fertilizer_per_kg_n?: number, seed_per_ha?: { <CropId>: number }, irrigation_per_mm_ha?: number, labour_per_hour?: number }
  scenario: Scenario | ScenarioInput     # existing; preset first, optional slider adjustments on top (section 5.7)
  horizon_years: 10                      # 5..10 allowed
  climate_source: cmip6_delta | history_resample    # default cmip6_delta if W3 verified a dataset, else history_resample
```

### 6.3 Response

```yaml
Number:   { value: number, unit: string, basis: BasisOrRelative, confidence: Confidence }
YearSeries:
  metric: string
  unit: string
  basis: BasisOrRelative
  confidence: Confidence
  needs_local_review: boolean
  points: [{ year: 0..10, p50: number, p10?: number, p90?: number }]   # year 0 = baseline
Forecast:
  site_id, schema_version, pipeline_version, request_hash
  horizon_years
  scenario: ScenarioApplied            # existing, plus ramp: { shape: linear, years: 10, basis: assumed }
  data_mode: DataMode
  disclaimer, support_sentence         # fixed strings
  climate_outlook: ClimateOutlook      # section 3 group 1
  exposure: Exposure                   # group 2 (strategy A crops)
  fields:                              # one entry per field in the request
    - field_id, name, area_ha
      strategies: [Strategy]             # as below; index 0 is the field's existing rotation
  farm_rollup:                           # area-weighted totals per strategy id (rot_existing, rot_alt_1, ...)
    strategies: [{ id, trajectories, farm_fit, scorecard }]   # same shapes as Strategy, summed or averaged by area
  strategies_note: Strategy shape below applies per field and, as a rollup, per farm
  strategies_shape:                      # index 0 is always the existing rotation
    - id: rot_existing | rot_alt_1 | rot_alt_2 | rot_custom_n
      role: existing | alternative | custom
      label, cycle_years
      plan: [RotationSlot]             # expanded, 10 years
      trajectories:                    # group 3
        soil_organic_index, n_balance, infiltration_index, runoff_index,
        pest_pressure_index, bare_weeks, water_demand_mm, irrigation_need_mm: YearSeries
      farm_fit: { water_vs_quota, forage_suitability, operational_fit, market_fit }   # group 4
      scorecard: [RotationScorecard]   # existing schema, + `year10_value`, `mean_value`
      vulnerable_seasons: [VulnerableSeason]
      evidence_card: EvidenceCard      # existing, with evidence_items
      review_flags: [ReviewFlag]
  comparison: { rank_by_priority: [id], rank_stability: string, deltas_vs_existing_year10: {...} }
  uncertainty:
    layers: [{ layer, native_resolution_m, record_years, confidence, resolution_note, needs_local_validation }]
    station_bias: { variable, bias, unit, n_years } | null        # POWER vs local station, if available
  warnings: [AnalysisWarning]
  sources: [Source]                    # all with license + attribution
ReviewFlag: { id, strategy_id, severity: info | caution | verify, text, trigger: { layer, rule, week? } }
SensitivityGrid:
  axes: { rain_scale_pct: [..], temp_offset_c: [..] }
  cells: [{ rain_scale_pct, temp_offset_c, per_strategy: { <id>: { key metrics at Year 10 as Number } } }]
  rank_stability: { share_first_by_strategy: {...} }
```

Fixed strings (`disclaimer`, `support_sentence`) live in `twin/config.py`, one copy.

### 6.4 Python interfaces (`app/twin/`; W0 commits stubs that raise `NotImplementedError`)

```python
# twin/types.py (owned by W0)
@dataclass(frozen=True) class Slot: year_index:int; season:str; crop_id:str
@dataclass(frozen=True) class Weather: years: np.ndarray      # shape (n_years,)  historical year labels
                                       tmax: np.ndarray; tmin: np.ndarray; rain: np.ndarray; et0: np.ndarray   # shape (n_years, 52), mm / degC
@dataclass(frozen=True) class SoilProps: taw_mm_per_m: float; sand: float; silt: float; clay: float; soc_pct: float; ...
@dataclass(frozen=True) class Plan: strategy_id: str; slots: tuple[Slot, ...]; cycle_years: int
@dataclass class State: soc_fast: float; soc_slow: float; infiltration_idx: float; n_pool: float; pest: dict[str,float]
def request_hash(req: dict) -> str                              # sha256 of normalized JSON, sorted keys
def member_seed(req_hash: str, member: int) -> int

# twin/weather_ensemble.py (W6a)
def build_members(weather: Weather, scenario: ScenarioApplied, horizon:int, n:int, req_hash:str) -> list[Weather]   # each shape (horizon, 52)

# twin/water.py (W6a)
def run_water_year(plan_year: PlanYear, w: WeatherYear, soil: SoilProps, state: State, irrigation: IrrigationCfg) -> WaterYearResult
# twin/soil.py (W6b)
def update_soc(state: State, plan_year, water: WaterYearResult, w) -> State
def update_nitrogen(state: State, plan_year, water: WaterYearResult) -> State
def update_pest(state: State, plan: Plan, year: int, catalog) -> State
# twin/run.py (W6c)
def simulate(plan: Plan, members: list[Weather], soil: SoilProps, field: FieldCfg, catalog) -> dict[str, YearSeries]
# twin/generate.py (W7)
def generate_strategies(req: ForecastRequest, catalog, weather, soil) -> list[Plan]
def farm_fit(plan: Plan, series: dict, req: ForecastRequest, catalog) -> dict
# twin/climate.py (W3), twin/exposure.py (W4), twin/explain/*.py (W8), services/forecast.py (W9)
```

W6a/b/c must agree only on `PlanYear`, `WaterYearResult`, `State` as defined in `types.py`. W0 defines those fields in its first commit (target: within the first 2 hours). Until then, agents build against the signatures above and add fields via the request file.

### 6.5 Crop trait schema v2 (W5 owns data, W0 owns schema)
Extends existing `CropTrait`: `category` (`vegetable | grain | forage | cover | fruit_perennial`), `family`, `host_families`, `return_interval_years`, `kc_stages`, `root_depth_m` (by stage), `season_window` (plant/terminate day of year; vegetables may have `succession` flag), `residue_class`, `carbon_input_class`, `n_uptake_class`, `n_fix_class`, `frost_tolerance_c`, `heat_limit_c`, `drought_tolerance`, `waterlogging_tolerance`, `forage_use` (`none | grazing | hay | silage`), `reference_yield` (t/ha, with source), `yield_response_factor_ky`, `typical_n_rate_kg_ha`, `erosion_cover_factor_class`, `needs_equipment` (list of `EquipmentId`), `labour_peak_weeks`, `region_fit` (list of climate classes). **Every trait has `trait_sources[field]`** (URL or `TODO(verify)`).

## 7. Workstreams

Which session builds which workstream, and in what order, is fixed in section 10 (Sessions A, B, C). The "Wave" labels in the headings below are old and only hint at dependency order; section 10 wins if they disagree. Every session pushes partial work and updates its progress note at least every 90 minutes.

### W0: Contract and shared types (Wave 0, gate)
- **Scope:** OpenAPI v1.2.0 (additive: new paths and schemas from section 6, `CropTrait` v2), JSON fixtures for every new response (generated by a deterministic script, later replaced by real engine output in W9), `app/twin/types.py` with dataclasses and stubs, `request_hash`/`member_seed`. Contract tests (schema valid, fixtures valid, `Number` has unit/basis/confidence everywhere, every absolute estimate has unit, basis and range).
- **Owns:** `packages/contracts/**`, `app/twin/types.py`, `app/twin/__init__.py`. (The frontend team regenerates `apps/web/lib/api/schema.d.ts` with `make types`; W0 does not touch `apps/web/`.)
- **Done when:** `packages/contracts` tests pass; message sent to the team (contract change rule in CLAUDE.md); version bumped.

### W1: UBC Farm site and base seeds (Wave 0)
- **Scope:** add `site_ubc_farm` to `features/config.py` (verified coordinates with source URL); POWER daily 1991–2024 seed; SoilGrids seed (reuse loaders); local station file for the hindcast (license verified, sidecar); `scripts/build_seed.py` support; `sites` fixture entry; `docs/data-and-methods` entries.
- **Owns:** `data/seed/site_ubc_farm/**`, `app/features/config.py` (site list and sources only), `scripts/build_seed.py`.
- **Done when:** `GET /sites/site_ubc_farm/features` works with `OFFLINE=1`; all seed files have complete sidecars (existing test); 34 complete years or documented gaps.

### W2: Satellite and regional seeds (Wave 1; needs Earthdata login, so start early)
- **Scope:** seed-time extraction scripts (never on the request path) for UBC Farm and, if time allows, the 3 curated sites: HLS or Landsat NDVI/EVI (cloud-masked, scene counts kept), SMAP root-zone/surface moisture (verify L3 vs L4 and AppEEARS availability), ECOSTRESS ET (verify product), IMERG precipitation (verify), GRACE-FO regional anomaly, DEM (verify source and bare-earth option). Output compact gz-JSON by weekly bucket plus sidecars with source, product version, license, attribution, resolution. Loaders `load_ndvi`, `load_smap`, `load_ecostress`, `load_grace`, `load_dem` in `features/seeds.py` (shared file: W2 adds new functions only).
- **Honesty:** every product ID is verified against the live catalog before use. A dataset that cannot be obtained is documented as a gap with `data_mode: limited_data` behavior, not faked.
- **Owns:** `scripts/seed_satellite/**`, `data/seed/<site>/{ndvi,smap,ecostress,grace,dem}.*`, the new loader functions.
- **Done when:** loaders return data for UBC Farm or a documented `None`; coverage and cloud-free counts are in the sidecar.

### W3: Climate outlook (Group 1) (Wave 1)
- **Scope:** `app/twin/climate.py`: seasonal drift (Theil–Sen + Mann–Kendall), heat-stress days by threshold, frost windows (last spring, first fall, season length), rainfall totals and extreme-rain frequency, ET0 trend, SMAP anomaly series (if seed present), water-balance climatology, GRACE context. Scenario application incl. the Year 0→10 ramp. Endpoint service `services/climate_outlook.py`. Future climate: implement the verified source per decision D2 (NEX-GDDP-CMIP6 first; an alternative if it lacks a needed variable; `history_resample` only as the last fallback) as a seed-time extraction script plus `cmip6_delta` mode.
- **Owns:** `app/twin/climate.py`, `app/services/climate_outlook.py`, `app/routers/climate_outlook.py`.
- **Done when:** responses match the `ClimateOutlook` schema; Beltsville numbers match the existing features pipeline; trends carry p-values and "not significant" flags; documented hand-checked frost date for one site-year.

### W4: Exposure and zones (Group 2) (Wave 1)
- **Scope:** `app/twin/exposure.py`: vulnerable seasons per crop and stage, bare-field windows from plan timeline plus NDVI cross-check, erosion / water-stress / frost-pocket zones (extend `features/zones.py`; honest `resolution_note` for coarse layers; empty plus caveat when no terrain). UBC terrain package (check `app/terrain` and `data/seed` conventions; DEM from W2).
- **Owns:** `app/twin/exposure.py`, `app/features/zones.py`, `app/services/exposure.py`, `app/routers/exposure.py`.
- **Done when:** UBC Farm returns zones or a documented empty result; water-stress hotspot never claims finer detail than its source.

### W5: Crop catalog and farmer selection (Wave 0, data work)
- **Scope:** `data/seed/crops/catalog_v2.json` (+ sidecar): **at least 40 entries** covering vegetables (UBC-relevant brassicas, alliums, nightshades, cucurbits, legumes, roots, leafy greens), grains (winter/spring cereals, oats, spelt, barley, rye, buckwheat), forage (alfalfa, clovers, grass ley, vetch-oat), covers (fall rye, crimson clover, field peas, faba, phacelia, radish, mustard), each with full trait schema v2 and per-trait source or `TODO(verify)`. Sources: FAO-56 Table 12 for Kc; provincial or university extension guides (BC Ministry of Agriculture, WSU, Oregon State) for windows and return intervals; **record the URL**. Equipment enum. Loader `app/twin/catalog.py`, `GET /crop-catalog`, selection validation (`UNKNOWN_CROP`, `SELECTION_TOO_SMALL`). Port the 12 existing commodity crops (keep ids stable).
- **Owns:** `data/seed/crops/catalog_v2.*`, `app/twin/catalog.py`, `app/routers/crop_catalog.py`.
- **Done when:** schema validation test passes; every trait has a source; list of `TODO(verify)` items appended to `docs/todo-verify.md` (script exists); an agronomist review checklist in the progress note.

### W6a: Water, infiltration, weather ensemble (Wave 1)
- **Scope:** `weather_ensemble.py`, `water.py` per section 5.2–5.3. Unit tests: water conservation (rain + irrigation = ETc + runoff + drainage + Δstorage within 1e-6), determinism, scenario ramp, no negative storage.
- **Owns:** `app/twin/weather_ensemble.py`, `app/twin/water.py`.

### W6b: Soil carbon, nitrogen, pests (Wave 1)
- **Scope:** `soil.py`, `nitrogen.py`, `pest.py` per section 5.4. Tests: continuous monoculture raises pest index monotonically; adding a non-host year lowers it; legume year raises N balance; bare fallow lowers soil index versus cover crop under identical weather; all indices bounded.
- **Owns:** `app/twin/soil.py`, `app/twin/nitrogen.py`, `app/twin/pest.py`.

### W6c: Simulation loop and orchestration (Wave 1; needs W6a/b interfaces)
- **Scope:** `run.py`: expand cycle to 10 years, run members, aggregate p10/p50/p90 `YearSeries`, performance (vectorize across members; budget below). Golden tests with fixed seeds.
- **Owns:** `app/twin/run.py`, `tests/test_twin_run.py`.

### W7: Strategy generator and farm fit (Wave 1–2)
- **Scope:** `generate.py` per section 5.5, `farm_fit`, scorecard recomputation per 5.6, `water_vs_quota`, equipment and labour matching, forage and market indices, income, per-field generation. Tests: pinned/excluded honored, same-family spacing, vegetable-only/grain-only/mixed pools each yield valid plans, equal-weight selection then weighted ranking, determinism, no feasible alternatives warning.
- **Owns:** `app/twin/generate.py`, `app/twin/score.py`.

### W8: Sensitivity, uncertainty, flags, evidence (Wave 2)
- **Scope:** `explain/` package: sensitivity grid runner (reuses `simulate`; target <2 s for 15 cells × 3 strategies using fewer members, documented), `uncertainty.layers` table from seed sidecars, station-bias calc, review-flag rule engine (each flag lists the triggering layer and rule; e.g. SMAP resolution coarser than field, assumed N coefficients, unrated market crop, clubroot-prone family repeat per catalog), evidence cards and glossary (templates only; port existing `evidence.py` and `glossary.json`; no LLM).
- **Owns:** `app/twin/explain/**`, `data/seed/glossary.json` (new terms appended), `app/services/sensitivity.py`.

### W9: API, services, cache, migration (Wave 2)
- **Scope:** `services/forecast.py` composing W3/W4/W6/W7/W8; routers for `/forecast` and `/forecast/sensitivity`; request normalization and validation; on-disk cache keyed by `request_hash` under `data/cache/forecast/` (never required offline; seeds suffice); in-process LRU in front; fixtures regenerated from real engine output (`scripts/build_forecast_fixtures.py`); `tests/test_routes.py` updated; delete the legacy `rotation-analysis`/`compare` routes only after the web app calls `/forecast` (separate commit, with lead's go). Multi-field: rollup of per-field results to the farm total (area-weighted), farm-wide water quota shared across fields.
- **Owns:** `app/services/forecast.py`, `app/routers/forecast.py`, `app/main.py` (router registration), `scripts/build_forecast_fixtures.py`.

### W10: QA, validation, docs (runs across waves)
- **Scope:** (1) hindcast and sanity suite: POWER vs station, engine run against UBC Farm's planting records if the farm provides them, mass-balance checks; (2) determinism test (two runs, byte-equal JSON), offline test (network blocked), estimate-label test (every absolute estimate has basis and range), units/basis/confidence present on every number, `Source` license/attribution; (3) performance harness; (4) `docs/data-and-methods.md` (every dataset: source, license, attribution, resolution, record length, limits) and a check that every field named in section 12 exists in the real response; (5) the TODO(verify) report; (6) an integration smoke script `scripts/smoke_forecast.py` running all endpoints for all 4 sites.
- **Owns:** `services/api/tests/qa/**`, `docs/**` (except others' progress notes), `scripts/smoke_forecast.py`.

## 8. File ownership and conflict rules

Shared files and who may edit them: `features/config.py` (W1 sites and sources; W3 thresholds only by request), `features/seeds.py` (W2 appends loader functions), `app/main.py` (W9), `packages/contracts/**` (W0; everyone else requests changes via `docs/progress/forecast-requests.md`), `data/seed/glossary.json` (W8 appends terms). Anything not listed above belongs to the workstream that creates it. Conflicts resolve with `git pull --rebase`; never force-push.

## 9. Performance, quality gates and acceptance

| Gate | Target |
| --- | --- |
| `GET /climate-outlook` | < 150 ms cached; < 1 s cold |
| `POST /forecast` | < 1.5 s cold (30 members × 3 strategies × 10 years); < 100 ms cached |
| `POST /forecast/sensitivity` | < 2 s cold |
| Determinism | Two identical requests → byte-identical JSON; ensemble seeded from request hash |
| Offline | `OFFLINE=1` with network blocked: UBC Farm + 3 curated sites pass the smoke script |
| Honesty | Every number has unit, basis, confidence; every absolute estimate (yield, income, fertilizer, soil loss) has a p10/p90 range; support sentence present; unreviewed constants are `TODO(verify)` |
| Provenance | Every dataset in `sources` has license, attribution, resolution; sidecars complete (existing test) |
| Coverage | All 5 groups in section 3 present in the response; any missing field is a failing test |
| Farmer selection | Vegetable-only, grain-only, forage-heavy and mixed pools all generate 3 strategies; pinned/excluded honored |
| Contract | Additive-only versus v1.1.0; fixtures validate; OpenAPI lint passes |

## 10. Build order and agent prompt

**Exactly 3 Grok sessions run at once: Session A, Session B, Session C.** Each session is one agent working its own workstreams in order, in its own git worktree, running `git pull --rebase` before every push. The user (team lead) pastes one brief below into each session.

### 10.1 Who works on what, and when (read this table first)

| Phase | Session A: Foundation | Session B: Engine | Session C: Outputs and integration |
| --- | --- | --- | --- |
| **1. Start (first ~30 min)** | Pushes **only** `app/twin/types.py` (shared types) | **Reads** the repo, then waits for A's types commit | **Reads** the repo, then waits for A's types commit |
| **2. Core build** | W0 contract, then W1 UBC site, then W5 crop catalog | W6a water, then W6b soil/nitrogen/pests, then W6c simulation loop | W3 climate outlook, then W10 test harness |
| **3. Second half** | W2 satellite seeds, then W4 exposure and zones | W7 strategy generator and farm fit | **Waits** for B's W6c, then W8 sensitivity/flags/explanations |
| **4. Integration** | Session A is **finished** after W4 | Session B is **finished** after W7 | **Waits** for B's W7 and A's W4, then W9 API, then W10 final checks |
| **Finish line** | `SESSION A FINISHED` | `SESSION B FINISHED` | `SESSION C FINISHED`, then the team lead merges |

### 10.2 Stop rules (apply to all three sessions)

A session **stops** in exactly three situations and never at any other time:
1. **FINISHED:** it completed every workstream on its list. It prints `SESSION <X> FINISHED` plus a 5-line summary.
2. **WAITING:** a file it needs is not on `main` yet (see each brief). It prints `SESSION <X> WAITING FOR <session>:<workstream>`, does **not** guess or build a stand-in for another session's files, and waits for the user to paste `continue`. The user pastes `continue` once the other session has pushed.
3. **BLOCKED:** it needs a decision, a credential or a fact it cannot verify. It prints `SESSION <X> BLOCKED: <question>` and waits for the user.

After **each workstream** (not only at the end) a session: runs its tests and shows the result, writes `docs/progress/FT-<ID>.md`, commits with the prefix `FT-<ID>:` after `git pull --rebase`, pushes, then prints `<ID> DONE`. It then moves straight to the next workstream on its list unless a stop rule applies.

Cross-session requests (a change needed in a file another session owns) go in `docs/progress/forecast-requests.md`. Each session reads that file before it starts a workstream.

### 10.3 Session A brief (Foundation)

```text
You are SESSION A of 3 Grok sessions building the FieldTwin backend. Your workstreams, in order: W0, W1, W5, W2, W4.
Read first: CLAUDE.md, then docs/backend-forecast-prd.md sections 0, 1, 3, 4, 6, 7 (W0, W1, W5, W2, W4), 8, 9, 10.2.
You own: packages/contracts/**, app/twin/types.py, app/twin/__init__.py, data/seed/site_ubc_farm/**, data/seed/crops/catalog_v2.*, app/twin/catalog.py, app/routers/crop_catalog.py, scripts/seed_satellite/**, the new loaders in app/features/seeds.py, the site list in app/features/config.py, app/twin/exposure.py, app/features/zones.py, app/services/exposure.py, app/routers/exposure.py.
You must NOT edit: apps/web/** (frontend is out of scope), app/twin/{water,weather_ensemble,soil,nitrogen,pest,run,generate,score,climate}.py, app/twin/explain/**, app/services/forecast.py, app/routers/forecast.py (Sessions B and C own those).
Order of work:
 1. FIRST COMMIT (within about 30 minutes): app/twin/types.py with the dataclasses and stubs from PRD 6.4 only. Push. Print "TYPES PUSHED: tell Sessions B and C to continue".
 2. W0 contract v1.2.0 + fixtures. Do not touch apps/web. Print "W0 DONE: tell the team (the frontend team can now run make types)".
 3. W1 UBC Farm site + POWER and SoilGrids seeds. Verify coordinates with a source URL.
 4. W5 crop catalog (40+ crops) with traits and sources. Push as soon as it validates; Session B uses it.
 5. W2 satellite seeds. If Earthdata credentials are missing, print SESSION A BLOCKED and ask the user.
 6. W4 exposure and zones.
STOP rules: only FINISHED (after W4), WAITING (not expected for you) or BLOCKED. Follow PRD 10.2 after every workstream.
Never invent endpoints, fields, enum values, dataset names, URLs, constants or licenses; mark unverified values TODO(verify) with a source URL. Deterministic output, OFFLINE=1 compatible, no LLM calls, every number with unit + basis + confidence, absolute estimates with p10/p90 range.
```

### 10.4 Session B brief (Engine)

```text
You are SESSION B of 3 Grok sessions building the FieldTwin backend. Your workstreams, in order: W6a, W6b, W6c, W7.
Read first: CLAUDE.md, then docs/backend-forecast-prd.md sections 0, 1, 3 (groups 3 and 4), 5, 6, 7 (W6a, W6b, W6c, W7), 8, 9, 10.2; also docs/progress/rotation-A.md and rotation-B.md and the code in services/api/app/features/pipeline.py (reuse its weekly tables and scenario resolver).
You own: app/twin/{weather_ensemble,water,soil,nitrogen,pest,run,generate,score}.py, app/twin/config.py, tests for these.
You must NOT edit: apps/web/** (frontend is out of scope), app/twin/types.py (Session A), packages/contracts/** (Session A), app/twin/{climate,exposure}.py, app/twin/explain/**, services and routers (Sessions A and C).
Order of work:
 0. Read the repo. Then run git pull. If app/twin/types.py is not on main, STOP with "SESSION B WAITING FOR A:types" and wait for the user to paste "continue".
 1. W6a water + infiltration + weather ensemble.
 2. W6b soil carbon + nitrogen + pests.
 3. W6c simulation loop (uses your own W6a/W6b, so no wait).
 4. W7 strategy generator and farm fit. Use app/twin/catalog.py and data/seed/crops/catalog_v2.json if Session A has pushed them. If not, use a 5-crop stub in tests only and do NOT stop; switch to the real catalog when it appears.
Print "W6c DONE: Session C can start W8" and "W7 DONE: Session C can start W9" when those finish.
STOP rules: only FINISHED (after W7), WAITING (only at step 0) or BLOCKED. Follow PRD 10.2 after every workstream.
Never invent endpoints, fields, enum values, dataset names, URLs, constants or licenses; mark unverified values TODO(verify) with a source URL. Deterministic output (seed from request hash), OFFLINE=1 compatible, no LLM calls, every number with unit + basis + confidence, absolute estimates with p10/p90 range.
```

### 10.5 Session C brief (Outputs and integration)

```text
You are SESSION C of 3 Grok sessions building the FieldTwin backend. Your workstreams, in order: W3, W10 (test harness), W8, W9, W10 (final).
Read first: CLAUDE.md, then docs/backend-forecast-prd.md sections 0, 1, 3 (all groups), 5.3, 6, 7 (W3, W8, W9, W10), 8, 9, 10.2; also docs/progress/rotation-A.md and rotation-B.md and services/api/app/features/pipeline.py and services/api/app/rotation/evidence.py.
You own: app/twin/climate.py, app/services/climate_outlook.py, app/routers/climate_outlook.py, app/twin/explain/**, app/services/sensitivity.py, app/services/forecast.py, app/routers/forecast.py, app/main.py (router registration only), scripts/build_forecast_fixtures.py, scripts/smoke_forecast.py, services/api/tests/qa/**, docs/** (except other sessions' progress notes).
You must NOT edit: apps/web/** (frontend is out of scope), app/twin/types.py, packages/contracts/** (Session A), app/twin/{water,weather_ensemble,soil,nitrogen,pest,run,generate,score}.py (Session B), seeds and catalog (Session A).
Order of work:
 0. Read the repo. Then run git pull. If app/twin/types.py is not on main, STOP with "SESSION C WAITING FOR A:types" and wait for the user to paste "continue".
 1. W3 climate outlook (needs only existing POWER data).
 2. W10 test harness: determinism, offline, estimate-label, units/basis/confidence, performance, hindcast skeleton.
 3. W8 sensitivity, uncertainty, flags, evidence. Before starting, git pull. If simulate() in app/twin/run.py is still a stub, STOP with "SESSION C WAITING FOR B:W6c".
 4. W9 API, cache, fixtures. Before starting, git pull. If app/twin/generate.py or app/twin/exposure.py is still a stub, STOP with "SESSION C WAITING FOR B:W7 / A:W4" (say which one is missing).
 5. W10 final: docs/data-and-methods.md, a check that every field named in section 12 exists in the real response, TODO(verify) report, 4-site smoke script (UBC Farm + 3 curated sites, OFFLINE=1).
STOP rules: FINISHED (after step 5), WAITING (steps 0, 3, 4 only), or BLOCKED. Follow PRD 10.2 after every workstream.
Never invent endpoints, fields, enum values, dataset names, URLs, constants or licenses; mark unverified values TODO(verify) with a source URL. Deterministic output, OFFLINE=1 compatible, no LLM calls, every number with unit + basis + confidence, absolute estimates with p10/p90 range.
```

### 10.6 What the team lead does

1. Open three Grok sessions and paste the A, B and C briefs.
2. When Session B or C prints `WAITING FOR ...`, check that the named session has pushed, then paste `continue` into the waiting session.
3. When all three print `FINISHED`, review `docs/progress/FT-*.md`, run `make test`, and merge.
4. Do not start a fourth session. If a session finishes early, assign it a stretch item (none planned; ask the lead) only after the lead approves.

## 11. Risks

1. **Seed data availability (W2).** Earthdata access and product choice can stall. Mitigation: W2 starts first; the engine runs without satellite layers (`data_mode: limited_data`, lower confidence); nothing is faked.
2. **Constants without sources.** Many coefficients are assumptions. Mitigation: all in `twin/config.py` or the catalog, each echoed in the response `assumptions` list; agronomist review (W5 checklist) before the demo.
3. **POWER bias at Vancouver.** Mitigation: station hindcast and `station_bias` shown in `uncertainty`; no silent correction in v1.
4. **Scope.** Water-stress sub-field hotspots are stretch; multi-field and the future-climate source are core. Core path = UBC site, catalog, engine, `/forecast`.
5. **Frontend lag.** The frontend team is not part of this build. Mitigation: W0 publishes fixtures for every new response on day 1 so the frontend can start against the final shapes; section 12 is their requirements list.

## 12. Frontend and UI requirements (a list for the frontend team; nothing here is built by the backend sessions)

This is everything the frontend and UI need in order to use the forecast. Field names refer to the response in section 6.3. Frontend work happens in `apps/web/` and is owned by the frontend team.

### 12.1 Rules the UI must follow (from CLAUDE.md and this PRD)
- Every number is shown with its unit, its basis label (`measured / derived / modeled / assumed / relative`) and its confidence; absolute estimates (yield, income, fertilizer, soil loss) also show the p10-p90 range.
- Show "This tool supports, and does not replace, local agronomic expertise." wherever the response carries `support_sentence`, and show `disclaimer`.
- Curated sites show a "Pre-built" badge; mock data shows a "mock" badge in dev and must never reach the demo; synthetic demo farms show "Synthetic demo data".
- Drone and video capture appear only as Roadmap items, never as working features.
- Show the data attribution (source, license, attribution) from `sources`.
- Render unknown enum values neutrally (no crash, no blank screen).
- Plain-language wording comes from the API (templates, glossary); the UI does not write agronomy advice itself.

### 12.2 Screens and views needed
| # | View | What it must show or let the user do | Data it uses |
| --- | --- | --- | --- |
| 1 | Farm setup | Add 1-20 fields: name, area, slope class, soil override, irrigation yes/no and quota, optional polygon, each field's current rotation (preset or slot grid) | request `fields[]` |
| 2 | Crop selection | Browse by category (vegetable, grain, forage, cover, fruit), search, pick the farm pool, pin and exclude crops, per-field override, see traits and their sources | `GET /crop-catalog` |
| 3 | Farmer inputs | Equipment list, labour level, no-till, livestock on farm, farm-wide water quota, buyer-demand ratings 1-5 per crop, crop prices and input costs with currency, priority weights or presets, strategy count 2-4, optional custom strategies editor (year x season grid) | request `constraints`, `market_ratings`, `economics`, `priorities`, `custom_strategies` |
| 4 | Climate outlook | Seasonal temperature drift, heat-stress days by year, frost windows (last spring, first fall, season length), rainfall totals and extremes, ET and soil-moisture anomalies, water balance, regional groundwater context; baseline vs scenario | `GET /sites/{id}/climate-outlook` |
| 5 | Scenario controls | Named scenario presets (default), optional sliders for temperature, overall rain and seasonal rain labelled "reached by Year 10", visible climate source (`cmip6_delta` or `history_resample`), live update while dragging (debounced) | request `scenario`, `climate_source`; response `scenario` |
| 6 | Exposure and vulnerability | Calendar of vulnerable crop seasons, bare-field timeline, map zones (erosion, water-stress, frost pockets) with the resolution note, per field | `GET /sites/{id}/exposure`, `GET /sites/{id}/zones` |
| 7 | Strategy comparison | Year 0-10 line charts with p10-p90 bands for each trajectory metric, strategy toggle, year scrubber, 10-year plan grid (crop per season per year), 7-criteria scorecard, farm-fit cards (water vs quota status, forage, operational, market fit), yield, income, fertilizer need and saved, soil loss; per-field and farm-rollup toggle | `forecast.fields[]`, `farm_rollup` |
| 8 | Sensitivity | Rain x temperature grid per strategy, rank stability | `POST /sites/{id}/forecast/sensitivity` |
| 9 | Evidence and review flags | Why / evidence / risks card per strategy, review flags with severity (info, caution, verify) and the layer that triggered each, "needs local validation" markers | `evidence_card`, `review_flags` |
| 10 | Data and methods | Layer table (native resolution, record years, confidence, resolution note, local validation need), station bias, sources with license and attribution, list of assumptions | `uncertainty`, `sources`, `assumptions` |
| 11 | Glossary | Term tooltips and a glossary page | `GET /glossary` |
| 12 | 3D twin view (decision needed) | Optional: show the farm model with zone overlays and a Year 0-10 scrubber that changes the visuals from the trajectories | existing `/terrain/*` plus forecast |

### 12.3 States every view needs
- Loading (cold forecast can take up to about 1.5 s, sensitivity up to about 2 s), cached results (under about 100 ms), and an in-progress state while sliders change.
- Empty and limited data: `data_mode: limited_data`, missing satellite layers, zones empty with a caveat, `income_estimate` is `null` (prices missing).
- Errors by code: `SITE_NOT_FOUND`, `UNKNOWN_CROP`, `SELECTION_TOO_SMALL`, `INVALID_QUOTA`, `INVALID_WEIGHTS`, `HORIZON_OUT_OF_RANGE`, `SCENARIO_OUT_OF_RANGE`; `NO_FEASIBLE_ALTERNATIVES` is shown at error level with the partial result.
- Offline mode: served from seeds; no spinner waiting on the network.

### 12.4 Frontend technical needs
- Regenerate API types after the contract bump (`make types`) and commit the result.
- API client for the five new endpoints plus `/crop-catalog`; a fixture mode that reads `packages/contracts/fixtures/` until the live engine is ready; `NEXT_PUBLIC_API_MODE=live` switches to the API.
- Debounce slider and input changes; reuse the response when `request_hash` is unchanged.
- Switch the existing Rotation Lab from `/rotation-analysis` and `/compare` to `/forecast`, then tell the backend lead so the old routes can be deleted (W9).
- Charts: line charts with uncertainty bands, a heatmap grid, a calendar/timeline, a map layer for zones; each chart needs a text or table alternative.

### 12.5 Quality needs
- Responsive from phone to desktop; keyboard operable; colour-blind-safe palettes; labels not by colour alone.
- Units shown consistently (mm, deg C, t/ha, kg N/ha, index with Year 0 = 100); the currency the farmer entered.
- Number formatting that keeps the range visible ("12.3 t/ha, range 9.8-14.1").

### 12.6 Decisions the frontend team or lead must make (not backend work)
- Whether to build the 3D twin view with a Year scrubber (view 12).
- Whether the user can export or share a forecast (PDF, CSV, link). No backend endpoint exists for this in this PRD; if wanted, the lead adds a workstream.
- Farm boundary and field drawing tool (map polygon draw) versus numeric entry only.
- UBC Farm branding, copy, and the farm story text.

### 12.7 What the backend guarantees to the frontend
- Additive contract only (v1.2.0 versus v1.1.0); fixtures for every new response published by W0 on day 1; real engine output replaces them in W9.
- Deterministic responses (same request gives the same bytes), so the UI can cache by `request_hash`.
- All wording for flags, evidence and glossary comes from the API.
