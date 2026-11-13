# Section 2 Prompts: NASA data and algorithm (rewritten for PRD v0.2 and Databases.md)

Run in order, one per Claude Code session. Prompt S2-01 (kickoff) must be done by both owners before anything else. Data prompts are tagged **[S2-A]** (data) or **[S2-B]** (algorithm); prompts with no tag are shared.

Per-dataset detail (why, how to get it, steps, needs, outputs, fallback) lives in `../Databases.md` under the ids **DB-1 to DB-13**. Each data prompt names the DB sections it implements. Do not re-derive that detail; read the named sections.

## Rules for every prompt (Claude reads these once)

1. Read, in this order and nothing else unless the prompt lists it: `CLAUDE.md`, this folder's `PRD.md` section 0 and the sections the prompt names, the `../Databases.md` sections the prompt names, the last 3 entries of `progress.md`.
2. Never invent dataset names, URLs, parameters, variable names, fill values or constants. Look them up on the web, cite the URL in a code comment, or mark `TODO(verify)`. Record each verified fact in `data-sources.md` and update the matching `Databases.md` row.
3. Do only this prompt's task. There is **no hand-written contract file** (PRD D-19): Pydantic models in `services/api/app/models/` are the contract and `/openapi.json` is generated. If a change affects Section 1, announce it to the integrator the same hour and regenerate fixtures.
4. Keep determinism (same inputs give byte-identical outputs) and `OFFLINE=1` behavior (ingest modules refuse network calls and read `data/cache/` or `data/seed/` only).
5. Engine purity: `engine/` and `markers/` take arrays and return arrays/models. No network, file I/O, clock or LLM there.
6. Earthdata credentials live in `.env` only. Never commit `.env`, raw downloads (`data/cache/`) or imagery whose license forbids redistribution. Commit only derived, license-safe tables to `data/seed/<site>/`.
7. Finish with: `make test` (show results), list acceptance items that pass or fail, append an entry to `progress.md`, update `PRD.md` and `../Databases.md` (change-log row) if a decision or fact changed, then stop.

`progress.md` entry format (max 10 lines): `## S2-xx name | date | commit` then Built / Files / How to run / Gaps / Next prompt must know.

Commit directly to `main` with the prompt ID in the message (e.g. `S2-03: …`); `git pull --rebase` before pushing.

---

## S2-01 Kickoff: verify the data, flesh out the PRD (both owners, interview style)

**Goal:** every dataset verified against its provider, accounts working, farm chosen. No pipeline code.
**Read:** `PRD.md` fully; `../Databases.md` fully; `../README.md`; `../section-1-web-experience-3d-ui/PRD.md` sections 0, 7 and 7.1 only.
**Task:** (a) Open the **official 2026 challenge page** in a browser and copy its Resources list into `data-sources.md`; add anything that fits a role in `Databases.md` §1. (b) For each P0 row (DB-1 to DB-8), web-verify and record: exact product name and version, variables and units, resolution, time coverage, access method, **a working sample request URL**, license and attribution text, rate limits, and whether ~49°N is covered. (c) Decide **SMAP L4 vs L3** (DB-5) and record why. (d) Create Earthdata accounts, run one real download each, and write `.env.example` (variable names only). (e) Interview the owners one question at a time to pick the **exact Fraser Valley farm** (coordinates, fields) and the 3 curated rotations. (f) Write `prior-art.md` from PRD §13. (g) Update `Databases.md` §1 table statuses (`TODO(verify)` to verified) and the PRD §5 table.
**Done when:** every P0 dataset row is verified with a sample request or has a drop reason and fallback; `data-sources.md`, `prior-art.md`, `.env.example` exist; farm and rotations chosen; open items 1 to 5, 11 and 13 in PRD §15 resolved or assigned. Append `progress.md`.

## S2-02 Models, fixtures and engine skeleton [S2-B]

**Read:** PRD sections 6.1, 9.2, 9.3, 10 (invariants row), 14.
**Task:** Pydantic v2 models for `FieldMarker`, `Evidence`, `SourceRef`, `Basis`, zone, rotation, compare result, **terrain package metadata**, and provenance (shapes in PRD §9.2 and `Databases.md` DB-1, DB-13). FastAPI app that serves fixtures generated from the models (one script writes example JSON for every endpoint, including the proposed `GET /sites/{id}/terrain`). `make fixtures`, `make types`-style script for Section 1 to regenerate TypeScript from `/openapi.json`. Engine skeleton (`engine/hazard.py`, `exposure.py`) with the **invariant tests** from PRD §10 on tiny synthetic arrays.
**Done when:** `/openapi.json` generated; every fixture validates against its model; invariant tests pass on synthetic data; Section 1 notified of the model shapes.

## S2-03 Weather ingestion: POWER, IMERG, SMAP [S2-A]

**Read:** `../Databases.md` DB-3, DB-4, DB-5 and §3; PRD sections 6.2 and 8; `data-sources.md`.
**Task:** Three cache-first ingest modules (`ingest/power.py`, `imerg.py`, `smap.py`) with `httpx` and `earthaccess` (or the access method verified in S2-01). Subset to the farm's cell, cache raw in `data/cache/`, log request URLs, retry with backoff, replace verified fill values with missing and report the missing share. `OFFLINE=1` refuses network and reads cache only. Return tidy daily tables (date, rain mm, wetness, tmin, tmax). Pre-download everything for the curated site now (decision D-03).
**Done when:** POWER, IMERG and SMAP daily tables exist for the curated site; a test with the network blocked still loads from cache; missing-data report printed; sample requests recorded in `data-sources.md`.

## S2-04 Fusion and hazard odds [S2-B, with S2-A data]

**Read:** PRD section 6.2; `../Databases.md` DB-3, DB-4, DB-5; S2-02 and S2-03 progress entries.
**Task:** Per-season empirical quantile mapping POWER to IMERG (rain) and POWER to SMAP (wetness) over the overlap years, applied to all POWER years (`fusion/`). Site-percentile thresholds (heavy rain, wet ground, dry spell). `wet_hit(y,w)` and `dry_hit(y,w)` matrices, `J_wet[52]` and `J_dry[52]` (joint frequency counted directly, not multiplied), circular smoothing. Write `hazard.json` with thresholds, matrices and **before/after fit diagnostics**. If IMERG or SMAP is unavailable, run the labeled fallback (uncorrected POWER with a caveat in `hazard.json`).
**Done when:** diagnostics show the 95th and 99th rain percentile closer to IMERG after mapping; raising `q_rain` never raises `J_wet` (test); deterministic output; fallback path tested.

## S2-05 Terrain and zones [S2-A]

**Read:** PRD section 6.4; `../Databases.md` DB-1, DB-2; contract shape from S2-02.
**Task:** Terrain adapter for LidarBC (curated site) and NASADEM (other sites and Lite mode): mosaic, clip with buffer, reproject, resample, priority-flood fill, slope, D8, flow accumulation, TWI. Terrain zones (0.5 to 2 ha) clipped to fields, merge slivers, terrain factor `T(z)`, pole-of-inaccessibility icon points, simplified outlines. Write the **terrain package for Section 1** (heightmap PNG16 row-major row 0 north, normals PNG, `terrain.json` with grid size, cell size m, CRS, elevation range, `source`, `resolution_m`, `dsm_includes_vegetation`) and `zones.geojson`. Implement `GET /sites/{id}/terrain` and `/zones`.
**Done when:** synthetic tilted-plane, bowl and ridge-valley tests pass (highest `T(z)` in hollows); curated-site drainage follows visible ditches; package loads in Section 1's decoder; license of redistributed derived products confirmed.

## S2-06 Crop calendars from HLS and AAFC [S2-A]

**Read:** PRD sections 6.3 and 6.5; `../Databases.md` DB-6, DB-7, DB-8.
**Task:** Clip AAFC crop inventory to field patches (`fields.geojson`). Select sample fields per crop. Read HLS windows (cloud-optimized, no full-tile downloads), mask with the quality layer, compute NDVI, weekly median across years, linear gap-fill, **valid-observation count per week**. `Bare_crop[52]`, stage dates, textbook fallback labeled `assumed`. Transcribe FAO-56 Kc values with table references into `data/reference/fao56_kc.json` (**S2-B reviews every value**) and compute `Sens_crop[52]`. Write `calendars.json`.
**Done when:** median green-up and harvest weeks fall inside the agronomic windows you cite; observation counts reported; every FAO-56 value has a `source`; no imagery committed.

## S2-07 Exposure engine, bootstrap and sensitivity [S2-B]

**Read:** PRD sections 6.1, 6.6, 10; `hazard.json` and `calendars.json` schemas; S2-04 and S2-06 progress entries.
**Task:** Rotation calendars from crop calendars (average over the rotation cycle). `WinterExposure` and `SummerExposure` per rotation and zone, keeping the 52-week products. Year bootstrap (B = 1000, seed from input hash) giving ranges and **rank stability**; one-at-a-time sensitivity over `q_rain`, `q_wet`, `n_dry`, `τ_bare`, smoothing width and terrain weights. Write `exposure.json`, `bootstrap.json`, `sensitivity.json` (summary statistics, not raw samples) and the sensitivity table in `algorithm.md`.
**Done when:** all PRD §10 invariants pass on real tables; same seed gives identical bytes; the table says which assumption, if any, flips a ranking.

## S2-08 Field Shift scenarios and optimizer [S2-B]

**Read:** PRD sections 6.7, 6.8.
**Task:** Per-year `wet_index` and `dry_index`, Theil-Sen trends with confidence intervals, importance-weighted analog-year scenarios (`baseline`, `wetter_winters`, `drier_summers`, `both`), "trend not significant" flag. Bounded optimizer over feasible farmer changes (shift harvest or planting by weeks, add winter cover crop, delay tillage, buffer strip) re-running the 52-week sums; keep Pareto improvements with rank stability of at least 80%. Write `scenarios.json` and `optimizer.json`.
**Done when:** scenario exposures are monotonic and sane in tests; adding cover never raises winter exposure; best candidate per zone reproducible; no scenario text says "forecast".

## S2-09 Markers and endpoints [S2-B]

**Read:** PRD sections 7, 9.2, 9.3; `../Databases.md` DB-13; S2-07 and S2-08 progress entries.
**Task:** Zone classification (`winter_wet`, `summer_dry`, `opportunity`, `protected`), merge neighbours, score, cap at 5, `active_weeks`, template text (headline up to 60 characters, one action, "why?" evidence with units, basis and `SourceRef`s, caveats such as "rate not bias-corrected" or "calendar assumed"). Endpoints: `GET /sites`, `/sites/{id}/markers`, `/compare`, `/rotations`, `GET /provenance`. Every `SourceRef.dataset` must exist in the provenance list.
**Done when:** every marker number equals an `exposure.json` value; no absolute guarantees in text; at least one `opportunity` marker on the curated site; runtime calls under 1 s; the support-not-replace line is returned for the farm view.

## S2-10 Backtest and validation [S2-A data, S2-B scoring]

**Read:** PRD sections 10 and 11; `../Databases.md` DB-6, DB-5, DB-10.
**Task:** Verify the Nov 2021 atmospheric-river dates and an observation source. Build the observed flooded or saturated mask from HLS water index (where cloud allows) and SMAP change; add RADARSAT only if open access is confirmed (DB-10). Compare zones flagged `winter_wet` to the mask: hit rate and IoU **against an area-matched random baseline**, reported as is. Optional (P2, only if P0 is complete): ECOSTRESS sanity plot for the summer axis (DB-9); never feed it into scores.
**Done when:** `backtest.json` and a short honest write-up (including cloud and resolution limits) exist and are shown on the Methods page data.

## S2-11 Lite mode [S2-A data, S2-B scoring]

**Read:** PRD section 6.9; `../Databases.md` DB-2, DB-3, DB-12.
**Task:** `POST /lite/markers`: location + field polygons + crop per field. Live POWER (cached per location) and NASADEM terrain and zones, textbook calendar (`assumed`), percentile thresholds, no fusion or bootstrap, same marker shape with `mode = "lite"` and "Lite mode: fewer data sources" in every caveat list. Validate upload type, size and coordinates; strip image metadata; store uploads in `data/uploads/` (gitignored); the photo never feeds a number.
**Done when:** any land location returns markers within the interactive budget; Lite never shows a rank-stability line; oversized or invalid uploads are rejected cleanly.

## S2-12 Seed data, offline, provenance, smoke test, write-up [S2-A, with S2-B]

**Read:** PRD sections 8 and 12; `../Databases.md` §3 and DB-13.
**Task:** `make seed` builds `data/seed/<site>/` for site 1 (then sites 2 and 3 if time): terrain package, `zones.geojson`, `fields.geojson`, `hazard.json`, `calendars.json`, `exposure.json`, `bootstrap.json`, `scenarios.json`, `optimizer.json`, `provenance.json`. **Provenance test:** fails if any dataset used in a seed table is missing from `provenance.json` or lacks license and attribution. `OFFLINE=1` test with the network blocked. End-to-end smoke script. The one-page "How we use NASA data" write-up (accurate to the code) naming each NASA dataset and its single job, plus the not-used list from `Databases.md` §4.
**Done when:** with network off and `OFFLINE=1` the curated site completes the full journey; smoke passes from a clean checkout; write-up reviewed by both owners and the integrator.
