# s1-C3 (render): farm digital-twin foundation on the Cesium globe

Branch `fe/S1-cesium-globe`. Owner: agent-render. Nothing committed. Contract `components/globe/types.ts` unchanged (`FarmTwinProps` implemented as written).

## What was built
- **Surface switching (tiles.ts).** New pure `pickSurface({ tier, view, photoreal, failed })` -> `"google" | "terrain" | "base"`. Globe view keeps the tier's look (A = Google tiles, B = terrain); farm view = terrain + Bing Aerial (+ OSM Buildings) by default, Google Photorealistic only when `photoreal`. `LoadedTier` now has `surface`, `failed`, `setSurface(s)` and a live `tileset` getter. Each ion source (Google tileset, World Terrain, world imagery, OSM Buildings) is requested at most once per viewer (memoised promises, failures included). If photoreal is asked for but Google fails, the view stays on terrain and logs one `console.warn`. Tier C never calls ion.
- **Fields (twin.ts `createFieldLayer`).** One `GroundPrimitive` (per-instance colour fills, semi-transparent) + one `GroundPolylinePrimitive` (2 px outlines). Crop look -> colour in `CROP_COLORS` / `fieldStyle` (illustrative, not a crop map). Selected field: stronger fill + yellow outline. `cropByField` and selection recolour in place, without a rebuild. Fields are rebuilt only when `fields` or the surface changes. The classification target is TERRAIN on terrain (OSM buildings stay unpainted) and BOTH on Google tiles.
- **Overlays (twin.ts `createOverlayLayer`).** One textured `GroundPrimitive` per `GroundOverlay`, in list order (bottom first). The pure `planOverlays` diff rebuilds only when ids, order, bbox or classification change, and re-uploads only overlays whose `version` changed. The canvas is copied into two alternating canvases (the same trick as C1's drape). `opacity` is a shader uniform. Sync runs in `preUpdate`, so it is cheap when nothing changed, and an in-place canvas edit plus a version bump is enough.
- **Globe.tsx.** Implements all `FarmTwinProps`. Twin layers show in farm view only. Farm view sets `scene.verticalExaggeration = exaggeration` (Cesium 1.147 / engine 26.5 name, checked in the typings), with `verticalExaggerationRelativeHeight` = the farm's ground height, and `globe.maximumScreenSpaceError` 1.5. Globe view resets both (1 and 2). The camera clamp still holds: `Globe.getHeight` picks the exaggerated mesh, so the 20 m floor follows the exaggerated ground.
- **Click behaviour change in farm view:** a click on a field calls `onSelectField(id)`. A click on empty ground calls `onSelectField(null)` and **no longer calls `onSelect(null)`**, which used to drop the user out of farm view. A click on another farm's pin still calls `onSelect(pin)`. The cursor turns into a pointer over fields when `onSelectField` is set.
- **/dev/cesium:** controls for made-up sample fields (6, dev only), swapping crops (`cropByField`), photoreal, exaggeration, and an animated overlay blob with an opacity control.

## Files
- Edited: `components/globe/Globe.tsx`, `components/viewer/cesium/tiles.ts`, `components/viewer/cesium/tiles.test.ts`, `components/viewer/cesium/Spike.tsx`
- New: `components/viewer/cesium/twin.ts`, `components/viewer/cesium/twin.test.ts`, this note
- `app/dev/cesium/page.tsx`: not changed (Spike.tsx holds the page body)

## How to see it
`http://localhost:3000/dev/cesium?tier=B` -> Location "Test location 1" -> Farm view. Use the "Farm twin" controls. The Photoreal checkbox spends one Google session per page load.

## Checked in the browser (1440x900, dev build)
- Tier B farm view: Bing aerial, OSM buildings and 6 fields with outlines; the pin stays on top.
- Click on field f4, then empty ground, then f3 -> f4 / none / f3. The farm stayed selected and the view stayed in farm view.
- Swap crops recoloured the fields. The selected field had a yellow outline. The overlay blob animated (version bumps), sat on terrain and did not paint OSM buildings. Exaggeration 3x was visible on the hills.
- Photoreal on (tier B): Google tileset loaded lazily, `globe.show=false`, fields classify the tiles, and the "Google Maps" attribution is visible. Photoreal off and then Globe view: same tileset object (no reload), hidden; terrain shown; exaggeration back to 1; twin layers hidden; SSE back to 2.
- Screenshots: `.playwright-mcp/c3-terrain-fields.png`, `c3-swap-overlay-exag3.png`, `c3-photoreal.png` (the folder is not gitignored, so do not commit it). I deleted my Playwright console logs and snapshots, which can contain ion URLs.

## Perf (Intel Arc 140T, 1440x812 canvas, dpr 1, farm view, 6 fields + animated overlay, camera orbiting continuously)
44 rendered frames/s with globe SSE 1.5, 41 with SSE 2 (the difference is noise). 1.5 is kept.

## Tests
`corepack pnpm typecheck` passes. `corepack pnpm lint` passes. `corepack pnpm test`: 125 pass, 1 fail (the known `lib/api/client.test.ts` SSE CRLF fixture). New tests: `pickSurface` (3), `fieldStyle` / `fieldIdFromPick` / `planOverlays` (6).

## Known gaps
- A tier A start followed by farm view (lazy terrain load while Google is the globe surface) is covered only by code and unit tests. Another agent navigated the shared Playwright tab, and I skipped a second Google session.
- Switching to photoreal with exaggeration 3x once dropped the camera from 1063 m to 516 m. It stayed inside the clamp, and Reset view restores it. The cause is not found (probably transient heights while tiles load).
- On Google tiles the overlays and fields also paint roofs and trees (ClassificationType.BOTH), as noted in C1.
- Textured `GroundPrimitive` registration against the DEM has not been checked cell by cell (C1 caveat).
- Fields use flat colours, not row-stripe materials.
- `TODO(verify)`: imagery terms for the Google 2D fallback (kept in case Bing fails), the OSM Buildings asset, and the Google geocoder terms. All are carried over from C1.

## For PRODUCT (GlobeHome)
- Pass `fields`, `selectedFieldId`, `onSelectField`, `cropByField`, `overlays`, `photoreal`, `exaggeration` straight to `<Globe>`. Keep `fields` and `cropByField` referentially stable (memo or module constants), because a new `fields` array rebuilds the primitives.
- Overlays: draw into your canvas and bump `version`. A new array is not required (sync runs every frame), but it is fine.
- `photoreal` toggles cost one Google session the first time per page load. Later toggles are free.
- In farm view, empty-ground clicks no longer exit to the globe. "Back to globe" is the way out.

## C3b (render): no Google tiles, simBbox, turntable camera, cheap realism
Not committed. Files: `components/globe/Globe.tsx`, `components/viewer/cesium/{tiles,clamp,twin,drape,Spike}.ts(x)` + tests (`tiles.test.ts`, `clamp.test.ts`).

- **Google Photorealistic 3D Tiles removed.** `TileTier` = "B" | "C". `Surface` = "terrain" | "base". `pickSurface({tier, failed})`. Default order B then C (no token -> C); `NEXT_PUBLIC_TILE_TIER` may force B or C. No Google tileset, no photoreal switching, no geocoder TODO, `drape.ts` lost its `tileset` option. (The Google 2D satellite ion asset stays only as the fallback when Bing is missing; `TODO(verify)` terms remain.) Fields, overlays and the outline always classify TERRAIN.
- **`simBbox`.** Farm view shows the square as a thin ground-clamped outline (`createSquareOutline` in twin.ts, light colour, alpha 0.8). No muting of the outside (dropped by decision). Undefined simBbox: the camera uses a box inscribed in the farm radius, no outline.
- **Turntable camera (hard limits, no easing).** After the fly-in, `lookAtTransform` in the ENU frame of the target (`applyOrbit`). Own pointer handlers (Cesium's controller is `enableInputs=false` and `enableCollisionDetection=false` in farm view; the collision push-out fought the orbit): left drag = heading + tilt, right drag / ctrl+left drag = tilt, middle / shift+left drag = pan, wheel / pinch = zoom. Clamps (`clamp.ts`): range 150 m - 2.5 km, pitch -89 .. -15 deg, target inside simBbox (hard stop), camera >= 20 m above the ground under it (pitches down when needed). `easeToward` and `clampCamera` removed. Reset view and the fly-in end in the same framing (pitch -45, range = 1.4 x the square's side, clamped). Back to globe: `lookAtTransform(IDENTITY)`, inputs and collision back on, lighting off.
- **Cheap realism (farm view only).** `globe.enableLighting` at a fixed time, 10:00 local solar time on 21 June 2026 (`localMorningUtcMs`, clock not animating); World Terrain now requests vertex normals so the shading shows; sky atmosphere, ground atmosphere and fog on.
- **Hover pick** is skipped while dragging and limited to ~12/s in farm view.

### Checked (Playwright, /dev/cesium?tier=B, sample simBbox ~1 km)
Orbit by drag, tilt clamps at -15.0 deg, zoom clamps 150 m and 2500 m, pan of 5000 px stays inside the bbox (hard stop), lighting visible on hills, outline visible, Reset works, Globe view releases the transform. Screenshots: `.playwright-mcp/c3b-farm-framing.png`, `c3b-orbit-low-pitch.png`.
Checks of field picking, cropByField and exaggeration were not repeated after the rewrite (code paths unchanged). The homepage Agassiz twin was not checked (depends on PRODUCT).

### Perf (Intel Arc 140T laptop browser, canvas 1554x1143 at dpr 1.5, shared machine)
Static scene, redrawn every frame: about 30 fps, identical with lighting/atmosphere/fog on or off (no measurable cost of the realism). Camera moving every frame (synthetic input): 12-15 fps, also with lighting off, twin layers off, resolution 1.0, OSM SSE 64. CPU render time was ~6 ms, so the limit looks GPU/compositor bound in this Playwright browser; the earlier C3 note measured 44 fps (smaller canvas). The >= 30 fps target while moving is NOT shown here; measure in a normal browser window.

### Gaps
- Moving-camera fps above; no real-mouse test (events were dispatched synthetically).
- Touch pinch/one-finger orbit is untested.
- Middle-drag pan is the only pan control (hidden from users; PRODUCT may add a hint).
- Field/overlay classification on OSM buildings stays unpainted (terrain only), as before.

### C3b fix: "Open twin" sometimes did not show the farm framing
- What happened: the camera did land in the orbit framing (checked: 1387 m, orbit on), but the screen still showed coarse terrain from mid-flight. In requestRenderMode Cesium stopped rendering before the last globe tiles were drawn (`globe.tilesLoaded` was true, 0 renders in 2 s, then one `requestRender()` showed the farm). "Reset view" only worked because it moved the camera again.
- Fix (Globe.tsx preUpdate): keep requesting a frame while `globe.tilesLoaded` is false, plus one more frame after the tiles finish loading.
- Also found: Cesium's CameraFlightPath sets `screenSpaceCameraController.enableInputs = true` after every flight, so after the fly-in Cesium's own controls were back on in farm view. preUpdate now turns them off again every frame in farm view.
- Safety nets in flyToFarm: the wait for the terrain height times out after 4 s. The landing (orbit framing) also runs when the flight is cancelled without a newer flight, and a watchdog (fly time + 6 s) forces it if the flight never finishes. Reset view, list and pin all go through the same flyToFarm.
- No pure test: the cause was Cesium render scheduling, not our maths. Screenshots: `.playwright-mcp/c3b-agassiz-run2.png` (bug: camera already landed, stale frame), `c3b-agassiz-run2-after.png` (after one render), `c3b-agassiz-open-fixed-b.png` (fixed path). With the fix, the first screenshot 10 s after Open twin still showed coarse tiles (still loading at the right position). They refined a few seconds later without any input.

## Step A-C (render): Google Photorealistic 3D Tiles back, overlay mask, surface switch
Not committed. Files: `components/viewer/cesium/{tiles,twin,Spike}.ts(x)`, `tiles.test.ts`, `twin.test.ts`, `components/globe/Globe.tsx`. Contract (`types.ts`, by the orchestrator) used as written: `TileTier` A|B|C, `FarmSurface`, `surface`, `overlayMask`.

- **Tiers (tiles.ts).** `selectTierOrder`: no token -> C; else the `NEXT_PUBLIC_TILE_TIER` override (A, B or C), default A, falling back downward. A and B load the same globe (World Terrain + Bing + OSM Buildings); A additionally allows Google in farm view. B or C = no Google, ever.
- **Google tileset, lazy.** `createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true }, { enableCollision: true, maximumScreenSpaceError: 8, cacheBytes: 512 MiB, maximumCacheOverflowBytes: 256 MiB })` (code from 8007eb4). Cesium's own defaults are 1.5 GiB / 1 GiB (read in `@cesium/engine` 26.5 `createGooglePhotorealistic3DTileset.js`), same as God's Eye. Loaded at most once per viewer (memoised promise, failure included), only when pickSurface returns "google": farm view **after the fly-in has landed** (`r.orbit` set), tier A, `surface` "google" (default). The whole-Earth globe and the flight never request it. Globe surface hidden once the tileset's first view has loaded. `groundAt` uses `tileset.getHeight` on Google (camera 20 m floor follows roofs/trees).
- **Route seam.** `googleTilesRoute(key = NEXT_PUBLIC_GOOGLE_MAPS_KEY)` -> "ion" | "google-key"; with a key, the tileset is created with `{ key, onlyUsingWithGoogleGeocoder: true }` (Cesium then calls Google's Map Tiles API directly). No asset ids in our code. A key without an ion token still gives tier C (terrain needs ion) - revisit when the commercial path is real.
- **Fallback.** Google load failure: `console.warn` (tiles.ts), surface re-picked -> terrain, and Globe calls `onReady({ tier: "B" })` once so the UI's tier badge can say "no photoreal".
- **pickSurface({ tier, view, want, failed })**: C -> base; farm + A + want google + not failed -> google; else terrain (or base if terrain failed).
- **Surface switch.** `surface` prop and view changes re-pick; setSurface only toggles `show` on already-loaded sources (checked: same tileset object after google -> terrain -> google). Fields, sim-square outline and overlays classify BOTH on Google, TERRAIN otherwise (fields/outline rebuild on surface change; tiles are not reloaded).
- **Overlay mask (twin.ts).** `sync(overlays, classification, mask)`: after copying an overlay canvas, `punchMask` fills all rings with `destination-out` (lon/lat -> canvas pixels via pure `lonLatToPx`, north-up over the overlay bbox). A new mask reference re-uploads every overlay; an empty or undefined mask is a no-op. **Trees are still painted** on Google tiles (no canopy mask), and fields (BOTH) also paint roofs inside field polygons.
- **Exaggeration.** Default 1 (true scale). Cesium applies `scene.verticalExaggeration` to 3D Tiles models too (`Model.enableVerticalExaggeration` defaults to true in engine 26.5), so Google tiles scale with the terrain when > 1 (code read; not checked visually).
- **Redraw while loading.** preUpdate now keeps rendering while the globe (if shown) or the Google tileset (if shown) is still loading, so the fly-in fix also covers Google tiles.
- **/dev/cesium.** `?tier=A|B|C`; Surface select (google/terrain); "Mask 3 sample squares" (made-up 60 m squares) for the overlay blob.

### Tests
`corepack pnpm typecheck` pass; `lint` 0 errors (2 warnings in `components/viewer/viewer.test.ts`, PRODUCT's file); `test`: 101 pass, 1 fail (known `lib/api/client.test.ts` CRLF). New/updated: selectTierOrder (3), googleTilesRoute (1), pickSurface (3), lonLatToPx (2).

### Browser check (Playwright Chromium, 1920x1080, dpr 1, Intel Arc 140T)
- /dev/cesium?tier=A, test location 1 (-121.76, 49.24 = the Agassiz research farm area): globe view made **0** Google requests; after landing: surface google, `globe.show=false`, "Google Maps" logo + Cesium ion credit visible bottom-left. Screenshots `.playwright-mcp/stepA-oblique-dev.png`, `stepA-mask-dev.png`.
- Mask check on the uploaded overlay texture: alpha 0 inside a mask square, 108 just outside; mask off -> 75 at the same pixel (re-uploaded).
- Quality verdict (oblique, ~1 km range, true scale): good. Real 3D buildings (barns, greenhouses, houses), tree masses with height, roads/rail, and the research plots (strip trials, berry rows) are sharp and readable; the farmland itself is near-flat photo texture, as expected. Fields painted with BOTH tint roofs/trees inside their polygons. The sim-square outline is broken in places on the tiles (thin classified polyline). Top-down shot not taken (server down).
- fps: camera rotated every animation frame with Google tiles still streaming: ~20 rendered fps, ~31 ms CPU per frame (tile processing), tileset memory 245 MB. Earlier synthetic-drag runs are not comparable (Playwright input rate).
- Quota: 1 Google tileset load (one page load in farm view).
- Homepage Agassiz path: blocked; the shared dev server returned HTTP 500 on every page (incl. /dev/cesium) for > 3 min after the PRODUCT build/restart (`.next` nearly empty). Not checked.
- Screenshot `stepA-check-state.png` = homepage globe view (tier A badge), taken before the server broke. Playwright console logs/snapshots deleted.

## Phase 3 render: A/B split, look filters, load progress, camera get/set, outline fix, perf, framing
Not committed. Contract `types.ts` (orchestrator) used as written: `compare`, `look`, `onLoadProgress`, `getCamera`/`setCamera`. Files: `components/globe/Globe.tsx`, `components/viewer/cesium/{twin,tiles,clamp,Spike}.ts(x)`, new `look.ts`; tests `twin.test.ts`, `tiles.test.ts`, `clamp.test.ts`, new `look.test.ts`.

- **A/B split (one camera).** `compare` set: `scene.splitPosition = divider` (clamped 0..1, pure `splitSides`). The overlay material got C1's discard test (`side` uniform vs `czm_splitPosition`): A's overlays draw left, a second overlay layer draws B's `right.overlays` right. Field fills cannot be split as per-instance classification colours (Cesium's ShadowVolumeAppearance ignores custom shaders), so while comparing each side's fills are rasterised into a canvas (`createFieldCanvas`, ≤2048 px, ≤2 px/m, memoised on fields/crop/selection) and drawn as a split overlay; the classification fill primitive goes alpha 0 but stays pickable (its PICK pass forces alpha 1), outlines stay shared. Works on Google tiles and terrain (same classification path). Side effect: in split mode the overlayMask also cuts roofs out of the field fills. No divider line is drawn by the globe (UI owns it).
- **Look filters (`look.ts`).** Our own GLSL `PostProcessStage`s, created lazily, toggled by `enabled`, farm view only (`activeLook`): thermal = luminance → 5-stop false-colour ramp; vegetation = excess-green (2g−r−b on chromatic coords) → bright green, rest dim grey; night = brightened luminance, green tint, vignette. One texture read each; no measurable fps cost (thermal 18.7 vs none 17.2 in the same run, noise).
- **onLoadProgress.** `LoadedTier.pending()` = globe tile queue (`Globe.tileLoadProgressEvent`, if the globe is shown) + `requests + processing` of each shown tileset (`Cesium3DTileset.loadProgress`, Google and OSM). Throttled by pure `progressToReport` (≤4/s, 0 reported at once, unchanged values skipped); always 0 outside farm view. Seen: `35,158,6,174,141,127,232,161,0…` per second after Farm view (settles in ~9 s with SSE 16).
- **getCamera/setCamera.** Pure `cameraFromOrbit` / `orbitFromCamera` (clamp.ts; Cesium lookAt HPR convention, exact inverse, pitch limited first). Farm view: getCamera is the orbit's camera pose; setCamera re-targets the orbit (same camera position and view direction), clamps apply on the next frame. **Called during the fly-in it is queued and applied on landing** (`pendingCamera`), so PRODUCT's 4.5 s timer is not needed (an onLanded callback is not needed either). Globe view: plain `camera.setView`. Browser: save → turn 17° → restore gave the same pose (±1 m height from ground updates).
- **Sim-square outline on Google tiles** is now a plain polyline 1 m above the fly-in's terrain sample with a dimmer `depthFailAppearance` (continuous through trees/roofs; ground-clamped on terrain as before). One height for the whole square (`ponytail:` note: floats/sinks on slopes, still visible).
- **Farm pin hidden in farm view** (the open farm's pin + label; other pins unchanged).

### "Buildings are flat" — cause: Google's rural coverage, not our layers
Control test (/dev/cesium?tier=A, only the Google tileset shown: globe off, OSM off, twin layers off, no post-process, exaggeration 1, tiles loaded): Agassiz barn complex at 250 m / −20° and 160 m / −15° (`phase3-render-control-agassiz-loaded.png`, `-close.jpg`) is a coarse 2.5D mesh: barns are low blobs with photo texture, trees are lumps. Same settings over downtown Vancouver (`phase3-render-control-vancouver.jpg`) show full 3D buildings with facades. Our stack was also checked in farm view: `globe.show=false`, OSM hidden, `verticalExaggeration=1`, Google tileset shown with the Google logo. Nothing of ours flattens the mesh; better framing only helps a little.

### Perf + framing changes (asked for "laggy")
- Google tileset `maximumScreenSpaceError` 8 → 16 (Cesium default); `dynamicScreenSpaceError`, `foveatedScreenSpaceError`, `cullRequestsWhileMoving` true and `preloadWhenHidden` false are Cesium's defaults already (now set explicitly). `resolutionScale` cap 2 → 1.25. Orbit limits: max range 2.5 → 1.5 km, highest pitch −15° → −25°. Default framing: pitch −30°, range 0.45 × square side clamped to 400–600 m (was −45°, 1.4 × side ≈ 1.4–2 km).
- Fog: not changed. Cesium's fog culls globe terrain tiles only (no fog handling in `Cesium3DTileset`), and the globe is hidden in google mode, so it would not reduce Google tiles.
- Shadows (`viewer.shadows`, hard, maxDistance 1.5 km): 18.6 → 17 fps; **left off**.
- fps method: the shared Playwright browser throttled `requestAnimationFrame` to ~1.5 Hz (another agent's tab in front), so fps = 1000 / median time of a forced `render()` + 1-pixel `readPixels` (GPU sync) while rotating, 1920×992 canvas, dpr 1, Intel Arc 140T. Old framing (−45°, ~1 km up), split + blob: SSE 8 18.6 → SSE 16 23.4 fps. New framing (−30°, 400 m): single 21.2, single + blob overlay 18.3, split A|B + blob 18.0. So SSE 16 mattered most; the split itself costs ~nothing; each classification layer on Google tiles costs a few fps. **25 fps not reached in this browser**; check in a normal window (earlier C1 note: Playwright figures ran lower than a real window).

### Screenshots (`.playwright-mcp/`)
`phase3-render-single.png` (outline continuous on Google), `phase3-render-framing-after.jpg`, `phase3-render-split.jpg` (A fills left, B fills right), `phase3-render-thermal.jpg`, `-vegetation.jpg`, `-night.jpg`, `phase3-render-control-agassiz*.{png,jpg}`, `phase3-render-control-vancouver.jpg`. Google loads used: 4 page loads (one was forced by another agent's navigation of the shared tab). Playwright logs/snapshots deleted.

### Tests
`typecheck` pass, `lint` pass, `test` 128 pass / 1 fail (known `lib/api/client.test.ts` CRLF). New: `cameraFromOrbit`/`orbitFromCamera` (3), `progressToReport` (2), `splitSides`/`sideValue`/`fieldsBbox` (4), `activeLook`/shaders (2).

### Gaps
- Vegetation look also recolours our illustrative field fills (they are green), so filled fields turn flat bright green; PRODUCT may hide fills or lower their opacity while a look is on.
- Field-canvas edges are anti-aliased raster (0.5 m/px), slightly softer than the vector fills used outside split mode.
- Google's Agassiz mesh stays 2.5D; for real 3D barns, model them (out of scope) or accept.
- fps ≥25 not shown in the shared Playwright browser.

## Phase A render: framing/minRange, field look (no fills, hover label), /dev/trace, traced Cornell + Beltsville, Mead check
Not committed. Contract `types.ts` (orchestrator) used as written: `Farm.framing`, `Farm.minRangeM`, `FarmTwinProps.showCropFills`.

- **Framing + min range (clamp.ts, Globe.tsx).** New pure `startFraming(box, framing?, minRangeM?)`: `Farm.framing` (degrees → radians, target clamped into the camera box) or the old default (box centre, -30°, 0.45 × side in 400–600 m). Used by the fly-in end and Reset view (same `flyToFarm`). `clampOrbit(o, needAbove, minRangeM = 150)`: `Farm.minRangeM` raises the closest orbit distance (capped at the 1.5 km max). The frame constants moved from Globe.tsx to clamp.ts.
- **Field look (user design change, twin.ts + Globe.tsx).** Default: no fill, no outline (fill alpha 0, still pickable). Hover over a field: faint edge (alpha 0.3) + a dark-glass label at the field centroid, "<name> · <crop words> (illustrative)" (`CROP_WORDS`, `fieldHoverText`, `ringCentroid`; in the A/B split the crop of the side under the cursor). Selected field: thin yellow edge (alpha 0.75, 1.5 px), no fill. `showCropFills` true brings back the old fills (and the per-side split fill canvases, now drawn only when `showCropFills`). The label hides when the pointer leaves the canvas, when fields change and in globe view (it lives in the twin layer group). `fieldStyle(look, { selected, hovered, fills })` changed signature.
- **/dev/trace** (`app/dev/trace/{page,Tracer}.tsx`, helpers `components/viewer/cesium/trace.ts`). Google 3D tier A, loaded lazily after the farm fly-in. Presets: Cornell barns, Beltsville campus point, Intercourse PA, Oakville, Mead US-Ne3/US-Ne1; `?lon=&lat=` custom point, `?r=` camera radius (default 3000 m). Click = vertex (scene.pickPosition after a forced render, globe/ellipsoid fallback), undo, finish ring, drop ring, ring list with areas, Copy TS (6 decimals) / GeoJSON, "Set framing" (screen-centre pick + orbit heading/pitch + distance), "Square at centre" (square in metres, shown as simBbox), "Re-centre here", paste rings to display them. `window.__ftTrace` = { globe handle, viewer } for scripts. Dev only (not linked from product nav, like /dev/cesium).
- **OSM Overpass retry (2026-11-13, overpass-api.de, User-Agent sent): it answered.** Cornell square: no landuse=farmland/meadow polygons → traced by eye. Beltsville: 42 farmland ways nearby → OSM rings used (query and way ids in `lib/farms/traced/beltsville.ts`, ODbL credit).
- **Traced output (`lib/farms/traced/`):** `types.ts` (`TracedFarm`), `cornell.ts`, `beltsville.ts`, `framings.ts`. No crops or names (PRODUCT assigns).
  - Cornell: 3 fields traced by eye, 11.6 / 5.3 / 20.6 ha (north of barns, east of freestall barns, south of the farm road), approximate. simBbox 1300 m square centred -76.2426, 42.4424. Framing { -76.242216, 42.441767, 400 m, -30°, heading 20° } (barns + f1/f2/f3 in view).
  - Beltsville: OSM ways 224922167 / 224819517 / 224922168, 12.8 / 14.0 / 16.6 ha, next to the building/silo cluster ~0.5 km SW of the campus point. simBbox 1300 m square centred -76.889, 39.0285. Framing { -76.890049, 39.030066, 400 m, -30°, heading 330° }.
  - framings.ts: Mead { -96.4766, 41.1651 (US-Ne1 pivot), 600 m, -35°, 0° } (proposed, not screenshotted at these values); Lancaster { -76.097011, 40.043747, 500 m, -30°, 330° } + `LANCASTER_MIN_RANGE_M` 250 (strip fields and farmsteads NE of the village; needs radiusM ≥ ~1300 m because the target is ~1.1 km from the village point); Oakville { -122.412502, 38.420301, 500 m, -30°, 300° }.
- **Mead 3D check** (screenshots `phaseA-mead-oblique.png` 400 m/-30° at US-Ne3, `phaseA-mead-close.png` 200 m on the research buildings, `phaseA-mead-edge.png` 150 m at the US-Ne1 pivot edge, `phaseA-mead-ne1-top.png`). The Globe orbit clamps pitch at -25°, so the -20° / -12° views ran at -25°. Imagery is bare winter soil. Ratings vs Beltsville (5): buildings 2 (blocky, soft facades), trees 1 (creek trees are flat dark smears), terrain 3 (flat; pivot circles and wheel tracks readable from above), overall 2. Recommendation: OK as an "explore" pin seen from above (pivot circles); not a good close-up 3D showcase.
- Browser checks: /dev/trace at 1600×1000 (rings drawn on Google tiles, `phaseA-cornell-f123.png`, `phaseA-barc-osm.png`, framings `phaseA-{cornell,barc,lancaster,oakville}-framing.png`); /dev/cesium?tier=B hover label + selected edge (`phaseA-hover-label.png`, `phaseA-selected-outline.png`). Google loads: 1 page load (all six places flown to inside it). Playwright logs/snapshots deleted.

### Tests
`typecheck` pass, `lint` pass, `test` 145 pass / 1 fail (known `lib/api/client.test.ts` CRLF). New: `startFraming` (3, incl. minRangeM), `trace.ts` (3), field look/hover label (3); `fieldStyle` tests updated.

### Gaps
- Cornell fields and the Cornell location are approximate (traced by eye; f3 clips a corner of the southern barn yard). TODO(verify) with Cornell.
- `Farm.framing` / `minRangeM` were checked by unit tests only; no browser run of a farm carrying them (PRODUCT's config was mid-refactor).
- The selected-field edge on terrain (ground polyline) breaks up into dashes on slopes; on Google tiles it classifies the tiles.
- Mead framing not screenshotted; Lancaster framing target is outside a default 1 km-radius box (would be clamped).

## Step 0 render: engine seams, detail plumbing, lag pass
Not committed. Contract `types.ts` used as written (`weather`, `groundLayers`, `detail`).

**Seams.** `components/viewer/cesium/weather/index.ts` (owner Person 1: `WeatherEngine`, `createWeatherEngine` stub) and `ground/index.ts` (owner Person 2: `GroundRenderer`, `createGroundRenderer` stub), header comments carry the contract rules. `Globe.tsx` creates both once per viewer on the first farm-view frame (needs the tier), calls `weather.update(props.weather ?? null, ctx)` / `ground.update(props.groundLayers ?? [], ctx)` every preUpdate, calls `scene.requestRender()` only while either `active` (`needsContinuousRender`), and destroys them on leaving farm view / unmount. Nobody else needs to touch Globe.tsx.

**Detail (perf.ts `qualityFor`, applied by tiles.ts `applyQuality`).** high = SSE 12, resolutionScale <=1.5; medium = 16, <=1.25 (default); low = 24, 1, and with a scenario active (weather or groundLayers) SSE 64 = effectively no new refinement while it plays (Cesium has no real "pause requests" switch; tiles already loaded stay).

**Lag pass.**
1. `scene.msaaSamples = 1` (Cesium default is 4; FXAA stays). This is what mattered.
2. Farm view after landing: near 1 m, far 3 km, fog density 6e-4 (restored to 0.1 m / 5e8 / 2e-4 on the globe) via `setFarmCameraLimits`. Not measurable here (+-1 fps); fog does not touch Google tiles (Cesium culls globe tiles only); harmless.
3. Dynamic quality: pointer/wheel orbit touches a debounced motion flag; moving or flying = SSE >= 32 and resolutionScale 1; detail setting returns after 1 s idle (`createMotionTracker`).
4. Ground-height lookups (`tileset.getHeight` is a ray pick, ~4 ms settled, 50+ ms while streaming) are now <= 5 Hz. `enableCollision` set false on the Google tileset: getHeight does not need it (verified: still returns heights); it only fed camera collision (off in farm view) and clamp-to-ground entities on the tiles (none).
5. Under Google in farm view: globe hidden (`globe.show=false`, so no globe tile requests); OSM Buildings hidden (`show=false`, no draw); only the Google tileset, the twin PrimitiveCollection (field/outline classification primitives each redraw the tiles, the known cost of "BOTH" classification: keep layers few) and billboards/labels of pins (others are below the horizon, the open farm's is hidden). Sky atmosphere, sky box and fog still draw (cheap).
6. Dev readout: `window.__ftPerf()` (frame ms avg/p95, fps, render CPU ms, tiles pending/processing, tileset MB, resolution scale, SSE, engines active); overlay top-right toggled with the backtick key, shown from the start with `?perf=1`. Dev builds or `?perf=1` only.

**Measured** (Playwright Chromium, Intel Arc iGPU, 1600x812 canvas, dpr 1, /dev/trace at the Cornell preset, Google tiles settled, ~640 m up, -30 deg; fps = 1000 / median of forced render + 1 px readPixels while rotating, so it is GPU-synchronous and not tied to rAF; the test browser is slower than a normal window): MSAA 4 + old frustum/fog 42-44 fps (22.7-23.7 ms) -> new 61-71 fps (14.0-16.2 ms). MSAA alone: 44.6 fps; frustum+fog alone (MSAA off): 65 fps, so MSAA accounts for essentially all of it. SSE 16 -> 32 while moving: 54 -> 64 fps in one run. Per-frame getHeight x2 vs throttled: +2 ms (settled). 60 fps is reached in this browser on this scene but not guaranteed with streaming tiles or classification layers on; `perf.avg` while idle-streaming showed ~53-57 fps. Used /dev/trace (same Globe, Cornell preset) rather than /dev/cesium because /dev/cesium only has the Agassiz test sites. 1 Google page load. Screenshot `.playwright-mcp/step0-render-perf-overlay.png`.

**Tests.** New `perf.test.ts` (qualityFor, motion tracker, throttle, needsContinuousRender, frame stats). typecheck: only `lib/twin/scenario.ts` (PRODUCT's missing `./scenarios/registry`), lint pass, `components/viewer` tests 70 pass.

**Gaps.** Weather/ground engines are stubs. MSAA off makes edges rely on FXAA (screenshot looks fine). Dynamic quality is not toggled by the share-link `setCamera`. Low-detail "pause" is a high SSE, not a true request stop.

> 2026-11-14 (FARM-SCOUT): the Lancaster County / Intercourse PA farm was removed from the app. Mentions above are historical.
