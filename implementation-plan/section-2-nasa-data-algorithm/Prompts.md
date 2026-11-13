# Section 2 Prompts: NASA data and algorithm

Run in order, one per Claude Code session. Prompt 01 (kickoff) must be done by both owners before anything else.

## Rules for every prompt (Claude reads these once)

1. Read, in this order and nothing else unless the prompt lists it: `CLAUDE.md`, this folder's `PRD.md` section 0 and the sections the prompt names, the last 3 entries of `progress.md`.
2. For root-PRD detail, do NOT open the whole file. Run `grep -n "### BE-06" prd.md`, then `sed -n '<start>,<end>p' prd.md` for that card only.
3. Never invent dataset names, URLs, parameters or constants. Look them up on the web, cite the URL in a code comment, or mark `TODO(verify)`.
4. Do only this prompt's task. Do not edit `packages/contracts/openapi.yaml`; if a change is needed, write a contract request in `progress.md` and stop for the integrator.
5. Output shapes must pass `fixtures_lib.contract.validate_response`. Keep determinism and `OFFLINE=1` behavior.
6. Finish with: `make test` (show results), list acceptance items that pass or fail, append an entry to `progress.md`, update `PRD.md` (change-log row) if a decision changed, then stop.

`progress.md` entry format (max 10 lines): `## S2-xx name | date | commit` then Built / Files / How to run / Gaps / Next prompt must know.

Commit directly to `main` with the prompt ID in the message (e.g. `S2-03: …`); `git pull --rebase` before pushing. Swap points live in `services/api/app/services/*`.

---

## S2-01 Kickoff: flesh out this PRD and verify the data (both owners, interview style)

**Goal:** a PRD the team believes in, with verified datasets. No pipeline code.
**Read:** `PRD.md` fully; `../README.md`; `../section-1-web-experience-3d-ui/PRD.md` sections 0 and 7 only.
**Task:** (a) Web-verify each candidate dataset in PRD section 4: exact name, variables, resolution, time coverage, access method, license, rate limits, a working sample request (record URL). Drop or flag any that are impractical. (b) Interview the owners one question at a time on PRD section 10 and on which of concepts 1-7 are P0. (c) Write `prior-art.md`: 5 to 8 existing tools or Space Apps entries (including ones for this challenge) and how our approach differs. (d) Rewrite `PRD.md`: owners, verified data table, chosen concepts with a one-paragraph method each, measurable acceptance, a 48-hour plan with hour marks per owner. Under 300 lines.
**Done when:** every dataset row has a verified source or a drop reason; `prior-art.md` exists; open questions resolved or assigned. Append `progress.md`.

## S2-02 NASA weather ingestion, storm ranking, return periods (BE-06)

**Read:** root `prd.md` card BE-06; `services/api/app/services/weather.py`; contract schemas `Storm`, `TrendSeries` (grep in `openapi.yaml`).
**Task:** Real client for the NASA weather source(s) chosen in S2-01 (verified parameters only), disk cache per location, offline fallback. Rolling 1-3 day totals, distinct storm selection (about 7 days apart), antecedent wetness, hyetograph (flag `synthetic: true` unless real sub-daily data is used), Theil-Sen trends with CI, and **extreme-value return periods** per storm. Return-period fields are a contract request: write it in `progress.md`, implement internally first.
**Done when:** ranking test on a synthetic series with known events passes; cached offline response works; `/weather/storms` and `/weather/summary` validate.

## S2-03 Terrain ingestion and analysis (BE-01, BE-04)

**Read:** root cards BE-01, BE-04; `fixtures_lib/terrain.py` (reuse helpers); contract `TerrainPackage`.
**Task:** Elevation adapter (open DEM or NASA elevation per S2-01), resample to the standard grid; slope, aspect, D8 flow, flow accumulation, priority-flood depressions, **topographic wetness index**; layer PNGs with contract encodings; stats JSON. Flag `dsm_includes_vegetation` where relevant.
**Done when:** tilted/bowl/ridge-valley synthetic tests pass; layers match contract encodings; curated site drainage follows visible valleys.

## S2-04 Cover and phenology from imagery and NASA vegetation index (BE-05)

**Read:** root card BE-05; S2-01 data table rows for vegetation.
**Task:** Classical cover classification from the photo/texture (excess-green plus Otsu plus morphology; classes vegetation/bare/water/other; persistent-bare mask; confidence). If a NASA vegetation index time series was verified, derive an observed cover/phenology curve for the field and compare it to the crop-library curve. Document limits.
**Done when:** percentages sum to 100; low-confidence flag works; no gross errors on curated spot-check.

## S2-05 Crop library and rotation engine (BE-07)

**Read:** root card BE-07; `services/api/app/services/crops.py`, `fixtures/crops.json`.
**Task:** Data-file crop library with `source` per value (approximate values marked `to_verify` until sourced); exactly three rotations (existing + two transparent-rule alternatives); validation rules; monthly cover calendar and bare days; implement real `/rotations/validate` including the returned custom rotation (contract decision #23).
**Done when:** bare-days test matches hand-computed examples; family-repeat warning works; three rotations always returned.

## S2-06 Core simulation engine (BE-08)

**Read:** root card BE-08; `fixtures_lib/mock_sim.py` and `ftw1.py` (output format only).
**Task:** SCS-CN runoff with antecedent adjustment, D8 time-stepped routing with ponding, relative erosion index, FTW1 frames (about 60), risk PNG, metrics. Cache by input hash; grid-size fallback with a flag (contract request if no field exists). Implement all invariant tests from root BE-08.
**Done when:** all invariant tests pass; three rotations differ visibly on at least two storms; output decodes with the real FTW1 reader.

## S2-07 Our algorithm, part 1: terrain-coupled wetness, whole-record ensemble, resilience profile

**Read:** PRD section 5 (concepts 1, 2, 5, 7) as refined in S2-01; S2-02, S2-03, S2-06 progress entries.
**Task:** Implement the terrain-coupled wetness downscaling (coarse NASA wetness redistributed with TWI; document the equation and assumptions), run each rotation over the whole ranked storm set plus dry years, compute the Resilience Profile (mean, worst-case, return-period-weighted exposure), Monte Carlo uncertainty ranges, and a sensitivity table. Run heavy ensembles offline and cache in `data/seed`. Provide a short design note `algorithm.md` with equations and what is ours vs standard.
**Done when:** deterministic seeds; ranges reproducible; sensitivity table generated; note matches code.

## S2-08 Our algorithm, part 2: Field Shift counterfactual and contract request

**Read:** PRD section 5 (concepts 3, 4); S2-07 progress entry.
**Task:** Scenario engine: scale storm intensity and shift planting windows from observed trends (delta approach), re-score rotations, label as scenario. Write the contract request for `scenario`, resilience profile, return periods and zone actions (exact fields, defaults, fixtures to update) and hand it to the integrator; do not edit the contract yourself.
**Done when:** scenario results are monotonic and sane in tests; the contract request is complete enough for the integrator to apply.

## S2-09 Zone actions, insights, evidence generator (BE-09)

**Read:** root card BE-09; PRD section 5 (concept 6); S2-06/07 progress entries.
**Task:** Rule-engine templates (no LLM) for terrain, cover, storm, rotation and data-quality insights with anchors, confidence and data references; zone actions ranked by relative risk reduction; tips library with `basis` and `verify_locally`; five-section evidence cards whose numbers come straight from metrics; cautious wording, support-not-replace text.
**Done when:** every card number equals a metric; each insight has anchor, confidence and data ref; no absolute guarantees in tips.

## S2-10 Validation, seed data, offline, smoke test (BE-11, BE-12, validation plan)

**Read:** root cards BE-11, BE-12; PRD section 8.
**Task:** Backtest against the independent observation chosen in S2-01 and report the skill metric honestly; `make seed` for the three curated sites (terrain, weather, storms, rotations, simulations, ensembles); verification script; `OFFLINE=1` enforcement (block external calls); end-to-end smoke script; the one-page "How we use NASA data" write-up (accurate to the code) for the Methods page and submission.
**Done when:** with network off and `OFFLINE=1` every curated site completes the full journey; smoke script passes from a clean checkout; write-up reviewed by both owners and the integrator.
