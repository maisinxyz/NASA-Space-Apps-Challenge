# Rotation PRD, Backend B (B1–B9): rotation engine and API

Backend rotation PRD (v2), §8–§12.1, §18, §19. Done 2026-11-14. Builds on `docs/progress/rotation-A.md`. No contract change: it uses the v1.1.0 schemas Backend A applied.

## What was built

| Task | State | Where |
| --- | --- | --- |
| B1 trait library | 12 crops, all PRD fields plus `perennial`, one source per trait (Kc: FAO-56 Table 12; the rest typical values), every value TODO(verify). Validation test. | `data/seed/crops/traits.json` (+ sidecar), `app/rotation/traits.py` |
| B2 scorer | Seven criteria per PRD §8.4, min-max across the three rotations, lower-is-better flipped, all equal → 50 + note. | `app/rotation/engine.py` |
| B3 generator | DFS in crop-id order, capped at 5,000 feasible cycles, one per cyclic shift; season timing, same-family rule, allowed crops and constraints; deterministic tie-breaks. | `engine.generate` |
| B4 uncertainty | Per historical year (34): water use and erosion recomputed → p10/p90 of their scores; rank stability; winter/summer exposure p10/p90. Trait-only criteria: `confidence: low`, `needs_local_review: true`, no range. | `app/services/rotation.py` |
| B5 evidence cards | Why (names top weights and constraints), 5 structured evidence items, benefits, gaps, local-review risks (adds frost risk for overwintering crops), support sentence. | `app/rotation/evidence.py` |
| B6 scenarios | Reuses `pipeline.resolve_scenario`; the feature table is rebuilt for the scenario before scoring. Preset = equivalent custom values (tested). | |
| B7 routes | `POST /sites/{id}/rotation-analysis`, `GET /sites/{id}/compare`, `GET /glossary`; `/crops` now serves the trait library plus the old mock crops it does not cover. | `app/routers/rotation_analysis.py` |
| B8 glossary | 7 terms + 4 crop-type explainers from PRD §11. All need review; most sources are TODO(verify). | `data/seed/glossary.json` (+ sidecar) |
| B9 live feature table | The engine reads Backend A's seeded POWER tables directly; there was never a fixture phase. | |

## How a rotation is modelled
- Slots `{year_index, season, crop_id}`; generated rotations have two per year: a main crop and an off-season slot (cover crop or `fallow`).
- Each crop occupies the ground from its planting to its termination day. An overwintering cash crop (winter wheat) is harvested in its slot's year; an overwintering cover crop is sown in its slot's year. Up to 14 days of overlap allowed (drilling at harvest, assumed).
- Daily cover from the crop's `cover_curve`; daily Kc piecewise over its season (stage shares 20/45/80 %, assumed). Southern-hemisphere sites shift every window by 182 days.
- Water use = Σ max(0, Kc·ET0 − retained·rain) over growing weeks, mm/yr. Erosion = Σ bare weeks · (1 + k·extreme-rain share) · terrain factor (1) · infiltration factor.

## Decisions made (please check)
1. **Existing-rotation presets** (`existing_rotation: "preset"`, TODO(verify) with the farms): Beltsville corn–soybean–winter wheat; Cornell corn–alfalfa–alfalfa; Oakville winter wheat–fallow. In `app/rotation/config.py`.
2. **Same-family rule** applies to main crops in consecutive years (cyclic). Cover crops are exempt (cereal rye after maize is normal practice). One perennial may repeat up to 3 years.
3. **Fallow is never a generated main crop.** With PRD's water-use formula an empty year always wins on water.
4. **Weights pick the alternatives** (PRD §8.3 step 3), so a weight change can swap which alternatives appear, and with them the min-max scores. The invariant "weights never change criterion scores" holds for a fixed set of rotations (tested that way). If the team wants it to hold end to end, alternatives must be picked with equal weights.
5. `rot_alt_1` is always the better-ranked alternative.
6. Weight presets (`water`, `income`, `soil_structure`, `erosion`, `forage`), the infiltration factors and the retained-rain shares are assumed, in `config.py`.
7. Cycle length is capped at 5 years in the request (keeps the search interactive).
8. `rank_stability` text: "ranked first in 82% of 34 resampled years". Compare gives "lower winter exposure than rot_existing in N% …" (`null` for the existing rotation).

## How to run
```sh
make seed     # build_seed.py, then build_rotation_fixtures.py
make test
curl -X POST localhost:8000/api/v1/sites/site_usda_barc/rotation-analysis -H 'content-type: application/json' \
  -d '{"weight_preset":"water","constraints":{"no_specialty_equipment":true}}'
curl 'localhost:8000/api/v1/sites/site_usda_barc/compare?rotations=rot_existing,rot_alt_1,rot_alt_2&scenario=drier_summers'
```
Demo fixtures (§19), one per site and request: `fixtures/rotation_analysis/<site>_{default,water_no_equipment,drier_summers}.json`, plus `site_usda_barc_no_feasible.json`, `compare/site_usda_barc.json`, `glossary.json`. Each response's `request_echo` replays it exactly.

## Results
- `services/api` pytest: 152 passed (29 new in `tests/test_rotation.py`). `packages/contracts` pytest: 69 passed.
- Latency (TestClient, this laptop): first rotation-analysis per site and request 260–590 ms; repeat 22 ms (in-process cache by normalized request). 20–21 KB per response.
- Acceptance (PRD §18): 3 rotations with one existing, 7 criteria with unit/basis/confidence/inputs, ranges only on climate criteria, evidence cards, limited-data path, farmer selections, determinism, constraint and family invariants, preset = custom, 50-on-equal note, no "yield"/"profit", no mock data on curated sites, offline with the network blocked, error codes: all tested and passing. The weights invariant passes only in the fixed-set form (decision 4).

## Known gaps
- Crop traits, Kc values, presets, glossary text: unreviewed (459 TODO(verify) items repo-wide in `docs/todo-verify.md`, most from per-trait sources). Needs a reviewer with an agronomy background (PRD §22).
- No terrain factor (no terrain packages for the curated sites) and no NDVI/SMAP cross-check, so confidence is `medium` at best.
- Response cache is in-process only, not on disk under `data/cache/` (§13).
- No crop–climate suitability filter: maize can be proposed for dryland Napa; only water use penalizes it. Frost risk is flagged for overwintering crops only.
- J2 (swap `apps/web/lib/twin/rotations.ts` hand scores for API data) is frontend work, not done.

## For the frontend pair
- One call drives the Rotation Lab: `POST /sites/{id}/rotation-analysis`. Show `scorecard[].score` with `unit` and `basis`, `range` where present, `evidence_card.*`, `rank_stability`, `warnings` (render `NO_FEASIBLE_ALTERNATIVES` at error level), `disclaimer`, and `scenario.label`.
- Render unknown enum values neutrally.
