# FieldTwin combined UI/UX audit

> DRAFT: validation remains incomplete and newest upstream e7cbbd4 is fetched but not integrated. See /handoff.md before continuing.

Audit date: 2026-11-14 America/Vancouver (2026-11-15 UTC).
Local branch: `codex/ui-ux-audit-fixes`. Preview: http://localhost:3003.

## Scope and merge record

Integrate the local UI/UX work (`ac8325a`) with the friend's new globe, search, farm picker, condition cards, Twin sample assistant, title arrival, and forecast backend changes. Work stays local; no GitHub push, PR, or deployment is authorized or performed.

- First incoming snapshot: `5cbc174`, including the initially reviewed `3156a9f` and newer forecast routes.
- Next incoming snapshot: `fcb4e10`, frontend P1 fixes arriving during testing.
- Next incoming snapshot: `d7dc0e8`, forecast QA and methods documentation.
- Local integration checkpoints: `a2c27cc`, `32ca164`.
- The final verification section records the latest remote snapshot fetched before the final local commit. Compatibility is established for that snapshot; later pushes require another fetch/merge check.

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
| Globe share copied the homepage without the selected farm | Use the validated investigation share codec; update address bar for clipboard failure recovery | Reproduced failing selected-farm URL test; post-fix rerun required |
| Pin popup focus races with inert overlay and global Escape | Defer entry focus until visible; capture popup Escape before globe selection handler | Hero integration regression |
| Scan button navigates to missing route | Explicit disabled “Scan a farm — coming soon” roadmap control | Hero integration regression |
| User wants hideable UI blocks | Separate farm-control collapse, simulation/report collapse, Twin close, camera disclosure, and explicit Hide panels / persistent Show panels; H also works | State preservation tests on desktop and non-3D workspace |
| Prototype tests expected fake observations/obsolete disconnected calendar | Replaced with actual field/report, preview, stateful comparison and sound persistence assertions | Reconciled Slice A suite; no new skip workaround |

Hiding panels keeps their components mounted. Scenario inputs, selected sections, open cards and unfinished Twin prompts are restored. Hiding does not reset the investigation. The explicit reset still requires confirmation.

## Test results

Final integration results remain pending for e7cbbd4. At checkpoint faad84a:487web unit tests,214API tests and85contract tests passed; production build passed; lint0errors/33warnings. The broad browser run had62passes and1Share failure (71historical skips). After fixing Share and the normal-motion drawer,9targeted checks passed, including5new investigation cases. See handoff.md for exact scope and remaining validation.

The automated suite is complemented by live Chrome inspection on this Mac and independent Terra/Luna reviews. Browser tests use Chromium with software WebGL; desktop, tablet, narrow layouts and WebGL failure are covered. External map tiles require network access. This is a local preview using fixture/demo mode, not evidence that live forecast endpoints are connected to every frontend control.

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

**Evidence:** Production homepage first-load JavaScript is approximately 621kB before dynamic globe/map assets. Software WebGL browser runs are slower than native Chrome and cannot establish phone GPU performance or assistive technology usability.

**Change:** Profile startup and farm transitions on the Mac plus a lower-power device; pause hidden rendering loops, lazy-load nonessential effects, and record interaction/asset budgets. Conduct a keyboard and screen-reader review against the combined app.

**Completion test:** Capture repeatable cold/warm loading and frame-time traces; define acceptable thresholds with the team. Test touch gestures and cancellation on a physical mobile/tablet device, plus Safari and Firefox.

### R9 — P3: Consolidate visual tokens and documentation

**Static evidence:** Hero controls, farm panels and app navigation use separate hard-coded color/type/spacing systems. The user approved preserving the friend's visual identity during the merge.

**Change:** Document existing patterns and consolidate shared surface, typography, focus, radius and spacing tokens without redesigning the globe. A `PRODUCT.md`/`DESIGN.md` would make later Impeccable passes more consistent.

**Completion test:** Compare globe, popup, farm, Methods and Learn side by side; controls with the same role have consistent focus/disabled/hover behavior and readable type.

## Audit method and limitations

Used [Impeccable](https://github.com/pbakaus/impeccable)'s audit framework and the `audit`, `critique`, and craft-floor references as guidance; this is a repository integration audit rather than a wholesale visual redesign. Read context from the existing implementation and PRD because no PRODUCT.md/DESIGN.md exists. The scoped source detector returned `[]` for GlobeChrome, FarmView and Twin; that is not a WCAG certification or an absence-of-bugs guarantee. The final report also records independent automated accessibility findings separately.

Terra handled hero integration and farm workspace integration/reviews; Luna reviewed interaction coverage and added combined control tests. Main reviewed conflicts, ran cross-suite validation and inspected native Chrome. Earlier failed/aborted runs diagnosed stale prototype assertions, shared test-output collisions and UI regressions; only the completed final runs count toward the results above. Existing historical fixme tests remain explicitly skipped and are not counted as coverage.

No claim is made that every possible control state, external dataset, network condition, assistive technology or hardware combination was exhaustively verified. The matrix records concrete coverage and the recommendations define what remains to improve.
