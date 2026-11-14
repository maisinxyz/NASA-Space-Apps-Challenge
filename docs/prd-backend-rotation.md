# FieldTwin: Backend PRD, Crop-Rotation Decision Support (v2, detailed)

Addendum to `prd.md`. Extends §2.4 (honesty), §6 (contract), BE-07 (crops and rotations) and BE-14 (relative index). Does not replace them. Frontend work is in a separate file, `docs/prd-frontend-rotation.md`.

---

## 1. Purpose, users, scope

**Purpose.** Help a farmer compare three crop rotations (the existing one plus two generated alternatives) for soil health and resilience to changing weather and water conditions. The backend fuses NASA Earth-observation data with local agricultural information, scores each rotation on seven criteria, and explains every result with evidence, information gaps and risks that need local review.

**Users.** Farmers with limited technical or geospatial experience, and agronomists or advisers who check the output. The backend never assumes the user understands GIS or statistics, so every number ships with units, a basis label and a plain-language note.

**In scope.** Data pipeline, feature table, rotation engine, farmer personalization, scenario sliders, vulnerability zones, glossary and explainer content, API and contract additions, tests.

**Out of scope.** Frontend, drone/video capture (Roadmap only, never shown working), any yield, profit or absolute soil-loss prediction, any claim that replaces local expertise.

**Required sentence** in every rotation result: "This tool supports, and does not replace, local agronomic expertise."

---

## 2. Honesty rules (from `prd.md` §2.4, applied to this PRD)

1. Every number has units and one basis label: `measured`, `derived`, `modeled`, `assumed` or `relative`.
2. Scores are relative indices (0–100) across the three rotations. They are comparisons, never predictions.
3. Determinism: same inputs give byte-identical outputs (see §13).
4. `OFFLINE=1` serves seed data and cache only, with no external calls. A cache miss returns a clear error, never a guess.
5. Curated sites show a "Pre-built" badge. Mock data shows a "mock" badge in dev and must never reach the demo.
6. Every dataset is listed with source, license and attribution. Anything unverified is marked `TODO(verify)`.
7. No invented endpoints, fields, enum values, URLs or parameters. If the contract lacks something, stop and ask.
8. Scenario results are labelled "modeled scenario, not a forecast".

---

## 3. Current state (what exists, what does not)

| Area | State |
|---|---|
| NASA POWER client | Real (`services/api/app/weather/power.py`): fetches PRECTOTCORR, T2M, T2M_MAX, T2M_MIN, GWETROOT, GWETTOP; caches to `data/cache/weather/`; `OFFLINE=1` reads cache only. **No route calls it.** |
| Terrain and analysis | Real: slope, D8 flow accumulation, depressions (`services/api/app/terrain/`, `analysis/`). |
| Weather summary, crops, rotations, simulations, scans, sites | Fixtures only (`providers/fixtures.py`). Every simulation returns `sim_mock_001`. |
| SMAP, GPM, MODIS/HLS NDVI, ECOSTRESS, GEDI, GRACE code | None. |
| Contract v1.0.0 | Has `Rotation`, `CoverCalendar`, `EvidenceCard`, `Basis`, `BasisOrRelative`, `CropTemplate`. No uncertainty field, farmer priorities, frost, vulnerability seasons or scenario input. |
| Contract request v1.1 | Draft in `implementation-plan/contract-request-v1.1.md`: `Scenario`, `HazardCalendar`, `HazardCatalog`, `ZoneCollection`, `RotationComparison`. Not applied. |
| Frontend rotation scores | Hand-written 1–5 values in `apps/web/lib/twin/rotations.ts`. This PRD replaces them with API values. |

---

## 4. Brief-to-feature traceability

| Brief item | Backend feature | Section | Status |
|---|---|---|---|
| Temperature, rain, soil moisture, evaporation, frost, extreme precipitation | Weekly feature table from POWER | 7 | MVP |
| Soil-moisture anomaly | Weekly z-score vs multi-year normal; SMAP cross-check on seeded sites | 7.3 | MVP / limited |
| Evapotranspiration, water balance | Temperature-based reference ET, rain minus ET | 7.3 | MVP |
| Vegetation stress, NDVI | Seeded NDVI series and anomaly | 7.3 | limited (1–2 sites) |
| Heat stress | Heat-day probability | 7.3 | MVP |
| Bare-field periods | Cover calendar per rotation | 8.4 | MVP |
| Seasons of vulnerability | Hazard calendar and vulnerable-season windows | 7.4 | MVP |
| Harmonize datasets to a common grid | Common weekly time step now; common spatial grid designed | 7.5 | time: MVP, space: Phase 2 |
| GPM, ECOSTRESS, GEDI, GRACE | Design documented only | 7.5, 17 | Phase 2 |
| 3 rotations incl. existing | Existing + 2 generated | 8 | MVP |
| 7 comparison criteria | Seven-criteria scorecard | 8.4 | MVP |
| Why, evidence, benefits, gaps, risks | Evidence card per rotation | 8.7 | MVP |
| Farmer priorities, constraints | Request fields | 9 | MVP |
| Uncertainty, where local expertise is needed | Ranges, confidence, review notes | 10 | MVP |
| Satellite vs ground measurements | Glossary entry | 11 | MVP |
| N-fixing, cover, deep-rooted, drought-tolerant explainers | Explainer content | 11 | MVP |
| Zones: erosion, water stress, frost | Zone layers | 12.2 | MVP stretch |
| Rainfall/temperature sliders | Scenario input | 12.1 | MVP |

---

## 5. Architecture and file layout (proposals; follow existing repo conventions where they differ)

```
services/api/app/
  weather/power.py              (exists; reused)
  features/                     NEW  Backend A
    pipeline.py                 orchestrates load -> clean -> harmonize -> features
    harmonize.py                resample to the weekly frame, record resolution notes
    climatology.py              per-week normals, percentiles, z-scores
    et0.py                      temperature-based reference ET
    hazards.py                  frost, heat, extreme-rain, dry-spell probabilities
    quality.py                  data-quality flags
    zones.py                    erosion, water-stress, frost zones (stretch)
    seeds.py                    load NDVI/SMAP/soil seed files + sidecars
  rotation/                     NEW  Backend B
    traits.py                   crop-trait library loader and validation
    generate.py                 alternative-rotation generator
    score.py                    seven-criteria scoring and normalization
    uncertainty.py              per-year resampling, p10/p90, confidence
    evidence.py                 evidence-card text builder
    scenario.py                 rain/temperature adjustment of the feature table
    glossary.py                 glossary and explainer loader
  routers/
    features.py  rotation_analysis.py  glossary.py  (zones/compare per v1.1)
data/seed/<site_id>/            soil.json, ndvi.json, smap.json (+ sidecar *.meta.json)
data/seed/crops/traits.json     crop-trait library (+ sources)
data/seed/glossary.json
packages/contracts/
  openapi.yaml                  bumped to 1.1.0
  schemas/feature_table.schema.json
  fixtures/feature_table_*.json  rotation_analysis_*.json  glossary.json  zones_*.json
```

Data flow:

```
POWER (live/cache) --+
NDVI/SMAP seeds -----+--> pipeline --> FeatureTable (JSON, versioned)
SoilGrids seed ------+                       |
Terrain package ---------------------------> zones
                                             v
Farmer request --> generate (3 rotations) --> score (7 criteria) --> uncertainty --> evidence --> RotationAnalysis
                      ^ trait library                 ^ scenario adjusts FeatureTable before scoring
```

The **feature table** is the only thing the two backend tracks share.

---

## 6. Datasets

| Dataset | Use | Mode | Source / license / attribution |
|---|---|---|---|
| NASA POWER daily point | Rain, mean/max/min temperature, root-zone and top-soil wetness | Live, cached | https://power.larc.nasa.gov/docs/services/api/ (already used in `power.py`); license and attribution text TODO(verify) |
| NDVI (HLS/Landsat or MODIS) | Vegetation stress, bare-field check | Seeded for 1–2 sites | Product, URL, license TODO(verify) |
| SMAP soil moisture | Cross-check of the POWER wetness anomaly | Seeded for 1–2 sites | Product, URL, license TODO(verify) |
| SoilGrids (ISRIC) | Texture, organic carbon, pH → infiltration class | Seeded for each curated site | URL, license, attribution TODO(verify) |
| FAO crop data (crop coefficients, EcoCrop-style traits) | Crop-trait library | Hand-curated static table | URL, license TODO(verify) |
| Commodity price series | Market signal | Lowest priority; if absent, market is `assumed` | TODO(verify) |
| Elevation / site DEM | Slope, flow accumulation, frost pockets | Existing terrain package | License TODO(verify) |
| GPM IMERG, ECOSTRESS, GEDI, GRACE/GRACE-FO | Rain, land-surface temperature, biomass, water storage | Phase 2 | Not built |

**Seed sidecar rule.** Every seed file `X.json` has `X.meta.json` with: `source_name`, `source_url`, `product_version`, `retrieved_on`, `license`, `attribution`, `resolution_spatial`, `resolution_temporal`, `processing_notes`. Missing sidecar fails the seed validation test.

**Site scope.** Three curated sites in different climates run the full pipeline. Any other location gets POWER-derived features only and `limited_data: true`.

---

## 7. Feature pipeline (Backend A)

### 7.1 Inputs and cleaning
- Load POWER daily series for the site point. Use the existing client; reuse its cache path and `OFFLINE=1` behavior.
- Missing values stay `None`; never fill silently. Record `missing_fraction` per variable.
- Convert dates to ISO weeks (52-week frame; day 366 and week 53 fold into week 52 deterministically).

### 7.2 Climatology
For each variable and each of the 52 weeks, across all available years: mean, standard deviation, median, p10, p90, and the 95th percentile of wet-day rain. Climatology uses every available year (state `years.start` and `years.end` in the output).

### 7.3 Derived features (weekly, per site)

| Feature | Definition | Unit | Basis |
|---|---|---|---|
| `rain_mm` | weekly sum of PRECTOTCORR | mm | derived |
| `tmean_c`, `tmax_c`, `tmin_c` | weekly mean of T2M; weekly max of T2M_MAX; weekly min of T2M_MIN | °C | derived |
| `soil_wetness_root`, `soil_wetness_top` | weekly mean of GWETROOT, GWETTOP | 0–1 | modeled |
| `soil_moisture_anomaly` | (weekly mean wetness − climatological weekly mean) ÷ climatological standard deviation; if std is 0, anomaly is 0 | σ (unitless) | derived |
| `et0_mm` | Hargreaves–Samani style: `0.0023 · (Tmean + 17.8) · sqrt(Tmax − Tmin) · Ra`, with extraterrestrial radiation Ra from latitude and day of year. Constants and unit conversion TODO(verify). Chosen because the POWER client fetches temperature only. | mm | modeled |
| `water_balance_mm` | `rain_mm − et0_mm` | mm | modeled |
| `frost_prob` | share of years in which weekly `tmin_c ≤ frost_threshold` (assumed 0 °C; crop-specific thresholds come from traits) | 0–1 | derived |
| `heat_prob` | share of years in which weekly `tmax_c ≥ heat_threshold` (assumed value, stated in output; crop-specific via traits) | 0–1 | derived |
| `extreme_rain_prob` | share of years with at least one day at or above the 95th percentile of wet-day rain | 0–1 | derived |
| `dry_spell_prob` | share of years in which the week sits inside a run of N consecutive days below a rain threshold (N and threshold assumed and stated) | 0–1 | derived |
| `ndvi`, `ndvi_anomaly` | seeded series; anomaly = z-score vs weekly normal | index, σ | measured / derived |
| `smap_anomaly` | seeded; z-score vs weekly normal; used only as a cross-check | σ | measured / derived |

Per-year versions of every feature are kept (a `by_year` array) because the uncertainty step in §10 resamples years.

### 7.4 Hazard calendar and vulnerable seasons
- `HazardCalendar` (v1.1 shape): `j_wet[52]` (share of years with heavy rain on wet ground) and `j_dry[52]` (share of years in a dry spell), plus `thresholds` and `caveats` (e.g. "rain is not bias-corrected").
- `vulnerable_season` for a rotation = weeks where a crop is in the ground and any of `frost_prob`, `heat_prob`, `dry_spell_prob`, `extreme_rain_prob` exceeds a stated threshold (assumed 0.25, stated, adjustable in config).
- `HazardCatalog` entries: heavy rain on wet ground, multi-day heavy rain, dry spell, heat spell, late frost, each with `years_with_event`, `years_total`, `peak_weeks`.

### 7.5 Harmonization
- **MVP:** everything is resampled to one weekly time step per site. Daily series are aggregated (sum for rain, mean/min/max for temperature, mean for wetness). Seeded series with a coarser step (for example 8-day or 16-day NDVI) are linearly interpolated to weekly and flagged `interpolated: true`. Each source keeps its original resolution in `sources_used[].resolution_note`.
- **Phase 2 design (documented, not built):** use the terrain grid as the common analysis grid. Coarse rasters (SMAP, GPM) resample by bilinear or nearest neighbour; fine rasters (NDVI) aggregate by area-weighted mean. The feature table records the method per source so the farmer can see what was blended.

### 7.6 Data-quality flags
Per site: `years_available`, `missing_fraction` (per variable), `sources_used[]`, `sources_agree` (for soil moisture where POWER wetness and SMAP both exist: agree when the anomaly signs match in at least 70% of weeks; threshold assumed), `resolution_note`, `interpolated_series[]`, `limited_data` (true when there is no seeded satellite or soil data). These flags drive the confidence labels in §10.

### 7.7 Feature table (the seam)
JSON, validated by `packages/contracts/schemas/feature_table.schema.json`:

```json
{
  "schema_version": "1.1.0",
  "site_id": "site_example",
  "years": { "start": "1991-01-01", "end": "2024-12-31" },
  "weeks": 52,
  "features": {
    "rain_mm":              { "unit": "mm",  "basis": "derived", "median": [0, "..52 values.."], "p10": [], "p90": [], "by_year": {} },
    "soil_moisture_anomaly":{ "unit": "sigma","basis": "derived", "median": [], "by_year": {} }
  },
  "thresholds": { "frost_c": 0, "heat_c": "assumed, see config", "extreme_rain_percentile": 95 },
  "quality": {
    "years_available": 34, "missing_fraction": { "rain_mm": 0.01 },
    "sources_used": [ { "name": "NASA POWER", "resolution_note": "regional estimate" } ],
    "sources_agree": null, "limited_data": true
  },
  "sources": [],
  "caveats": ["Illustrative values only; rain not bias-corrected"]
}
```

---

## 8. Rotation engine (Backend B)

### 8.1 Crop-trait library
About 12 crops in `data/seed/crops/traits.json`, hand-curated. Each row has a `source` field per trait. **All values below are starting proposals, marked TODO(verify), and must be checked against the cited FAO source before the demo.**

Fields: `id`, `name`, `family`, `season_window` (start/end week), `water_need_class` (low/medium/high), `kc_stages` (FAO crop-coefficient values per stage, TODO(verify)), `root_depth_class` (shallow/medium/deep), `nitrogen_fixer` (bool), `cover_crop` (bool), `drought_tolerance` (low/medium/high), `frost_tolerance_c` (TODO(verify)), `heat_limit_c` (TODO(verify)), `residue_class` (low/medium/high), `forage_suitable` (bool), `market_rating` (high/medium/low, assumed), `market_dependent` (bool), `needs_specialty_equipment` (bool), `cover_curve` (monthly cover 0–1).

Starter crop set (names only; traits to verify): maize, wheat, barley, soybean, field pea, alfalfa, red clover (cover/forage), cereal rye (cover), sorghum, millet, sunflower, canola. Replace any crop that does not suit the three chosen sites' climates.

Validation test: every row has all fields, every field has a source or `TODO(verify)` flag, families are non-empty, season windows are valid weeks.

### 8.2 Rotation definition
A rotation is an ordered list of **slots**, each slot being `{ year_index, season, crop_id }` where `season` is `spring`, `summer`, `fall` or `winter`, and `crop_id` may be a cover crop or `fallow`. The cycle length (number of years) is taken from the existing rotation. The existing rotation comes from the farmer, or from the site preset (`preset` value).

### 8.3 Alternative generator (deterministic)
1. Candidate crops = farmer's `allowed_crops` ∩ crops whose `season_window` fits the slot ∩ constraint filters (`low_water` excludes `water_need_class = high`; `no_specialty_equipment` excludes `needs_specialty_equipment`; `no_local_market` excludes `market_dependent`).
2. Enumerate sequences with depth-first search in a fixed order (crop id ascending). Rules: no same-family crop in consecutive cropping seasons, every crop inside its season window, cycle length equal to the existing rotation. Cap enumeration at 5,000 candidates (stop in the same deterministic order).
3. Score each candidate with the §8.4 scoring and the farmer's weights.
4. Pick alternative 1 as the highest weighted score. Pick alternative 2 as the highest weighted score among candidates that differ from alternative 1 by at least one crop. Break ties by lexicographic comparison of the crop-id sequence.
5. If fewer than two feasible alternatives exist, return what exists plus an error-level warning `NO_FEASIBLE_ALTERNATIVES` with the reason (which constraint removed candidates).

### 8.4 Seven criteria (raw formulas, relative normalization)
Let `R` be a rotation and `w` its weeks. All thresholds and coefficients below are **assumed** and live in one config file so reviewers can see and change them.

| # | Criterion | Raw value | Direction | Basis |
|---|---|---|---|---|
| 1 | Nutrient cycling (incl. N fixing) | `0.5·legume_share + 0.3·mean_residue + 0.2·cover_share` | higher = better | derived |
| 2 | Erosion risk | `Σ_w bare_w · (1 + k·extreme_rain_prob_w) · terrain_factor · infiltration_factor` | lower = better | modeled |
| 3 | Organic matter | `0.5·mean_residue + 0.3·cover_share + 0.2·perennial_share` | higher = better | derived |
| 4 | Pest-cycle disruption | `distinct_families / cycle_length − penalty·(same-family within 2 seasons)` | higher = better | derived |
| 5 | Water use | `Σ_growing_weeks max(0, Kc_w · et0_w − rain_w)` (seasonal deficit, mm); soil infiltration class adjusts retained rain | lower = better | modeled |
| 6 | Forage potential | `forage_share + 0.5·grazing_compatible_cover_share` | higher = better | derived |
| 7 | Market suitability | mean of `market_rating` (high=1, medium=0.5, low=0); crops flagged `market_dependent` score 0 when `no_local_market` is set | higher = better | assumed |

Definitions:
- `bare_w` = 1 if the rotation's monthly cover for week `w` is below 0.30 (threshold assumed), else 0. `days_bare_per_year` and `monthly_cover` come from the existing `CoverCalendar` shape.
- `k` = weight on heavy-rain weeks (assumed, in config).
- `terrain_factor` = relative, field mean = 1, from slope and flow accumulation (v1.1 `Zone.terrain_factor` definition). For sites without a terrain package, `terrain_factor = 1` and the card says so.
- `infiltration_factor` = from SoilGrids texture class (finer, lower infiltration → higher factor; mapping table in config, TODO(verify)). Absent soil data → 1 and a gap noted.
- `legume_share` = share of cropping seasons with `nitrogen_fixer`; `cover_share` = share of off-season weeks with a cover crop; `perennial_share` = share of weeks occupied by a perennial crop.

**Normalization.** For each criterion, min-max across the three rotations to 0–100, flipped for "lower = better" so a higher score is always better. If all three raw values are equal, each scores 50 and the card states "no difference between these rotations on this criterion".

**Overall.** `overall = Σ_i weight_i · score_i` over the selected criteria, with weights normalized to sum to 1. Weights reorder rotations only. The per-criterion scores never change when weights change. This is a tested invariant.

### 8.5 Rotation analysis result (illustrative)
```json
{
  "site_id": "site_example",
  "engine_version": "1.0.0",
  "scenario": { "preset": "baseline", "rain_scale_pct": 0, "temp_offset_c": 0, "label": "modeled scenario, not a forecast" },
  "limited_data": false,
  "rotations": [
    {
      "rotation_id": "rot_existing",
      "is_existing": true,
      "sequence": [ { "year_index": 1, "season": "summer", "crop_id": "maize" } ],
      "cover_calendar": { "days_bare_per_year": 150, "monthly_cover": [0.1, "..12 values.."] },
      "scorecard": [
        {
          "criterion": "erosion_risk",
          "score": 20, "unit": "index 0-100, higher is lower risk", "basis": "modeled",
          "range": { "p10": 10, "p90": 35 },
          "confidence": "medium",
          "needs_local_review": false,
          "inputs": [ { "name": "days_bare_per_year", "value": 150, "unit": "days", "basis": "derived" } ]
        }
      ],
      "overall": 41,
      "rank": 3,
      "rank_stability": "ranked last in 76% of resampled years",
      "exposure": {
        "winter": { "value": 0.8, "p10": 0.6, "p90": 0.95, "basis": "relative" },
        "summer": { "value": 0.5, "p10": 0.3, "p90": 0.7, "basis": "relative" }
      },
      "evidence_card": {}
    }
  ],
  "weights_applied": { "erosion_risk": 0.4, "water_use": 0.6 },
  "warnings": [],
  "disclaimer": "This tool supports, and does not replace, local agronomic expertise."
}
```
All numbers above are illustrative placeholders.

### 8.6 Existing exposure comparison
Winter and summer exposure (value, p10, p90, `rank_stability`) follows the v1.1 `RotationComparison` shape. The scorecard is a separate object returned by the same analysis and compare calls. Erosion and water use read the exposure inputs rather than recomputing them.

### 8.7 Evidence card (per rotation)
Fields: `why_suggested`, `evidence[]` (each with value, unit, basis, source), `benefits[]`, `information_gaps[]`, `risks_for_local_review[]`, `support_not_replace`.

Text rules:
- `why_suggested` names the farmer's selected criteria, weights and constraints that drove the ranking ("ranked first because you weighted water conservation highest and it adds a legume").
- `evidence` lists the three to five feature values behind the top criteria, with units and basis.
- `information_gaps` always lists what is missing (no satellite cross-check, no soil sample, placeholder market rating).
- `risks_for_local_review` always includes the items a farmer or agronomist must check: planting window, soil test, equipment fit, local price, pest history.
- Where a score depends on trait data only, the card says "based on typical crop traits, not measured on your field".

---

## 9. Farmer personalization (request)

| Field | Type | Rule |
|---|---|---|
| `site_id` | string | Curated site, or a location (lat/lon) that triggers the limited-data path |
| `existing_rotation` | slot list or `"preset"` | Validated with the existing `/rotations/validate` rules |
| `criteria_selected` | subset of 7 ids | Empty or missing → all 7 |
| `weights` | map criterion → number ≥ 0 | Normalized; all zero → `INVALID_WEIGHTS`; keys outside `criteria_selected` ignored with a warning |
| `weight_preset` | `water`, `income`, `soil_structure`, `erosion`, `forage` | Optional shortcut; explicit `weights` override it |
| `constraints` | `low_water`, `no_specialty_equipment`, `no_local_market` (booleans) | Filters generator candidates |
| `allowed_crops` | crop ids | Must exist in the trait library, else `UNKNOWN_CROP` |
| `scenario` | preset name or `{ rain_scale_pct, temp_offset_c }` | See §12.1 |

The response echoes the normalized request (`request_echo`) so the frontend can show what drove the result and the same request can be replayed exactly.

---

## 10. Uncertainty

**Ranges (p10/p90)** only where historical years can be resampled: water use, erosion risk, exposure values. For each historical year, recompute the criterion from that year's weekly features, then take p10 and p90 across years. No random numbers, so results are reproducible.

**Rank stability.** For each rotation, the share of historical years in which it keeps its overall rank. Shown as text ("ranked first in 82% of resampled years"), basis `relative`.

**Trait-driven criteria** (nutrient cycling, organic matter, pest disruption, forage, market) have no year-to-year spread. They get `confidence: "low"` and `needs_local_review: true`, and **no invented range**.

**Overall confidence label** (high / medium / low) from the data-quality flags:
- high: at least 20 years of data, missing fraction under 5%, satellite cross-check agrees, not limited-data;
- medium: at least 20 years, no cross-check or small disagreement;
- low: limited-data site, under 20 years, or sources disagree.
(Thresholds assumed; stated in output.)

**Where local expertise is required** (always listed): soil sampling, local planting windows, equipment fit, local prices, pest history, local thresholds for frost and heat.

---

## 11. Explainer content (served by the API, static JSON, works offline)

`GET /glossary` returns entries `{ id, term, short, long, how_we_use_it, source }`. Starter entries (plain language, reviewed before demo):

- **Evapotranspiration (ET):** water leaving the ground through soil evaporation and plant transpiration; the "thirst" of the field. We estimate a reference value from temperature, so it is modeled, not measured.
- **Water balance:** rain minus evapotranspiration. Positive weeks add moisture; negative weeks dry the soil.
- **Soil-moisture anomaly:** how much wetter or drier the soil is than normal for that week, in standard deviations. Zero is normal.
- **NDVI:** a satellite "greenness" score. Low values in the growing season can signal stress or bare soil.
- **Frost risk:** the share of past years with freezing temperatures in that week. It is history, not a forecast.
- **Satellite vs ground-based measurements:** satellites cover every field but see coarse pixels and only the surface; ground sensors measure one point accurately and deeper, but miss the rest. Combining them lets satellite data show patterns and ground data check them. Our baseline weather values are regional satellite-model estimates, not field sensors.
- **Relative score:** a comparison between these three rotations only, not a prediction of yield or soil loss.

Crop-type explainers (`id`, `short`, `why_it_helps`, `limits`):
- **Nitrogen-fixing crops** (for example beans, peas, clover): bacteria on roots turn air nitrogen into plant food, which can reduce fertilizer need. Limit: benefit depends on inoculation and what follows in the rotation.
- **Cover crops:** keep soil covered between cash crops, which reduces erosion, adds organic matter and holds moisture. Limit: can use water that the next crop needs.
- **Deep-rooting crops:** open channels in compacted soil, draw water and nutrients from deeper layers, and improve structure over time. Limit: effect builds slowly.
- **Drought-tolerant crops:** need less water and hold up better in dry spells. Limit: may offer lower returns or fewer markets (local review).

Every explainer carries a `source` (`TODO(verify)` until checked) and links to the glossary term it uses.

---

## 12. Scenarios and zones

### 12.1 Scenario sliders
- Inputs: `rain_scale_pct` (suggested range −50 to +50) and `temp_offset_c` (suggested range −3 to +5). Ranges are config values, assumed.
- The four v1.1 presets map to fixed values: `baseline` (0, 0), `wetter_winters`, `drier_summers`, `both` (values stored in config and shown in the response; TODO(verify) with the team).
- Preset plus custom values: custom overrides the preset.
- Implementation: `scenario.py` multiplies weekly rain by `1 + rain_scale_pct/100` and adds `temp_offset_c` to temperature variables, recomputes `et0_mm`, `water_balance_mm`, frost, heat and extreme-rain probabilities from the adjusted per-year series, then runs the same scoring. No randomness.
- Response labels: "modeled scenario, not a forecast" and "built from observed years".

### 12.2 Vulnerability zones (derived, never measured; stretch after core scoring)
Returned as `ZoneCollection` per v1.1: GeoJSON polygon `outline`, `icon_point`, `area_ha`, `terrain_factor`, `basis`.
- **Erosion-risk zones:** high slope and high flow accumulation (reuse `terrain/` and `analysis/`).
- **Water-stress hotspots:** negative soil-moisture anomaly combined with low-infiltration soil classes.
- **Frost pockets:** low-lying cells where cold air would pool, from the elevation grid (relative low-point index).
Each zone has a plain-language label and says "derived from terrain and soil data, not field-measured".

---

## 13. Determinism, caching, offline

- **Determinism:** no random numbers; all sorts are stable with explicit tie-breaks; floats rounded to a fixed number of decimals before serialization; the engine writes `engine_version` and a `request_hash` (hash of the normalized request) into each response. Identical requests return byte-identical JSON.
- **Cache:** responses cached by `request_hash` + `engine_version` + feature-table version; stored under `data/cache/` (gitignored). POWER caching stays in the existing client.
- **Offline (`OFFLINE=1`):** features load from seed and the POWER cache only. A site without a cached series returns `WEATHER_UNAVAILABLE` (existing error), never a substitute.
- **Fixtures vs live:** each response includes `data_mode`: `"live"`, `"cached"`, `"seed"` or `"mock"`. A `"mock"` response must be impossible in the demo build (test in §16).

---

## 14. API and contract additions

All additive; require a bump to 1.1.0, a message to the team, and regenerated fixtures and types (`make fixtures`, `make types`). Merge with `implementation-plan/contract-request-v1.1.md` as one change. Endpoint names are proposals until the integrator applies them.

| Proposed endpoint | Purpose | Response |
|---|---|---|
| `GET /sites/{siteId}/features?scenario=` | Feature table and data-quality flags | `FeatureTable` |
| `POST /sites/{siteId}/rotation-analysis` | Farmer request → 3 rotations, scorecards, ranking, evidence | `RotationAnalysis` |
| `GET /sites/{siteId}/hazard-calendar?scenario=` | (v1.1) | `HazardCalendar` |
| `GET /sites/{siteId}/hazards` | (v1.1) | `HazardCatalog` |
| `GET /sites/{siteId}/zones` | (v1.1) | `ZoneCollection` |
| `GET /sites/{siteId}/compare?rotations=&scenario=` | (v1.1) exposure comparison | `RotationComparison` |
| `GET /crops` | Extend with trait fields | `CropTrait[]` |
| `GET /glossary` | Glossary and explainers | `GlossaryEntry[]` |

New or extended schemas: `FeatureTable`, `DataQuality`, `FarmerPriorities`, `RotationAnalysisRequest`, `RotationAnalysis`, `RotationScorecard` (criterion, score, unit, basis, range?, confidence, needs_local_review, inputs[]), `ScenarioInput`, `CropTrait` (extends `CropTemplate`), `GlossaryEntry`, `EvidenceCard` (reused). Enum additions: `Criterion` (the seven ids), `Confidence` (`high`, `medium`, `low`), `DataMode` (`live`, `cached`, `seed`, `mock`). Existing `Basis`/`BasisOrRelative` are reused as they are.

Compatibility rule (from the v1.1 request): new fields are optional, new endpoints are new paths, existing responses are unchanged. Frontend must render unknown enum values neutrally.

**Error codes** (use the existing error format, `prd.md` §6.6): `WEATHER_UNAVAILABLE` (existing), `UNKNOWN_CROP`, `INVALID_WEIGHTS`, `NO_FEASIBLE_ALTERNATIVES`, `SITE_NOT_FOUND`, `SCENARIO_OUT_OF_RANGE`. Each has a message and a "what to do next" line.

**Fixtures** to add: feature table (full-data site), feature table (limited-data site), analysis response (3 rotations, each with scorecard and evidence), analysis response with `NO_FEASIBLE_ALTERNATIVES` warning, zones, glossary, one scenario example.

---

## 15. Team split and task list (backend, 2 people)

**Seam:** the feature-table schema and fixtures. Both tracks start against fixtures.

### Backend A: data pipeline and integrator
| ID | Task | Depends on | Done when |
|---|---|---|---|
| A1 | Apply contract v1.1 (merge with the existing request), bump to 1.1.0, regenerate fixtures and types, announce | none | `make types` and contract tests pass; team told |
| A2 | Feature-table JSON Schema and fixtures (full-data and limited-data) | A1 | Schema validates both fixtures |
| A3 | Wire POWER into `features/pipeline.py` (cache, `OFFLINE=1`) | A2 | Pipeline output for three sites validates against the schema |
| A4 | Climatology, anomalies, ET0, water balance, hazards, quality flags | A3 | Unit tests on hand-computed small series |
| A5 | Seed loaders (SoilGrids, NDVI/SMAP for 1–2 sites) with sidecars | A2 | Seed validation test passes; sidecars complete |
| A6 | Hazard calendar and catalog endpoints | A4 | Match v1.1 shapes |
| A7 | Zones (stretch) | A4, terrain packages | Zone collection for each full-data site |
| A8 | Data and Methods payload: every dataset with source, license, attribution | A5 | No dataset missing a license or attribution field |

### Backend B: rotation engine and API
| ID | Task | Depends on | Done when |
|---|---|---|---|
| B1 | Trait library, loader, validation test | none | All rows pass validation; sources or `TODO(verify)` present |
| B2 | Scorer (seven criteria, normalization, weights) on the fixture feature table | A2 | Hand-checked example matches |
| B3 | Generator with constraints and tie-breaks | B1, B2 | Respects allowed crops and constraints; deterministic |
| B4 | Uncertainty: per-year resampling, p10/p90, rank stability, confidence | B2 | Ranges present only on climate-driven criteria |
| B5 | Evidence-card builder | B2, B4 | Cards name weights and constraints; gaps and risks always present |
| B6 | Scenario module | B2, A4 | Presets equal their custom-value equivalents |
| B7 | Routes: `rotation-analysis`, `compare`, `glossary`, `crops` | B3–B6 | Contract tests pass against fixtures |
| B8 | Glossary and explainer JSON, reviewed text | none | Every entry has `short`, `long`, `source` |
| B9 | Swap from fixture to live feature table | A3, A4 | Same tests pass with live-cached data for the three sites |

### Joint
- J1: API contract tests (schema conformance for every endpoint).
- J2: Replace `apps/web/lib/twin/rotations.ts` consumers with API data (coordinate with frontend pair).
- J3: Offline run and honesty-label audit.

---

## 16. Build sequence (ordered, no durations)

1. **Contract and fixtures first (A1, A2).** Unblocks all four people.
2. **Parallel tracks.** A builds the live pipeline (A3–A5). B builds trait library, scorer, generator and explainers against the fixture feature table (B1–B5, B8).
3. **Checkpoint 1:** B's engine returns three scored rotations from fixtures; A's pipeline returns a valid feature table for at least one site. Frontend can build against fixtures.
4. **Swap and integrate (B7, B9, J1, J2).** Engine runs on the live-cached feature table for all three sites.
5. **Stretch in order:** NDVI/SMAP seeds on the extra site, scenario custom values, zones (A7), price series.
6. **Checkpoint 2 (demo freeze):** tests, honesty audit, offline run, demo polish (J3).

**Cut order if behind:** price series → extra seeded NDVI/SMAP site → zones → scenario custom values (keep presets) → hazard catalog (keep calendar). Never cut: the 3 rotations, 7 criteria, uncertainty labels, evidence cards, disclaimer, basis labels.

---

## 17. Phase 2 (documented, not built)

GPM IMERG (rain), ECOSTRESS (land-surface temperature, heat stress), GEDI (biomass), GRACE/GRACE-FO (long-term water storage), SMAP as a full layer, common spatial grid harmonization (§7.5), price series, FAO-file parsing instead of hand-curated traits, further curated sites. The PRD lists them under Roadmap in the app. They are never shown as working.

---

## 18. Acceptance criteria and test plan

**Functional**
- For each of three curated sites, the analysis returns exactly three rotations, one marked `is_existing`.
- All seven criteria appear for each rotation with score, unit, basis, confidence and inputs.
- Range appears only on water use, erosion and exposure values; trait-only criteria have no range and carry `needs_local_review: true`.
- Evidence card present with all fields for each rotation.
- Limited-data location returns `limited_data: true` and does not fabricate satellite-derived values.
- Farmer selection works: `criteria_selected`, `weights`, `constraints` and `allowed_crops` change the output as specified.

**Invariants (automated)**
- Same request twice → identical JSON (hash equality).
- Changing only `weights` changes `overall` and `rank` but not any per-criterion `score`.
- Generated rotations never contain crops outside `allowed_crops` and never violate constraints.
- No same-family crop in consecutive cropping seasons.
- Each scenario preset response equals the response for the equivalent custom values.
- When all three raw values for a criterion are equal, scores are 50 and the card notes no difference.
- No response contains the words "yield", "profit" or an absolute soil-loss quantity (string check on payloads).
- `data_mode: "mock"` never appears when the demo flag is set.
- `OFFLINE=1`: zero outbound network calls (patched socket test); cache miss returns `WEATHER_UNAVAILABLE`.

**Data**
- Every seed file has a complete sidecar; every dataset in the Data and Methods payload has source, license and attribution.
- Feature fixtures validate against `feature_table.schema.json`.
- Every `TODO(verify)` is listed in a single generated report so nothing unverified ships silently.

**Performance**
- Analysis for a curated site responds from cache quickly enough for interactive use (target: no visible wait on repeated requests; measured and recorded, not guessed).

**Commands:** `make test` (pytest contracts and API), `make types`, `make fixtures`, `OFFLINE=1 make dev` for the offline check.

---

## 19. Demo support (backend responses to prepare)

Choose three curated sites with visibly different climates. For each, prepare a saved request and expected response so the demo is reproducible:
1. Default request (preset weights) showing the three rotations and why the top one ranks first.
2. Same site with the farmer choosing "conserve water" and "no specialty equipment", showing the ranking change and the evidence card updating.
3. Scenario slider moved to drier summers, showing how water-use scores and the vulnerable-season windows shift, labelled "modeled scenario, not a forecast".
Each saved response is a fixture committed to the repo so it works with `OFFLINE=1`.

---

## 20. Risks and mitigations

| Risk | Effect | Mitigation |
|---|---|---|
| Crop-trait values wrong | Misleading scores | Source column, `TODO(verify)` report, review by someone with agronomy background before demo; label "typical traits" |
| POWER limits (regional estimate, no bias correction) | Over- or under-stated hazard probabilities | Caveat in every feature response; confidence label; local review note |
| Seeded satellite data only on 1–2 sites | Uneven evidence | `limited_data` flag; show gap in evidence card; never imply satellite fusion where absent |
| Temperature-based ET0 is coarse | Water-balance error | Basis `modeled`; relative use only; Phase 2 upgrade path documented |
| Assumed thresholds (frost, heat, bare cover, vulnerability) | Debatable results | All in one config file; echoed in output; adjustable |
| Contract bottleneck (single integrator) | Blocks everyone | A1 and A2 first; frontend works on fixtures meanwhile |
| Scope too large | Unfinished features | Cut order in §16; core path (3 rotations, 7 criteria, labels) is never cut |
| Users read relative scores as predictions | Harm to trust | Disclaimer, "relative" labels, no yield/profit/soil-loss numbers, plain-language notes |

---

## 21. Decisions locked (confirmed by the team)

1. Additions merge into the existing v1.1 contract request: one bump to 1.1.0, one integrator edit of `openapi.yaml`.
2. Backend A is the integrator.
3. Winter/summer exposure and the seven-criteria scorecard coexist; both come from the same analysis.
4. Trait-only criteria get a confidence label and a review note, not a range.
5. Rotation scoring does not depend on the storm simulation engine in the MVP.
6. Crop traits are a hand-curated static table, not parsed from FAO files.
7. The frontend PRD is a separate file, `docs/prd-frontend-rotation.md`.
8. Three curated sites get the full pipeline; others run limited-data mode.
9. NDVI or SMAP are seeded for one or two sites only.
10. Non-NASA sources allowed: SoilGrids, FAO traits, price series (price series lowest priority).

---

## 22. Open items for the team (small, do before building)

- Pick the three curated sites (different climates) and the existing rotation preset for each.
- Confirm the preset values for `wetter_winters`, `drier_summers`, `both`.
- Assign a reviewer for crop-trait and glossary accuracy.
- Confirm which of NDVI or SMAP gets seeded first, and for which site.
