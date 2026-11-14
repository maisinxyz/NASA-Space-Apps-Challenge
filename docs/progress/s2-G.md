# S2-G part 2 — ground/data follow-up

Status: **implementation and browser evidence advanced; acceptance is still incomplete**. This continuation used two Terra subagents. Do not sign off the entire track from the screenshot count alone.

## Built / corrected

- `components/viewer/cesium/ground/bake.ts`: 512 px field coverage (linear filtering feathers roughly one texel), validated 64×64 terrain sampling with tile failures rejected, one-time sanitized diagnostics (stage, allowlisted error type and HTTP status only). Invalid samples never become invented zero heights; alpha zero disables height-dependent water/flood/frost. Canvas rows are now north-first: pure geometry arrays are south-first but Cesium flips canvas uploads. This previously inverted both fields and terrain north to south. Gradient channel values retain their geographic directions.
- `ground/geometry.ts`: local 5th–95th percentile elevation contrast; observed-range fallback preserves real depressions occupying less than 5% of the grid. Bake invalidation includes every field and mask coordinate. This is a relative visual elevation scale, not flood-depth modeling.
- `ground/material.ts`: exact padded UV remap; valid ordered smoothsteps; brown wet soil and subtle sheen; stronger tan dryness/cracks; quieter crop rows; low-spot white frost leaves high ground exposed. Low tier uses fewer ripple cells and runoff streaks; medium cells are symmetric. Reduced motion freezes time and removes ripples. Runoff does not interpret missing terrain as a fabricated gradient.
- `ground/index.ts`: coverage and height share the unpadded bbox; disappearing layers/bbox request a redraw. Google NASA imagery rebuilds after bbox changes, retains opacity updates during loading, applies actual Cesium Image `color.alpha`, rejects missing composite tiles, and installs static credit only after successful compositing. Async completions retain cancellation/destruction guards. Diagnostics do not expose request credentials.
- `lib/twin/scenarios/ground/trends.ts`: verified GIBS MERRA-2 layer and date clamping, described below.
- Regression tests: `ground/bake.test.ts`, `ground/geometry.test.ts`, `ground/imagery.test.ts`, `lib/twin/scenarios/ground/ground.test.ts`.

No edits to Globe, product pages, types, registry, ScenarioPanel, farm data, or S2-W files. Fixture runs remain isolated to the dev fixture source. Existing ScenarioExtras is still unmounted.

## Verification

From `apps/web`, using `corepack pnpm`:

- Final `typecheck`: passed.
- Final `lint`: zero errors; two pre-existing GlobeHome unused-variable warnings (`dev`, `tier`).
- Final `test`: **305 passed, 12 failed**, 31 files (30 passed, one failed). Every failure is the unchanged product-owned `lib/twin/scenarios/registry.test.ts:42` expectation that ground is empty. The previous 11-failure exception becomes 12 because Trends now correctly supplies imagery. Request its owner update the assertion; do not remove scenario coverage.
- `build`: Next compilation, type validation, and prerendering succeeded. The postbuild verification-marker gate failed on the existing runtime string `Climate-change adjustment factors (TODO(verify): which source and scenario)` in product-owned `registry.ts`. Do not describe the whole build command as passing.
- `git diff --check`: passed before committing.

### Browser evidence

Headed Chrome, localhost:3000, `/dev/scenarios?perf=1`, fixture checkbox enabled. The optimized build was served with `corepack pnpm exec next start -p 3000` after compilation; no postbuild gate was disabled. Hardware acceleration **could not be independently attested**: the browser policy blocked the internal GPU diagnostic URL. These are headed-browser readouts, not a certified hardware benchmark.

`.playwright-mcp/` contains 72 named scenario/progress/surface captures: `s2-g-{google|terrain}-{scenario}-{0|0.5|1}.jpg`, plus FPS, attribution, reduced-motion and Beltsville captures. Initial matrix files were checked at 1920×1080. Subsequent endpoint investigation exposed screenshot lag (DOM clock and captured frame can differ), and a later refresh was interrupted by the viewer cleanup crash; therefore the final directory is **evidence to review, not an accepted 72-cell matrix**. Some extra diagnostic captures have different dimensions. Flood zones is static with its clock disabled, so its three captures repeat one state. Discrete clocks round the midpoint to the nearest available step.

| Surface | High FPS | Medium FPS | Low FPS |
| --- | ---: | ---: | ---: |
| Google | 29.7 | 32.8 | 60.0 |
| Terrain | 59.5 | 59.9 | 60.0 |

Samples were read while Storm displayed Pause (actively playing), at 0.5×, CSS viewport 1920×1080, resolution scale 1, after about five seconds per detail selection. Terrain hours were 6/11/17, Google hours 7/13/18. They are single rolling readout samples at different storm hours, not controlled averages. Google weather auto-stepped from high to low and medium to low; terrain weather retained each requested tier. Ground detail follows the requested tier. Raw readouts and screenshots: `s2-g-fps.json` / `s2-g-fps-{surface}-{tier}.jpg`.

Reduced motion: DevTools emulation was confirmed through the CSS media query after reload. On Beltsville Storm hour 12, both surfaces showed sky `static`, weather off, ground off, and disabled autoplay with the reduced-motion explanation; step controls retained static states. Saved `s2-g-reduced-google.jpg` and `s2-g-reduced-terrain.jpg`. Emulation was restored to default and the media query confirmed false afterward. Beltsville (`usda-barc`) loaded its own field names and storm inputs, and both surfaces were exercised.

### Browser gaps / confirmed external defect

- The original ion terrain-request failure did not reproduce as a sanitized ground warning. Code and regression tests establish the flipped canvas rows, bbox mismatch, invalid-grid acceptance and percentile issues. Close-up screenshots alone do not prove all Cornell low spots are visually correct; repeat a full-square view after the viewer issue is fixed.
- A read-only Terra source review confirmed the repeated cleanup crash: `GlobeHome.tsx:449–450` moves `.cesium-widget-credits` into a different DOM parent. CesiumWidget.destroy then unconditionally removes it from its original parent, causing `NotFoundError` at `Globe.tsx:918`. This can mask the original render/unmount error, which GlobeHome currently discards. Full-page captures and viewport changes repeatedly encountered it; viewport-only captures were more stable. Request the viewer owner pass `creditContainer` at construction or restore the node before destruction, and preserve the original error diagnostic. No out-of-scope fix was made.
- NASA credit appeared in the rendered DOM on both Google and Terrain. The Google composite completed without a ground warning, and a directly fetched Cornell-region tile contained opaque temperature pixels. **Clearly visible NASA draping over Google was not confirmed**, including after discovering the Image opacity issue; acceptance remains pending. Credit is crowded by the existing bottom dock and needs an integration layout check.
- Visual approval of field-edge alignment, roads, white frost crust, tan cracks and low-spot water remains pending after synchronized captures. Do not equate shader tests with visual acceptance.

## Trends / NASA source

Selected `MERRA2_2m_Air_Temperature_Assimilated_Monthly`, monthly assimilated 2-meter air temperature, regional context rather than farm-scale measured temperature.

Live EPSG:3857 capabilities checked in this continuation:
<https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml>

Advertised ranges include `1980-01-01/2000-03-01/P1M`, `2000-04-01/2025-04-01/P1M`, `2025-07-01/2025-07-01/P1M`, `2025-09-01/2026-08-01/P1M`, and additional singleton dates in March 2000 and April–June 2025. These are not continuous monthly ranges. Every January 1980–2026 is advertised, so the deterministic annual sweep uses January 1 and clamps start years into 1980–2026, ending at fixed 2026. It supports the requested 1981 start without inventing coverage. Source and exact ranges are commented in the evaluator. GIBS access reference: <https://nasa-gibs.github.io/gibs-api-docs/access-basics/>.

Integration mismatch: the existing product clock says 30 yearly steps (default 1991–2020), while evaluator/chart sweep through 2026. The timeline labels must be reconciled by the product owner. Existing Trends legend describes cooler/wetter versus warmer/drier; the chosen temperature layer is absolute regional temperature, not that combined anomaly scale. Supply the layer-specific legend/units before presenting it as such.

## Farm-data requests

Cornell `overlayMask` is empty. Classification can paint barn roofs; no footprints were fabricated. Hansini: supply verified building footprints. The traced `f2` Barn field is east of the freestall barns and has a southern notch intended to exclude a bare patch; the approximate 1–5 m trace still needs imagery review for roof/road intersections. The new coordinate-consistent coverage resolves a renderer error, not errors in the traced farm data. At 512 px the 1.3 km square has roughly 2.5 m texels.

## S2-W handoff

Ground classification primitives render before weather post-processing. Within the procedural material: cropCover → vegetation → organicMatter → dryness → wetness → runoff → water → floodZones → frost → heatGlow. Backend rasters and NASA imagery have separate collections. Ground adds no weather post-process stages.

The perf `ground on` flag means an animated procedural layer is requesting continuous frames, **not drawn versus hidden**. Static field/frost/dryness effects, reduced-motion states, backend rasters and NASA imagery may remain visible while it says off. Low ground detail reduces ripple cells and runoff streaks; reduced motion freezes all shader time. S2-W auto-tier can step below the requested UI detail independently, as the FPS samples show.

## Requests to project lead

1. Mount `<ScenarioExtras run={...}/>` from `components/farm/scenarios` in ScenarioPanel or GlobeHome.
2. Update `lib/twin/scenarios/registry.test.ts:42` for ground layers (now 12 stale assertions).
3. Let `composeFrame` carry evaluator readouts, including modeled too-wet days.
4. Supply verified Cornell building footprints; review Barn field trace and narrow roads.
5. Fix the viewer credit-element cleanup and retain original error diagnostics; finish synchronized full-square visual acceptance and NASA draping/credit layout.
6. Reconcile Trends clock/chart/evaluator years and supply a truthful temperature legend/units.
7. Resolve the product-owned climate-source verification marker before release.

Coordination: Vince owns viewer/simulator, Hansini terrain/imagery, Max integration. S2-W changes pulled from main were preserved. This committed document is the project-lead handoff; no separate person-directed message has been sent.
