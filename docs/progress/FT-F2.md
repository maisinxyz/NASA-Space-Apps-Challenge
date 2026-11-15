# FT-F2 — UBC and KPU twin, per-field colouring (Person B)

Date: 2026-11-15.

## What was built
- UBC Farm and KPU Langley are `tier: "twin"` (`lib/farms/candidates/{ubc-farm,kpu-langley}.ts`) with twin configs in `lib/farms/bc.ts`.
  Fields come from the same request JSON the engine gets, so the 3D map, the field list and the forecast share one list.
  - UBC: the six OSM UBC Farm plots (ODbL).
  - KPU: four OSM `landuse=farmland` ways nearest the pin (95899267, 95899276, 96026582, 95899281; Overpass API 2026-11-15). They are not named in OSM and **not confirmed as KPU fields** — the twin label says so. Confirm with the owner (R11).
- `lib/forecast/kpu-request.json` (existing rotation = the site's stored preset), `FARM_SITE["kpu-langley"] = "site_kpu_langley"`, `baseRequest(siteId)`.
- New rotation set `bc-mixed` (`lib/twin/rotations.ts`) for the Now-mode compare; it mirrors the engine's current and generated rotations for the demo pool.
- Per-field colouring (D4): `lib/farm-future/fieldColours.ts` + `components/farm-future/FieldColours.tsx`. In Future mode each field is filled from its engine trajectory (soil organic matter, water stress = irrigation need, bare-soil weeks) at the clock year for the selected strategy. The scale spans years 1–10, so dragging the year recolours. Legend with metric switch and per-field values with units.
- Store: one field `fieldMetric` in `lib/farm-future/store.ts`. `GlobeHome` passes the field overlay with the zone overlays.
- Farm popup / farm view: both farms show "Compare rotations".

## Tests
- `lib/farm-future/fieldColours.test.ts` (values, recolouring by year, same fields as the twin, ramp).
- Updated `farms.test.ts`, `twin.test.ts`, `candidates.test.ts`, `FarmPopup.test.tsx` for the two new twins.
- typecheck clean, `pnpm test` 548 passed.

## Gaps
- KPU forecast fails until B6 (no soil seed); in mock mode there is no KPU pre-built file, so the KPU panels show the error and the synthetic fallback.
- The Now-mode scenario simulation has no run source for the BC farms (shows its empty-run message).
