# FT-FE (FE1–FE5) — UBC Farm: backend forecast wired into the web app

Status: **first vertical slice done**. 2026-11-15. Frontend plus small backend data changes; contract unchanged (v1.2.0).

## What was built

- **FE1, API client.** `apps/web/lib/api/schema.d.ts` was regenerated from contract v1.2.0. New aliases are in `lib/api/types.ts`. `lib/api/client.ts` adds:
  - `getClimateOutlook`, `getForecastExposure`, `getCropCatalog`, `getForecast`, `getSensitivity`
  - `getPrebuiltForecast`, which reads the static file `public/prebuilt/<site>_forecast.json`
  - a request cache: identical requests reuse the first result, and failures are not cached
  - `debounce`
- **FE2, mock site list.** `sites.json` now has `site_ubc_farm` "UBC Farm (mock)" and `site_kpu_langley` "KPU Langley (mock)". The old Okanagan, Fraser and Metro entries are gone. Both sites still use the placeholder hills terrain, so they keep the "(mock)" label. The mock zones fixture moved to `site_kpu_langley`, because curated sites return empty seed zones.
- **FE3, UBC location.** The user supplied 49°14'59.23"N 123°14'12.43"W, which is 49.249786, -123.236786. It is used in:
  - `lib/farms/candidates/ubc-farm.ts`, for the pin and the camera framing (`rangeM` 750)
  - `services/api/app/features/config.py`, the site record

  The seeds were pulled at the earlier geocoder point, about 300 m away. That is the same NASA POWER cell (55 km), so the seeds were not rebuilt. KPU Langley framing `rangeM` changed from 1000 to 1300.
- **FE4, UBC forecast in Future mode.**
  - **Request.** `lib/forecast/ubc-request.json` holds the UBC request:
    - Six fields. Each is a real UBC Farm plot outline from OpenStreetMap, with its planar area in hectares:
      - D3-1 Brassicas
      - D4-1 Goosefoots
      - D6-2 Nightshades and Garlic
      - D6-1 Alliums and Legumes
      - D7-2 Early Cucurbits
      - D5-3 Maya Garden
    - The way ids and the Overpass query are recorded in `lib/forecast/sites.ts`.
    - Crop pool: winter wheat, barley, field pea, red clover, cereal rye cover, canola, soybean.
    - Existing rotation: barley, then pea, then winter wheat. This is **assumed**; see the gaps below.
  - **Mapping.** `lib/forecast/sites.ts` maps farm `ubc-farm` to site `site_ubc_farm`. `requestFor()` applies the Future-mode what-if sliders as a `ScenarioInput` adjustment.
  - **Store.** `lib/forecast/store.ts` is a Zustand store. In live mode it calls `POST /forecast`. Otherwise it loads the pre-built file, or falls back to the contract fixture labelled "mock". A newer load supersedes an older one.
  - **Selectors.** `lib/forecast/select.ts` holds pure helpers for strategies, series by farm or field, value at a year, and clock-to-year mapping.
  - **Panel.** `components/farm-forecast/ForecastPanel.tsx` is opened by the new "Forecast" pill, next to "Soil health" in Future mode. It only appears on farms with an engine site. It shows:
    - strategy tabs, with labels from the engine
    - a whole-farm (area-weighted) or per-field selector
    - 8 metrics
    - a Year 0–10 chart with a p10–p90 band; its year marker follows the farm-view clock, and clicking the chart moves the clock
    - per-strategy values with unit, range and basis label
    - the scorecard and the review flags
    - the disclaimer and the support sentence
    - assumptions and sources, including the ODbL credit for the OSM field outlines
    - a source label: "Live engine run", "Pre-built engine run", or "Mock fixture (placeholder numbers)"
  - **Pre-built file.** `scripts/build_ubc_prebuilt.py` writes `public/prebuilt/site_ubc_farm_forecast.json` (509 KB) from the seeds with `OFFLINE=1`. Two runs produce the same `request_hash`. The live API response for the same request matches the file exactly.

## How to run

```sh
# offline / default: pre-built engine output
cd apps/web && pnpm dev
# live engine
OFFLINE=1 make dev                          # API on :8000 (CORS allows localhost:3000)
cd apps/web && NEXT_PUBLIC_API_MODE=live pnpm dev
# rebuild the pre-built file after engine or request changes
services/api/.venv/Scripts/python.exe scripts/build_ubc_prebuilt.py
```

Then open UBC Farm on the globe. Switch to Future mode and press "Forecast".

## Tests (2026-11-15, after rebasing on origin/main c51d2fc)

- services/api: 242 passed. packages/contracts: 85 passed.
- apps/web: 59 files, 526 tests passed. The new tests are in `lib/forecast/forecast.test.ts` and `components/farm-forecast/ForecastPanel.test.tsx`. `pnpm typecheck` is clean.
- `pnpm lint`: 3 errors that were already there, in `e2e/farm-view/helpers.ts` (`no-explicit-any`). None are in the new files.

## Known gaps (the next prompt must know)

1. **The engine cannot plan UBC's vegetables yet.** 37 of the 49 catalog crops have null season windows and Kc values (FT-W5 left them unsourced), and the engine reports "No season window is recorded". This affects the vegetables and most covers. The demo pool is therefore field crops, and the existing rotation (barley, pea, winter wheat) is an assumption, not what UBC grows. Fix: source the BC planting windows and the FAO-56 Kc values in `data/seed/crops/catalog_v2.json`. TODO(verify).
2. **Some engine magnitudes need a backend review before the demo.** For UBC:
   - soil loss is about 52–60 t/ha/yr (modeled)
   - the N balance index reaches about 390 (relative)
   - alternative pest pressure saturates at 100 (assumed)
   - N fertilizer need and saved are 0 on every strategy

   The panel shows them as returned, with their basis labels.
3. **The climate is stationary under `baseline`.** The outlook gives seasonal climatology and trend statistics, not a per-year drift. Future mode's timeline ribbon, pills, lens cards, Soil health and Compare still read `lib/farm-future/fixtures.ts`, labelled "Synthetic demo data". The Forecast panel is the only engine-fed part. The next step is a data layer behind `lib/farm-future/model.ts`.
4. **The panel's strategy tabs are separate from the Strategy picker.** The picker still lists the synthetic strategies.
5. **UBC is still `tier: "explore"`.** The six OSM plots are not drawn on the 3D map, and the scrubber does not recolor fields yet. That needs a `lib/farms/ubc.ts` TwinSpec and a rotation set.
6. **KPU Langley has no POWER or soil seed**, so it has no forecast.
7. **What-if sliders only refetch in live mode.** The pre-built file is baseline only.
