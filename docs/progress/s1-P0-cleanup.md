# S1-P0 — Remove legacy pages + surface/overlayMask wiring (PRODUCT agent)

Plan: `~/.claude/plans/pasted-content-id-c071-section-1-linear-wand.md`, "Decisions from the user" item 1 and Phase 0.
Not committed (orchestrator commits).

## Deleted (usage scan: import graph from the surviving routes `/`, `/methods`, `/dev/{api,cesium,styleguide}`, then grep)
- Routes: `app/explore`, `app/scan`, `app/viewer`, `app/simulate`, `app/lab`, and `app/dev/viewer` (dev page for the r3f viewer).
- r3f viewer: `components/ViewerStage.tsx`, `components/viewer/{Scene.tsx,TwinViewer.tsx,material.ts,assets.ts,assets.test.ts,index.ts,geo.ts}`.
- Panels only those pages used: `components/sim/{Hud,StormPicker}.tsx`, `components/twin/{Attribution,FieldPanel,InsightPanel,LayerPanel,ProbeReadout}.tsx`.
- Libs + tests: `lib/useSiteData.ts`, `lib/scanForm.ts(+test)`, `lib/simulation.ts(+test)`, `lib/fieldStats.ts(+test)`, `lib/tour.ts(+test)` (guided demo, no entry point since S1-C2).
- `scripts/qa-browser.mjs` (drove /simulate and /dev/viewer) and its `qa:browser` script.
- Deps: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `playwright` (only qa-browser used it). Lockfile updated.
- Tests trimmed: `components/viewer/viewer.test.ts` lost the geo.ts tests (mesh, probe, field raster); the timing/LUT/diff tests stay.

## Kept and why
- `components/viewer/{timing,legends,luts,fields,meta,resources,types}.ts`: kept per the user decision (Phase 4 storm replay uses timing + decode). `meta`/`types` are imported by Header, `ui/Legend`, `/dev/styleguide`. `types.ts` trimmed to `FieldFeature`, `ViewerLayerName`, `ViewerLegend` (the TwinViewer props/handle/stats were removed).
- `lib/decode/*` (all, incl. diff/risk: plan keeps them for Phase 3/4), `lib/api/*` (Methods + dev pages; mock mode reads `/mock`, so `scripts/sync-mocks.mjs` + predev/prebuild sync stay), `lib/keys.ts`, `lib/farms.ts`, `lib/twin/*`.
- `components/lab/EvidenceCardView.tsx(+test)`: used by `components/farm/TwinPanel.tsx` (Evidence mode). Left in place to avoid churn.
- `components/ui/*` all still used (Methods, styleguide, TwinPanel).

## Updated
- `components/Header.tsx`: product header — FieldTwin wordmark, "Methods & data" (/methods), mock/offline badges, About, Presenter mode. No legacy links.
- `components/TourController.tsx`: Reset key (R) only; guided-demo runner and `BackupVideo` removed. (`NEXT_PUBLIC_BACKUP_VIDEO_URL` in root `.env.example` is now unused; not touched.)
- `components/globe/GlobeHome.tsx`: failure fallback is the farm list only (no "Open the offline view"); `SimLink` gone; passes `surface` and `overlayMask`.
- `components/globe/FarmCard.tsx(+test)`: `SimLink` (/simulate) removed; card without a globe shows no action.
- `components/globe/AboutPanel.tsx`: step 1 no longer mentions scanning your own land (Land Scan removed).
- `app/methods/page.tsx`: no store dependency (uses the first site's terrain); "Back to the sites" (/explore) → "Back to the farm globe" (/).
- `lib/store.ts(+test)`: removed keys only the legacy pages used (siteId, terrainId, selectedFieldId, stormId, rotationIds, simRotationIds, timeMin, playing, mode, layers, quality, tourStep, showDiff, simId, divider). Phase 3/4 re-add what they need.

## Wiring for the new contract (types.ts `surface`, `overlayMask`)
- Store: `exaggeration` default 1 (true scale; was already 1), new `twinSurface: "google" | "terrain"` default `"google"`, both reset by R.
- Explore panel (`components/farm/TwinPanel.tsx`): radio toggle "Photoreal 3D (Google) / Terrain only"; slider label "Vertical exaggeration (1× = true scale)".
- `GlobeHome` passes `surface={twinSurface}` and `overlayMask={inTwin ? AGASSIZ_BUILDINGS : undefined}`.

## OSM building footprints: NOT fetched
`overpass-api.de` was unreachable from this machine on 2026-11-13 (curl: 4 tries, "Failed to connect ... after 21 s"; PowerShell: "Unable to connect"). `AGASSIZ_BUILDINGS` in `lib/twin/agassiz.ts` is an empty array with a `TODO(verify)` comment holding the exact query
`[out:json][timeout:60];way["building"](49.24461,-121.77543,49.25719,-121.75617);out geom;` and the ODbL credit to add. No footprints were invented. When it works, fill the array (or move it to `lib/twin/agassizBuildings.ts`) with the date and OSM base timestamp.

## Results (apps/web)
- `corepack pnpm typecheck`: pass. `lint`: pass (0 problems).
- `corepack pnpm test`: 15/16 files, 101/102 tests pass; the one failure is the known `lib/api/client.test.ts` SSE/CRLF one.
- `corepack pnpm build`: pass; routes `/`, `/methods`, `/dev/{api,cesium,styleguide}`; check-build OK.
- Dev server (before the build): `/` and `/methods` 200 (Methods loads its content, header shows FieldTwin / Methods & data / About / Presenter, no console errors on `/`); `/explore`, `/scan`, `/viewer`, `/simulate`, `/lab`, `/dev/viewer` 404.
- Note: running `pnpm build` while `pnpm dev` is up overwrote `.next`; the running dev server then answered 500 on every route. Restart `pnpm dev` (it is not a code fault: the production build of the same code passes).

## For the next prompt
- Render agent owns `Globe.tsx`: it must honour `surface` and `overlayMask` (empty array = no mask).
- Phase 1 shell starts from the new Header; `/` is the only product route plus `/methods`.
