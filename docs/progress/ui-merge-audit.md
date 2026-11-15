# FieldTwin combined UI/UX audit

Audit date: 2026-11-14 America/Vancouver (2026-11-15 UTC).
Local branch: `codex/ui-ux-audit-fixes`. Preview: http://localhost:3003.

## Scope and merge record

Integrate the local UI/UX work (`ac8325a`) with the friend's new globe, search, farm picker, condition cards, Twin sample assistant, title arrival, and forecast backend changes. Work stays local; no GitHub push, PR, or deployment is authorized or performed.

- First incoming snapshot: `5cbc174`, including the initially reviewed `3156a9f` and newer forecast routes.
- Next incoming snapshot: `fcb4e10`, frontend P1 fixes arriving during testing.
- Next incoming snapshot: `d7dc0e8`, forecast QA and methods documentation.
- Future / Compare integration: `bcde122` merged upstream through `2a98f14`, including the P2 frontend changes from `e7cbbd4`.
- Newer upstream snapshots `e968ec7` and `3b467d7` merged cleanly as `dd398d7` and `4d96054`. These updates contain planning docs and environment configuration.
- Upstream `95210c6` merged cleanly as `81af953`. It adds the friend’s satellite feature work. This frontend audit introduced no changes to the backend.
- Local integration checkpoints: `a2c27cc`, `32ca164`, `faad84a`.
- Compatibility was checked against the latest fetched snapshot. A later upstream push requires a fresh merge check.

Conflict decisions preserve behavior rather than select an entire side. Existing responsive title and toolbar allocation, native keyboard field selectors, validated sharing, stateful comparison calendar, reset confirmation, non-3D simulation, explicit unavailable measurements, and the friend's explore-only/UBC fix remain. The latest ErrorBoundary, SSE parsing fix, dataset descriptions, KPU farm, globe assets and forecast services are included. Visual thermal/vegetation filters remain available under Simulation → Map and explicitly say they are styling rather than sensor observations. Analytical observation layers stay disabled until real observations exist.

## Changes made during this integration

| Problem | Resolution | Evidence |
| --- | --- | --- |
| Nine original conflicting files, then six overlapping frontend conflicts | Combined implementations on the existing local branch | No unmerged index entries; type/build checks |
| New condition and Twin features could imply selected-farm measurements | Clearly label synthetic previews; preserve unavailable real observations | FarmView unit and browser assertions |
| Search and picker lose keyboard focus on closing | Restore search/picker opener focus; picker options follow its trigger in tab order | New merge-controls browser cases |
| Farm names truncated in accessible picker labels | Full accessible farm names and Digital twin / Explore only capabilities | Rendered picker and code review |
| Normal-motion title transform clips the fixed simulation drawer | Keep title opacity fade; remove the ancestor transform so fixed positioning stays viewport-based | Normal-motion Map/Compare tests and native Chrome reproduced it; retest all drawer controls |
| Expanded condition preview pushes zones behind bottom tools | Bounded internally scrollable toolbar, reserved bottom area | Reproduced old overlap; normal/compare layout regressions |
| New globe Farms popover extends below viewport and scrolls fixed scene | Viewport-bound scrollable popover; preventScroll focus | Terra live audit and hero integration regression |
| Camera panel covers year and Farms list | Collapsible Earth camera controls above the year | Hero integration regression |
| Globe share copied the homepage without the selected farm | Use the validated investigation share codec; update address bar for clipboard failure recovery | Clipboard tests passed for the selected farm and denied access |
| Pin popup focus races with inert overlay and global Escape | Defer entry focus until visible; capture popup Escape before globe selection handler | Hero integration regression |
| Scan button navigates to missing route | Explicit disabled “Scan a farm — coming soon” roadmap control | Hero integration regression |
| User wants hideable UI blocks | Separate farm-control collapse, simulation/report collapse, Twin close, camera disclosure, and explicit Hide panels / persistent Show panels; H also works | State preservation tests on desktop and non-3D workspace |
| Prototype tests expected fake observations/obsolete disconnected calendar | Replaced with actual field/report, preview, stateful comparison and sound persistence assertions | Reconciled Slice A suite; no new skip workaround |
| Future / Compare projections and strategy analysis integrated | Added Now/Future/Compare modes, synthetic 2026–2035 data, timeline, climate/water/field/confidence lenses, what-if controls, soil-health panel and review flags; preserves the Now workflow | `2a98f14`. Implementation gaps are listed in `docs/progress/s2-future-features.md` |
| Future lens menu was nested in a clipping scroll container | Moved the menu outside the scroll area and bounded its height | Short-viewport pointer and panel-visibility regression |
| Methods generalized Now’s relative-only wording to new Future outputs | Describes both modes and explains the scope of synthetic figures | Methods unit test and browser content checks |

Hiding panels keeps their components mounted. Scenario inputs, selected sections, open cards and unfinished Twin prompts are restored. Hiding does not reset the investigation. The explicit reset still requires confirmation.

## Test results

- Production build passed. Web unit tests passed (508 across 57 files). ESLint reported 0 errors and 33 warnings.
- Verification of existing services passed (217 API tests, 85 contract tests, and an offline forecast smoke check across four sites, run before the last backend-only merge).
- The broad Chromium run logged 56 passes and 6 failures before switching to targeted testing to meet the requested timeline. Playwright reported 41 historical skips, 1 interrupted case and 40 cases that had not run. The six failures were the clipped lens menu, the old Learn wording, two uses of the old farm entry button name, and two uses of outdated condition-card test IDs.
- On the rebuilt preview, six targeted checks passed, including both Future lens checks, panel restoration, farm picker entry, condition cards and Methods/Learn. The search shortcut missed its first press during startup in one run. In the follow-up it opened search and found Cornell, but the farm view did not appear within the 30-second assertion after selecting Enter. Farm-picker entry and all 15 direct farm entry/return cases passed. Search-to-farm entry remains open.
- axe reported no violations on the sampled non-3D workspace, Methods or Learn. It flagged manual contrast review for 60 elements in the non-3D workspace and one on Methods. Globe and 3D Future/Compare screens still need automated and manual accessibility checks.

The automated suite is complemented by live Chrome inspection on this Mac and independent Terra/Luna reviews. Browser tests use Chromium with software WebGL and cover desktop, tablet, narrow layouts and WebGL failure. External map tiles require network access. This is a local preview using fixture/demo mode, not evidence that live forecast endpoints are connected to every frontend control.

## Coverage matrix

| Area | Checked behavior |
| --- | --- |
| Entry and return | Every pinned farm including UBC and new KPU; twin versus explore-only capability; back to globe; keyboard hide/recovery |
| Globe | Pin/popup, full farm picker, search shortcut/results/Escape, camera buttons and keyboard, marker/atmosphere/spin settings, share feedback |
| Condition previews | All four available pills, mutually exclusive cards, minimize/Escape, clear synthetic labels, illustrative legend, scroll containment |
| Twin preview | Open/focus, disabled blank submit, question, answer, follow-up, close during interaction, Escape/focus restoration; no backend assistant claim |
| Field report | Expand/collapse, actual selected farm's illustrative field names, unavailable observations, keyboard selection |
| Simulation | Both twins, ten registered scenarios, input editing, playback/pause/speed/step, rotation, tab keyboard order, share restoration |
| Comparison | A/B options, linked month/year, calendar, closed drawer, mode/play separation, divider/map-only controls where applicable |
| Recovery | Reset confirmation and cancel; camera reset preserves investigation; no-WebGL fallback; non-3D stateful scenarios |
| Visibility | Hide/show farm controls, global Hide/Show panels and H, collapsed simulation/report/camera, typed question/input persistence |
| Content | Methods selected-farm context, learning provisional content, source labels, limitations |
| Layout | 390×844, 768×1024, 1024×768, 1280×720, 1280×800 and 1440×900; expanded previews and reduced motion |

## Remaining recommendations

These are follow-up improvements, distinct from the integration defects fixed above. Severity uses Impeccable's P0 blocking / P1 major / P2 minor / P3 polish vocabulary. Runtime-backed findings are identified; static risks require the stated validation before being treated as confirmed failures.

### R1 — P1: Expose navigation above the fullscreen globe

**Observed:** Live desktop Chrome renders the fixed globe over the shared site header. Methods, Learn and About exist in the accessibility tree behind the globe, while the visible globe chrome has no equivalent navigation. This impairs discoverability and may create offscreen focus stops.

**Change:** Add a compact visible menu in the globe and farm chrome for Methods, Learn, About and returning home. Ensure background header controls are inert while replaced by fullscreen controls.

**Completion test:** Starting on the globe with keyboard only, reach each visible route/action without tabbing to hidden controls; return to the previous farm context. Confirm at 768px and 200% zoom.

### R2 — P2: Explain search no-results and loading states

**Evidence:** `GlobeChrome.tsx` renders a listbox only when matches exist; a non-empty unmatched query has no visible result explanation. Place data fetch failure is silent. The current test confirms the typed query survives but does not establish helpful feedback.

**Change:** Add a visible polite status for no matches, loading places, and unavailable city data, while retaining local farm search.

**Completion test:** Query an impossible place, deny `/hero/places.json`, and repeat with a valid farm. Users receive actionable feedback and can still select the farm.

### R3 — P2: Make preview advice visibly hypothetical before submission

**Observed:** The closed Twin uses a logo, with its preview distinction primarily in the accessible name; its answer is clearly labelled synthetic but contains prescriptive sample irrigation language and sample field names unrelated to the selected farm.

**Change:** Show a short visible “Sample assistant” caption/tooltip and phrase answers as a worked hypothetical example. Prefer an explicit sample scenario context over “this farm.” Preserve the friend's functioning input and follow-ups.

**Completion test:** A first-time user can identify the sample nature before typing. Ask unrelated and farm-specific questions; no response implies an actual field measurement or general-purpose AI understanding.

### R4 — P2: Announce complete Twin answers once

**Static risk:** The live region contains text updated per streamed word. This may produce repeated partial announcements, depending on screen reader/browser behavior.

**Change:** Keep visual streaming, announce thinking separately, and publish one completed answer to a dedicated polite status. Add `aria-busy` where appropriate.

**Completion test:** VoiceOver/Safari and NVDA/Chrome announce one completed answer and follow-up without repeated partial paragraphs. Test both motion preferences. Automated DOM checks alone cannot certify this.

### R5 — P2: Harden search rapid reopen and keyboard focus after hiding

**Static risk:** Search schedules an untracked blur timeout. A quick reopen may be affected by the old timer. Hidden panel descendants retain local state, so focus behavior also needs deliberate management.

**Change:** Cancel/guard the blur timer; move focus to the visible restore control on hiding, then return to a sensible opener on restoring. Prevent hidden preview listeners from handling unrelated Escape presses.

**Completion test:** Escape and reopen search rapidly; blur into another control; hide with H from each panel. Search remains open when requested and no focus remains inside hidden content.

### R6 — P2: Improve short-viewport and dense-control readability

**Observed:** The right toolbar and expanded previews are dense over high-detail imagery. Containment prevents overlap, but scrolling within a panel can conceal lower controls. Several small controls/metadata labels remain below the preferred 44px target/comfortable body size.

**Change:** Consolidate advanced previews under one disclosure, use clear scroll affordances, increase action targets and secondary type where practical, and keep synthetic labels on an opaque high-contrast surface. Measure actual contrast rather than infer it from color tokens.

**Completion test:** At 1280×600, 768×1024, 200% zoom and touch emulation, reach every toggle without overlap; verify WCAG 2.2 target-size exceptions and text contrast. A narrower non-3D fallback should remain fully usable.

### R7 — P2: Distinguish frontend demo capabilities from new backend forecasts

**Evidence:** The new backend forecast services and QA are present, while the local visible scenario UI still uses synthetic fixtures and relative rotation comparisons. Methods copy describes this frontend, but other repository documents now describe absolute forecasts.

**Change:** Maintain a frontend/backend capability matrix and revise product copy when endpoints are wired. Show units, basis and uncertainty for any new absolute results; never let the existence of backend code imply a working frontend workflow.

**Completion test:** Run a contract-backed end-to-end forecast against the API in live mode; check outputs, error handling, units, provenance, uncertainty and deterministic repeatability. Offline/demo mode must remain explicitly distinguished.

### R8 — P2: Establish real-device performance and accessibility baselines

**Evidence:** Production homepage first-load JavaScript is approximately 638 kB before dynamic globe/map assets. Software WebGL browser runs are slower than native Chrome and cannot establish phone GPU performance or assistive technology usability.

**Change:** Profile startup and farm transitions on the Mac plus a lower-power device; pause hidden rendering loops, lazy-load nonessential effects, and record interaction/asset budgets. Conduct a keyboard and screen-reader review against the combined app.

**Completion test:** Capture repeatable cold/warm loading and frame-time traces; define acceptable thresholds with the team. Test touch gestures and cancellation on a physical mobile/tablet device, plus Safari and Firefox.

### R9 — P3: Consolidate visual tokens and documentation

**Static evidence:** Hero controls, farm panels and app navigation use separate hard-coded color/type/spacing systems. The user approved preserving the friend's visual identity during the merge.

**Change:** Document existing patterns and consolidate shared surface, typography, focus, radius and spacing tokens without redesigning the globe. A `PRODUCT.md`/`DESIGN.md` would make later Impeccable passes more consistent.

**Completion test:** Compare globe, popup, farm, Methods and Learn side by side; controls with the same role have consistent focus/disabled/hover behavior and readable type.

### R10 — P1: Connect Future data and labels to the selected farm

**Static evidence:** `apps/web/lib/farm-future/fixtures.ts` says its values are hand-set synthetic demo data, but the values and field names describe one specific research-farm scenario (for example, “Trial plots,” a 9 km uncertainty pixel, crop calendars and a farm water quota). `FuturePills`, soil-health outputs and compare scores are derived from those shared fixtures; the future store has no selected-farm input. The visible synthetic-data badge is a useful disclosure, but does not prevent users from reading these precise values as selected-farm estimates.

**Change:** Until farm-specific projections exist, make the demo scenario identity persistently visible beside the mode and explain that changing farms does not change the sample numbers. Before wiring the API, define a typed farm-scoped projection contract with units, baseline period, geography, source/model version, assumptions and uncertainty; show unavailable states when a farm lacks a value rather than carrying this fixture across farms.

**Completion test:** Open Future on every pinned farm, including Explore-only locations. The interface either presents verified farm-specific values with provenance and uncertainty or clearly says the named synthetic scenario is illustrative and unrelated to that farm. Verify switching farms cannot silently retain another farm's fields or values.

### R11 — P1: Put the Future signals on the map they describe

**Evidence:** `apps/web/components/farm-future/MapEffects.tsx` explicitly says field-polygon drapes need future work, while `docs/progress/s2-future-features.md` records that anomalies, erosion outlines, flow lines, ranked dry-field pins and soil-test rings are not drawn on the 3D map. The cards and review links currently supply those field-level details without a corresponding spatial layer. This is a documented implementation gap, not a browser-observed regression.

**Change:** Add farm-bound overlays from validated field geometry, with a legend, date/basis, uncertainty, and a non-map list equivalent. If geometry or observations are missing, show an unavailable state and keep the cards clearly labeled as scenario examples. Ensure overlays do not suggest parcel precision when the underlying source is a coarser grid.

**Completion test:** For supported farms, selecting a field in a lens card highlights the matching polygon and vice versa; uncertainty and source resolution remain visible. Keyboard users can reach the same field insights without the map. Unsupported farms show no fabricated polygons.

### R12 — P2: Clarify what Compare's three panes represent

**Static evidence:** `CompareView` places three strategy cards over one shared map and draws vertical pane dividers. Its source comment and `s2-future-features.md` confirm that three independent twins/multi-viewports are not implemented. The visual partition can therefore be read as three spatially distinct strategy outcomes even though each card reports a strategy score, water quota and operational fit over the same scene.

**Change:** Until each pane has its own rendered result, remove the map-partition treatment or label the shared-map comparison directly. Give each strategy a small, explicit evidence summary and explain that the displayed map is common context, not a strategy-specific simulation.

**Completion test:** Ask first-time users to explain what differs across the three columns and what the map represents. They should identify strategy metrics as the comparison and the map as shared context. When multi-viewport support arrives, validate that each spatial view actually reflects its named strategy.

### R13 — P2: Improve focus management for Future menus and panels

**Static risk:** Future adds a grouped menu with `role="menu"` / `menuitemradio` plus animated popovers and drawers. Source review shows dismissal handling in `Controls.tsx`, but does not establish arrow-key menu navigation, focus entry/restoration, focus containment or focus transfer when the current mode removes controls. Treat this as an unverified accessibility risk, not a confirmed runtime failure.

**Change:** Use native disclosure/list controls where possible; otherwise implement the complete menu keyboard pattern. On opening a panel, move focus to its heading or first useful control; on dismissal restore focus to its opener; on mode changes relocate focus to the new mode's heading. Ensure hidden/exit-animated content is not focusable.

**Completion test:** Keyboard-only manual walkthrough for opening/dismissing every lens and panel, changing modes, following a review deep link and returning. Verify Escape, Tab/Shift+Tab, arrow-key behavior, and VoiceOver/NVDA announcements in supported browsers.

### R14 — P1: Diagnose the search-to-farm arrival timeout

**Observed:** On the rebuilt preview, the isolated Chromium check opened search, found Cornell, displayed its details and activated Enter digital twin. Farm controls remained absent after 30 seconds. The picker route passed in the same run. An earlier run also missed the first shortcut press during startup.

**Change:** Trace search selection, transition state, tile readiness and control reveal. Ensure an interrupted or slow arrival offers a retry or the non-3D workspace, and verify the shortcut responds as soon as the search control is visible.

**Completion test:** On cold and warm loads, open search with the keyboard, choose Cornell and enter its twin. Test both motion preferences and slow or unavailable map tiles. The farm controls or a usable fallback must appear and provide a way back to the globe.

## Audit method and limitations

Used [Impeccable](https://github.com/pbakaus/impeccable)'s audit framework and the `audit`, `critique`, and craft-floor references as guidance; this is a repository integration audit rather than a wholesale visual redesign. Read context from the existing implementation and PRD because no PRODUCT.md/DESIGN.md exists. The scoped source detector returned `[]` for GlobeChrome, FarmView and Twin; that is not a WCAG certification or an absence-of-bugs guarantee. The automated scan covered the sampled non-3D workspace and information pages.

Terra handled hero integration and farm workspace integration/reviews; Luna reviewed interaction coverage and added combined control tests. Main reviewed conflicts, ran cross-suite validation and inspected native Chrome. The results above distinguish the interrupted broad run from targeted checks on the rebuilt preview. Existing historical fixme tests are outside the verified coverage.

No claim is made that every possible control state, external dataset, network condition, assistive technology or hardware combination was exhaustively verified. The matrix records concrete coverage and the recommendations define what remains to improve.
