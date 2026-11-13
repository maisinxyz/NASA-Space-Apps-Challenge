# Section 2 PRD: NASA data and the FieldTwin algorithm (v0.1 DRAFT)

> Living document. v0.1 is a generic outline. The two owners must flesh it out in Prompt 01, then update it after every decision. Log changes at the bottom.

## 0. Context capsule (Claude: read this first, it replaces reading the root PRD)

- **Product:** FieldTwin. A farm photo + location becomes a 3D landscape; real NASA storms replay on it; 3 crop rotations compare side by side; evidence cards explain why. Challenge: "Field Shift: Adapting Farms with NASA Data" (NASA Space Apps 2026). Event: starts Sat Nov 14 9:00, submit by Sun Nov 15 11:59 PM.
- **Stack (`services/api`):** Python 3.12+, FastAPI, NumPy, SciPy, rasterio, scikit-image, Pillow, httpx, pytest, `uv`. Contract: `packages/contracts/openapi.yaml` v1.0.0 (frozen). Fixtures + validators: `packages/contracts/fixtures`, `fixtures_lib/` (FTW1 writer, terrain helpers, `validate_response`).
- **Status:** the API skeleton serves fixtures only (`services/api/app/services/*` are the swap points; `providers/fixtures.py` is the data store). No real data pipeline yet. Mock IDs: `terr_mock_hills|tilted|bowl`, `sim_mock_001`. All rasters row-major, row 0 = north; 255 = nodata in 8-bit layers.
- **Planned method in root PRD (BE-04..BE-09):** NASA POWER daily weather (about 55 km, 1981-present) -> ranked storms -> SCS Curve Number runoff -> D8 routing and ponding -> relative erosion index -> metrics -> evidence cards. Root PRD calls this a visualization-oriented approximation, not a calibrated hydraulic model.
- **Rules:** `CLAUDE.md`: never invent dataset names, URLs, parameters or constants; mark `TODO(verify)` and record source URLs; every output carries a basis label (measured/derived/modeled/assumed/relative); results are relative comparisons, not predictions; same inputs give same outputs; `OFFLINE=1` serves cached/seed data only.
- **Task IDs:** this section covers root cards BE-01, BE-04 to BE-09, BE-11, BE-12, BE-14 plus new items below.

## 1. Mission

Use NASA data in a way NASA and the judges recognize as skillful, original and elegant, not a copy of existing crop-rotation planners. The algorithm must turn field geometry plus decades of NASA weather and soil-wetness records into defensible, explainable rotation comparisons and concrete suggestions. Winning-project lessons: answer a specific farmer decision (NVS-knot), show real data clearly, be scientifically valid (Validity criterion), and be honest about limits.

## 2. Owners (proposal, edit freely)

| Role | Person | Focus |
| --- | --- | --- |
| S2-A: Data | ___ | NASA ingestion, caching, terrain, weather, vegetation, validation data |
| S2-B: Algorithm | ___ | Simulation, scoring, uncertainty, scenarios, insights and evidence |

## 3. Goals

- G1 **Use NASA data well:** at least two distinct NASA data sources used for a reason you can state in one sentence each, with provenance shown in the UI.
- G2 **Original method:** a clearly described idea that is ours (see section 5), with a short prior-art check so we do not copy.
- G3 **Validity:** unit tests for physical invariants, sensitivity analysis, and at least one backtest against an independent observation.
- G4 **Actionable output:** ranked rotations plus zone-level suggestions a farmer could act on, each with evidence, gaps and risks.
- G5 **Reliability:** deterministic, cached, fully offline for curated sites; simulations finish in an interactive budget (aim under 10 s for 3 rotations; heavy ensembles precomputed).
- G6 **Field Shift:** a scenario mechanism (heavier storms, shifted seasons) that the UI can replay.

## 4. Candidate NASA data (all `TODO(verify)`: names, resolution, access, licenses, rate limits)

| Source | Possible use | Why it might matter |
| --- | --- | --- |
| NASA POWER (daily, 1981-present) | Precipitation, temperature, surface and root-zone wetness | Baseline weather record; easy access |
| GPM IMERG | Sub-daily rainfall intensity | Real storm timing instead of an assumed design storm |
| SMAP soil moisture | Antecedent wetness, root-zone moisture | Better wetness than a single coarse grid cell |
| Landsat / HLS or MODIS/VIIRS vegetation indices | Real cover and crop-phase timeline; bare-soil days | Grounds the cover calendar in observation |
| NASADEM / SRTM | Global elevation fallback | Works where LiDAR is unavailable |
| Evapotranspiration products (e.g. OpenET, ECOSTRESS) | Water-balance and stress checks | Dry-year side of resilience |

Non-NASA inputs (e.g. Canadian LiDAR, soil maps) are allowed but must be labeled and licensed. NASA data use is required for Global Awards.

## 5. Algorithm concept (hypotheses to refine in Prompt 01; none is final)

1. **Whole-record replay:** instead of 3 hand-picked storms, evaluate every rotation against the whole ranked storm set and the dry years from the 1981-present record. Output a **Resilience Profile** (distribution, worst-case, return period) per rotation, not a single number.
2. **Terrain-coupled wetness downscaling:** coarse NASA wetness (grid-cell scale) is redistributed across the field using terrain (topographic wetness index, flow accumulation) so the same storm and same antecedent wetness produce different runoff in different places. This links NASA time series to field geometry; check prior art before claiming novelty.
3. **Return periods and trend:** fit extreme-value statistics to annual maxima; use the existing Theil-Sen trends to state "a 1-in-N-year storm" and its drift.
4. **Field Shift counterfactual:** scale storm intensity and shift planting windows using the observed trend (delta approach), then re-score. Clearly labeled as a scenario, not a forecast.
5. **Uncertainty:** vary curve number, soil group, wetness thresholds, coarse-weather bias; report ranges and which assumption matters most.
6. **Zone actions:** convert risk maps into ranked actions (cover crop on high-erosion zones, buffer strip at ponding areas, waterway along main flow line) with expected relative risk reduction.
7. **Multi-criteria scoring:** transparent weights (water, soil cover, erosion, nitrogen benefit, dry-year exposure) with a Pareto view; no black box.

## 6. Originality guardrails

- Keep a short `prior-art.md` in this folder: what existing planners and Space Apps entries do, and how we differ. Cite URLs.
- Prefer ideas that fuse NASA time series with field geometry; avoid generic "crop recommender" or plain suitability tables.
- Never present modeled output as a forecast. Label everything.

## 7. Interfaces with Section 1

- Outputs keep the contract v1.0.0 shapes: TerrainPackage, Storm, Rotation, SimulationStatus/Metrics, FTW1 frames, risk PNG, EvidenceCard, Insight, weather summary.
- Planned additions (need the contract change process; integrator approves): `scenario` on simulation request, per-rotation resilience profile with ranges, return-period fields on storms, zone actions. Fixtures must be updated alongside.
- Real outputs for 3 curated sites go to `data/seed/` so Section 1 can swap mock to live.

## 8. Validation plan

- Unit tests (from root BE-08): no runoff below initial abstraction; monotonic in rainfall; more cover never increases runoff/erosion; mass conserved; deterministic.
- Fixture-based terrain tests (tilted plane, bowl, ridge-valley).
- Backtest: compare modeled ponded or wet areas with satellite-observed wetness after a known storm; report a simple skill metric even if modest.
- Sensitivity analysis: rank the assumptions by influence on rotation ranking.

## 9. Quality bar (acceptance)

- [ ] Every dataset listed with source, license, attribution, resolution, and a verified access method.
- [ ] Pipeline runs from a clean checkout; curated sites work with `OFFLINE=1`.
- [ ] Tests above pass; `make test` green.
- [ ] Each evidence-card number equals a metric from the simulation.
- [ ] One-page "How we use NASA data" write-up that matches the code.
- [ ] At least one backtest result and one sensitivity table, with honest limits.

## 10. Open questions (fill in during Prompt 01)

1. Which NASA datasets are practical in 48 hours (access, size, auth)?
2. Which 3 curated sites, and is NASA/open elevation available there?
3. Which of concepts 1-7 are P0 versus stretch?
4. What backtest data can we realistically get?
5. How do we express uncertainty so judges and farmers both understand it?
6. Ensemble compute budget and where it is precomputed.

## 11. Change log

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-12 | Claude | v0.1 draft created |
