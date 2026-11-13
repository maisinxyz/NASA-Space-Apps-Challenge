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
