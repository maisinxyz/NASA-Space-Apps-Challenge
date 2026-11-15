# FT-F3 — 2D bird's-eye view (Person B)

Date: 2026-11-15.

## What was built
- "2D Map" / "3D Explore" button in the farm controls (UBC Farm and KPU Langley, the farms with imagery). Store field `map2d` in `lib/store.ts` (reset per farm).
- Opening 2D pauses the Cesium render loop (`paused` prop on `Globe`, `components/globe/types.ts` + `Globe.tsx`: `viewer.useDefaultRenderLoop = false`). The Cesium scene and camera are not touched, so 3D Explore resumes at the same camera.
- `components/map2d/Map2D.tsx` (lazy-loaded with `next/dynamic`, so MapLibre is not in the main bundle):
  - First open: north-up, pitch 0, fitted to a 3 km × 3 km box around the farm point. Each farm's 2D camera is saved on close and restored on the next open (`lib/map2d/geo.ts`).
  - Reset map, flat / globe projection toggle, zoom + compass buttons, metric and imperial scale bars, MapLibre keyboard pan/zoom.
  - Imagery (`lib/map2d/imagery.ts`): City of Vancouver 2022 orthophoto XYZ tiles (UBC); Township of Langley 2022 orthophoto through the MapServer `export` endpoint with `{bbox-epsg-3857}` (KPU). Attribution in the map control and a caption "captured 2022 (not the forecast period)".
  - Field outlines coloured per field from the F2 values; click a field for a plain-language popover (value, range, higher/lower is better, scenario forecast).
  - Draw a field: click corners, "Analyse field" → `POST /field/analyze` → result card (area, location, per-strategy year-10 soil index and irrigation need, resolution notes, support sentence). Client check: at least 3 points and at most 200 ha. 429 and other errors shown in plain words. Mock mode shows the contract fixture with a "mock" badge.
  - Imagery failure: non-blocking banner; the 3D Explore button stays.
  - `map.remove()` on close releases the MapLibre WebGL context.
- Tests: `lib/map2d/map2d.test.ts` (3 km box, polygon area/closing, camera memory, imagery config, per-farm reset). `pnpm test` 553 passed, typecheck and eslint clean.

## Not verified here
- The ten open/close cycle check (no WebGL context loss, no rising memory) needs a browser run; not done in this session. Expected to hold: one Cesium context kept and paused, one MapLibre context created and removed per open.
