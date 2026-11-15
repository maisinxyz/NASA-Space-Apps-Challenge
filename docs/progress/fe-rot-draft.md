# fe-rot-draft: rotation frontend built on placeholder data

**Status:** Frontend 1 and Frontend 2 are built against draft types and mock data. Contract v1.1 has not landed: `openapi.yaml` is still 1.0.0. The user approved this approach on 2026-11-14 ("build with placeholders, finish when data comes in").

**Rule followed:** nothing was invented. Every draft field comes from `docs/prd-backend-rotation.md` or `implementation-plan/contract-request-v1.1.md`. Every guessed value is marked `TODO(verify)` in code and listed below. All mock data shows the "mock" badge, which is hidden in presenter mode and never reaches the demo build.

## Commits (oldest first)
| Commit | Task | What |
|---|---|---|
| `7b931c0` | fe-rot-P0 | Saved PRDs; unknown basis renders as a neutral chip instead of crashing |
| `0d06774` | fe-rot-seam | Shared seam: draft types, mock data, store, API calls, client-side re-rank |
| `e58efd4` | fe-rot-FE1 | Frontend 1 screens; replaces the 4 priority sliders in ComparePanel |
| `cd3276f` | fe-rot-FE2 | Frontend 2 screens, zone overlay, `/learn`, methods resolution rows; ClimatePanel mounted in Fe1Panel |
| `2b57cde` | fe-rot-fix | Fixes for 19 review findings confirmed by an adversarial multi-agent review (31 raised, 12 refuted) |

## The seam (`apps/web/lib/rotation/`)
| File | Role | After v1.1 lands |
|---|---|---|
| `draft-types.ts` | Draft contract types copied from the PRDs | **Replace** each type with the generated alias from `lib/api/types.ts`, then fix compile errors |
| `draft-fixtures.ts` | Fake sample data (3 rotations × 7 criteria, 52-week hazards, features, zones from twin field outlines, glossary text from PRD §11) | **Delete**; point `api.ts` at `/mock/<fixture>.json` |
| `api.ts` | `postRotationAnalysis`, `getFeatures`, `getHazardCalendar`, `getHazards`, `getZones`, `getGlossary`. Mock mode serves draft data; live mode calls the proposed PRD §14 paths | Keep; swap the mock branches to real fixtures; check the paths match the final contract |
| `store.ts` | `useRotationStore`: `rotScenario` (preset, rain %, temp °C) + `farmerRequest`; `buildAnalysisRequest()` | Keep; replace `SCENARIO_PRESET_VALUES` with the backend's values |
| `rank.ts` | `rerank()`: overall = Σ w·score, so weights reorder rotations and never change scores | Keep (not draft-specific) |
| `rotation.test.ts` | 8 tests: weight invariant, invalid weights, determinism, NO_FEASIBLE warning, ranges only on water/erosion | Keep; repoint at real fixtures |

Also: `apps/web/lib/api/client.ts` now exports `live` and `postJson`. Before, they were module-private; the change adds the word `export` and nothing else.

## Frontend 1 (`apps/web/components/rotation/fe1/`), built by a Sonnet subagent
| File | Spec item |
|---|---|
| `PrioritiesForm.tsx` | F1-1: 7 criteria checkboxes, weights 0–5, preset picker; an edit clears the preset; all-zero weights show a message; keeps `PRIORITIES_NOTE` |
| `ConstraintsForm.tsx` | F1-2: 3 constraint toggles + allowed-crops picker from `getCrops()` (empty = all) |
| `RotationResults.tsx` | F1-3/F1-5/F1-6: 3 rotations ranked client-side, "Your current rotation", rank stability, warnings, limited-data flag, mock badge, evidence card |
| `Scorecard.tsx` | F1-4/F1-5: 7 rows each with score + unit + basis chip; p10–p90 bar only when `range` exists; confidence; "needs local review" |
| `presets.ts` | Criterion labels; `PRESET_WEIGHTS` (`TODO(verify)`) |
| `useRotationAnalysis.ts` | Fetches when farm, scenario, constraints or crops change, **not** when weights change |
| `Fe1Panel.tsx` | Ties it together; also mounts Frontend 2's `ClimatePanel` |
| `fe1.test.tsx` | 5 tests, including "weights reorder, scores identical" |

Existing file changed: `components/farm/ComparePanel.tsx`. In `e58efd4` the `Priorities` sliders were replaced by `<Fe1Panel />`. In `2b57cde` the old hand-scored ranking ("Why X is first", "Ranking by your priorities", the "Show as B" buttons, the bare-soil row and the `teamScores` source footer) was removed too. With its sliders gone it was frozen at equal weights, which contradicted the new results. The panel now renders only `<Fe1Panel />`. The A/B picker for the map split is still in `CompareTray`. `lib/twin/rotations.ts` is untouched; deleting its scores is still F1-8.

Also changed in `2b57cde`: `components/TourController.tsx`. The R (reset) key now also resets `useRotationStore` and the zone toggle.

## Frontend 2 (`apps/web/components/rotation/fe2/` + others), built by a Sonnet subagent
| File | Spec item |
|---|---|
| `ScenarioControls.tsx` | F2-1: 4 presets + rain % and temp °C sliders, always labelled "modeled scenario, not a forecast"; writes `useRotationStore` |
| `HazardTimeline.tsx` | F2-2: 52-week `j_wet`/`j_dry`; amber bands from hazard `peak_weeks`; grey bands for bare months (cover < 0.30) |
| `FeatureCharts.tsx`, `charts.tsx` | F2-3: soil-moisture anomaly, water balance, frost/heat/extreme-rain; unit + basis chip on each; limited-data + caveats |
| `ClimatePanel.tsx` | Mount point for F2-1..3; refetches on scenario change |
| `ZoneOverlay.tsx` + `lib/twin/scenarios/ground/zones.ts` | F2-4: zones rasterised into a ground overlay on the Cesium twin; toggle (default off) with "derived from terrain and soil data, not field-measured" and legend; empty zones → nothing |
| `Glossary.tsx` | F2-5: `<GlossaryTerm id>` keyboard-focusable tooltip |
| `app/learn/page.tsx` | F2-5: satellite vs ground panel, crop-type explainers, glossary |
| `fe2.test.tsx`, `zones.test.ts` | Tests |

Existing files changed:
- `components/globe/GlobeHome.tsx`: one import; `useZoneOverlays(...)`; `overlays={zoneOverlays}` on `<Globe>` (the prop was previously unset); the `ZoneToggle` block.
- `components/Header.tsx`: a "Learn" link next to "Methods & data" (2 places).
- `app/methods/page.tsx` (F2-6): every dataset card has an "Original resolution" row. Unknown values read "not yet verified" on screen, with `TODO(verify)` in a code comment.

## Placeholders to confirm with the backend (`TODO(verify)` in code)
1. **Criterion ids** (`draft-types.ts` `CRITERIA`): only `erosion_risk` and `water_use` appear verbatim in the PRD. The other five ids follow its §8.4 names.
2. **`AnalyzedRotation.name`**: not in the PRD §8.5 example, but the UI needs a label. Ask Backend B to add it.
3. **`Zone.label`**: PRD §12.2 says zones have a plain-language label, but no field name is fixed.
4. **Scenario preset values** (`store.ts` `SCENARIO_PRESET_VALUES`): PRD §12.1 says the backend config holds them.
5. **Weight presets → weights** (`fe1/presets.ts`): PRD §9 names the presets but not their weights.
6. **Site ids:** the frontend passes the twin farm id (e.g. `cornell-ruminant`) as `siteId`. Backend site ids look like `site_*`. A mapping is needed.
7. **`peak_weeks` indexing:** v1.1 says 0–51, but the timeline may read them as 1-based. Check when real data arrives.
8. **"Both" preset:** labelled "wetter winters, drier summers", but one global rain % cannot express seasonal change. The placeholder is rain 0 %, temp +1 °C.
9. **Glossary/explainer `source`:** shows "not yet verified" until checked.

## How to reverse
- **Everything** (back to before this work), from the repo root, newest first:
  `git revert --no-edit cd3276f e58efd4 0d06774 7b931c0` preceded by `2b57cde`, i.e. `git revert --no-edit 2b57cde cd3276f e58efd4 0d06774 7b931c0`
  Or revert only the commits you don't want; each one is self-contained.
- **Only the screens, keeping the seam:** `git revert --no-edit 2b57cde cd3276f e58efd4`.
- **Only the review fixes:** `git revert --no-edit 2b57cde`. This brings back the frozen old ranking in ComparePanel.
- **Only Frontend 2:** `git revert --no-edit 2b57cde cd3276f`. The fix commit touches FE2 files, so revert it first. This restores the methods page, header and GlobeHome, and unmounts ClimatePanel.
- **Only Frontend 1:** revert `e58efd4`, but first move the `ClimatePanel` mount from `Fe1Panel.tsx` (added in `cd3276f`) somewhere else, or revert both.
- **Only the placeholder data, keeping the screens:** do the "After v1.1 lands" column above.

## Checks (2026-11-14)
- `pnpm vitest run`: 41 files, 415 tests passed.
- `pnpm typecheck`: clean.
- `pnpm lint`: 1 error + 7 warnings, all already on main (`Pin3D.tsx` error; `GlobeHome`/`HeroEarth` warnings). None in new files.
- `pnpm build`: **fails on that `Pin3D.tsx` lint error, already on main**. With `--no-lint` the build compiles and `/learn` and `/methods` render.
- `check-build`: the 5 remaining `TODO(verify)` markers come from `lib/farms/datasets.ts`, already on main. This work adds none.
- Not checked: browser visual pass, 375 px layout, Recharts rendering (SSR tests see empty containers), `make test` (Python).

## Phase 2 (still blocked on the backend)
- F1-7/F2-7: live mode, `limited_data`, the error codes `UNKNOWN_CROP`, `INVALID_WEIGHTS`, `SITE_NOT_FOUND`, `SCENARIO_OUT_OF_RANGE`; roadmap-only datasets.
- F1-8: delete the hand-written scores in `lib/twin/rotations.ts` and the old ranking in ComparePanel.

## Review (2026-11-14)
Four reviewers (correctness, honesty rules, accessibility, spec coverage) each raised findings, and a skeptic agent tried to refute each one. 19 of 31 were confirmed and fixed in `2b57cde`. The 12 refuted findings were left as they are, for example the "likely range" wording, the "Overall" number labelled with the text "relative", and exposure p10/p90 not shown as bars.
Still open after review: a glossary tooltip next to the right edge of the inspector can overflow on very narrow screens. The zone toggle's new spot (top centre of the map) has not been checked in a browser.
