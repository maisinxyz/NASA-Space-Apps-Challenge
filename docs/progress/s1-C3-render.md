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
