# Rotation PRD, Backend A (A1–A8): data pipeline + integrator

Backend rotation PRD (v2), §5–§7, §12.2, §13, §14. Done 2026-11-14.

## What was built

| Task | State | Where |
| --- | --- | --- |
| A1 contract v1.1.0 | Done. Merged `implementation-plan/contract-request-v1.1.md` + PRD §14 into one bump. Lint: 0 errors. Types regenerated. | `packages/contracts/openapi.yaml`, `apps/web/lib/api/schema.d.ts` |
| A2 feature-table schema + fixtures | Done. Full-data (Beltsville) and limited-data (Pirque, Chile) fixtures from the real pipeline. | `packages/contracts/schemas/feature_table.schema.json` (generated), `fixtures/features/` |
| A3 POWER wired in | Done. Curated sites read `data/seed/` (offline-safe); other sites with a `location` go through `app/weather/power.py` (live, then cache). | `app/services/features.py` |
| A4 climatology, anomaly, ET0, water balance, hazards, quality | Done. | `app/features/pipeline.py` |
| A5 seed loaders + sidecars | SoilGrids done for all 3 sites. **NDVI/SMAP: not built**, see gaps. | `app/features/seeds.py`, `data/seed/<site>/` |
| A6 hazard calendar + catalog | Done (v1.1 shapes). | `/sites/{id}/hazard-calendar`, `/sites/{id}/hazards` |
| A7 zones (stretch) | Erosion-risk and frost-pocket zones from terrain layers. Curated sites have no terrain package, so they return `zones: []` with a caveat. Water-stress zones not built. | `app/features/zones.py` |
| A8 Data and Methods | Every `Source` in feature/hazard payloads has license + attribution (tested). `Source` gained optional `attribution`, `retrieved_on`, and roles `soil, vegetation, soil_moisture, crop_traits`. | `app/features/config.py` |

### Curated sites (PRD §22 open item, my pick — change in `app/features/config.py`)

| site_id | Farm (apps/web/lib/farms) | Climate | Soil (SoilGrids 0–30 cm) |
| --- | --- | --- | --- |
| `site_usda_barc` | Beltsville, MD | humid subtropical | loam, medium infiltration |
| `site_cornell_ruminant` | Harford, NY | humid continental, cold winters | loam, medium |
| `site_ucdavis_oakville` | Napa Valley, CA (location approximate) | Mediterranean, dry summers | clay loam, low |

All three: NASA POWER daily, 1991–2024, 34 complete years, no missing days.

### Contract v1.1.0 (all additive)
- New paths: `GET /sites/{id}/features|hazard-calendar|hazards|zones|compare`, `POST /sites/{id}/rotation-analysis`, `GET /glossary`.
- New schemas: `Scenario`, `ScenarioInput`, `SeasonalRainScale`, `ScenarioApplied`, `DataMode`, `Confidence`, `WeekValues`, `FeatureSeries`, `FeatureThresholds`, `DataQuality`, `SoilSummary`, `FeatureTable`, `HazardCalendar`, `HazardType`, `HazardCatalog`, `Zone`, `ZoneCollection`, `Exposure`, `RotationComparison`, `Criterion`, `Season`, `RotationSlot`, `FarmerPriorities`, `RotationAnalysisRequest`, `RotationScorecard`, `ScoreInput`, `EvidenceItem`, `VulnerableSeason`, `AnalyzedRotation`, `AnalysisWarning`, `RotationAnalysis`, `CropTrait`, `GlossaryEntry`.
- New error codes: `SITE_NOT_FOUND` 404, `UNKNOWN_CROP`, `INVALID_WEIGHTS`, `NO_FEASIBLE_ALTERNATIVES`, `SCENARIO_OUT_OF_RANGE` (422).
- From contract-request-v1.1.md: `Site` location fields, `Storm.rank/rank_of/named_event`, `WeatherSummary.climatology`, `Insight` kinds + `action/zone_ids/active_weeks/scenario`, `LayerName` widened, `SimulationRequest.scenario`. Schema only; nothing serves them yet.
- `EvidenceCard` gained optional `evidence_items` (structured). `evidence` stays `string[]` so the web build does not break.
- `/crops` items are now `CropTrait` (= `CropTemplate` + optional traits).

## Decisions made (please check)
1. **Scenario presets need per-season rain.** "both" = wetter winters and drier summers, which one global `rain_scale_pct` cannot express. Added optional `rain_scale_by_season` (overrides the global value in that season; flips for the southern hemisphere). Presets, TODO(verify) with the team: `wetter_winters` winter +20 %; `drier_summers` summer −20 %, +1 °C; `both` = both. Sliders still use `rain_scale_pct` / `temp_offset_c`.
2. **Weeks** are 7-day blocks from 1 January (days 358–366 fold into week 51), not ISO weeks. ISO week-years split a year's days across two years.
3. **A week with any missing day is `null`.** Nothing is filled.
4. **Scenario thresholds stay on the baseline** (e.g. `extreme_rain_mm`), so a wetter scenario shows more extreme-rain weeks. Soil wetness is not re-modeled by scenarios (caveat in the payload).
5. Assumed thresholds (all in `config.py`, echoed in `thresholds`): frost 0 °C, heat 32 °C, wet day 1 mm, dry day < 1 mm, dry spell 10 days, wet ground p75, vulnerable share 0.25, heat spell 3 days, multi-day 3 days ≥ 1.5 × heavy-rain day, late frost 1 Apr–31 May (north).
6. `limited_data` = no seeded soil or satellite data. Curated sites are `false` because SoilGrids is seeded.

## Verified facts (sources in code comments)
- Hargreaves–Samani form `0.0023 · 0.408 · Ra · (T+17.8) · √(Tmax−Tmin)`, Ra from FAO-56 eq. 21–25. Test reproduces FAO-56 Example 8 (Ra = 32.2).
- POWER: no use restrictions, citation requested (registry.opendata.aws/nasa-power). Exact acknowledgment wording still TODO(verify).
- SoilGrids: CC BY 4.0 (ISRIC FAQ).

## How to run
```sh
make seed            # rebuild data/seed, v1.1 fixtures, feature_table.schema.json (needs network once; OFFLINE=1 rebuilds from seeds)
make test
python scripts/todo_verify_report.py   # -> docs/todo-verify.md (213 items repo-wide)
curl localhost:8000/api/v1/sites/site_usda_barc/features?scenario=drier_summers
```
No `uv` on this machine; I used `services/api/.venv` (py 3.12) + pip with pyproject versions.

## Results
- `packages/contracts` pytest: 57 passed. `services/api` pytest: 114 passed (24 new in `tests/test_features.py`).
- Web: `pnpm typecheck` clean, `pnpm test` 385 passed. `pnpm lint`: 1 error in `components/hero/Pin3D.tsx` (not touched here).
- Latency (TestClient, this laptop): features first call 760 ms (loads seed + computes), repeat 160 ms (163 KB JSON); hazards 70–90 ms.

## Known gaps
- **NDVI / SMAP seeds not built.** Both need an Earthdata login and a product choice (PRD §22). Features `ndvi`, `ndvi_anomaly`, `smap_anomaly` are absent and `sources_agree` is `null`. Loaders will follow once a file exists.
- No terrain packages for the curated sites, so their zones are empty. Water-stress zones not built.
- `/compare`, `/rotation-analysis`, `/glossary` are in the contract but not served (Backend B, B7). `tests/test_routes.py` lists them as `pending`; delete each entry when the route lands.
- No rotation-analysis, compare or glossary fixtures (Backend B content).
- Pre-existing: `scripts/make_fixtures_json.py` writes with the system code page on Windows and turns `m³` into `m�`. I did not commit the regenerated mock files.
- Response disk cache by `request_hash` (§13) is Backend B's analysis; features use an in-process cache only.

## For Backend B
- Read features in-process: `from app.services.features import feature_table, computed`; scenarios via `app.features.pipeline.resolve_scenario(preset, rain_scale_pct, temp_offset_c, rain_scale_by_season)`. The table is cached; do not mutate it.
- `by_year` holds every feature per year (probabilities as 0/1 flags) for p10/p90 and rank stability.
- `pipeline.vulnerable_weeks(table, in_ground_weeks)` returns `VulnerableSeason` items.
- Soil: `table["soil"]["infiltration_class"]` (high/medium/low; mapping TODO(verify)).
