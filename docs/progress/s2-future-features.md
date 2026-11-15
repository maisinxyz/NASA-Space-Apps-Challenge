# s2-future-features: Future / Compare modes on the farm view

Adds the "future features" (10-year climate, water balance, field vulnerability, soil health per strategy,
strategy comparison, uncertainty and what-if) to the farm view without crowding it. Design reference: the
Round 4 screens on the Stardew Earth design canvas (F1–F6) and their minimal-style pass.

## What was built
- **Rule: add without crowding.** "Now" mode renders exactly the farm view as before. Future mode adds only
  four doors: the **mode switch** (Now · Future · 10 yr · Compare strategies) under the farm name, **Lenses ▾** in
  the layer bar, the **What-if** pill above the timeline, and the **10-year timeline**. One lens and one panel
  at a time (store-enforced).
- **Master clock** (`components/farm-future/FutureTimeline.tsx`): 2026–2035, 10 yr / 1 yr zoom, play/pause,
  1:1 drag with pointer capture, a tick on every step (month in 10 yr, week in 1 yr; heavier tick on a year /
  month boundary) via `lib/ui/sound.ts`, haptics via `vibrate()` from `lib/farm-view/timeline.ts`, snap to the
  nearest month (10 yr) or day (1 yr) on release, keyboard (←/→, Shift, PageUp/Down, Home/End). Decorations:
  2 px temperature ribbon, heavy-rain marks, frost-free windows; crop growth strip with stress windows
  (1 yr + Erosion lens); p10–p90 band + dashed p50 (Uncertainty lens).
- **Lenses** (`Controls.tsx`, `LensCards.tsx`): grouped menu (Climate / Water / Field / Confidence), active lens
  becomes a gold chip with ✕, and each lens opens one small card: heat, rain, frost, water balance (thin bars +
  groundwater sparkline), water-stress ranking, erosion + storm replay (jumps the clock to Aug 2033 and plays),
  bare-field windows, uncertainty, where to soil-test.
- **Projected condition pills** in Future mode (rain, soil moisture, heat days, frost-free days, each with the
  change vs 2026); clicking a pill opens its lens.
- **What-if** card: rainfall −15…+15 %, temperature +0…+3 °C sliders (thin track, gold only on the changed part),
  sensitivity strip per strategy, live count-ups everywhere; pill turns gold while active.
- **Strategy picker + review flags + Soil health panel** (`SoilHealth.tsx`): depth profile (2026 dashed vs now),
  topsoil OM, nitrogen in / fixed / out, fertilizer saved with p10–p90, soak-in vs runoff bar, pest pressure.
- **Compare strategies** (`Compare.tsx`): three panes on one clock, leaderboard that re-sorts live, per-strategy
  score (basis "relative"), water vs quota bar (muted red + small shake when over), operational fit bars, review
  drawer with plain-language flags, "Go to …" deep links back into Future mode at the right date, and the
  "supports, and does not replace, local agronomic expertise" line.
- **Map effects** (`MapEffects.tsx`): warm tint that scales with heat days, heat shimmer, rain streaks, frost
  tint, 9 km uncertainty grid. All `pointer-events: none`, with a still under reduced motion.
- **Data** (`lib/farm-future/`): `fixtures.ts` (synthetic, deterministic), `model.ts` (pure read model: clock →
  dates, conditions, water balance, bands, scores, soil health; `applyWhatIf` lives in `conditionsAt` /
  `scoreWithWhatIf` / `waterBalanceAt`), `store.ts` (zustand `useFutureStore`).

## Honesty
- Every fixture-driven view shows **"Synthetic demo data"**; every figure has a basis label; absolute estimates
  (soil loss, fertilizer saved) show a p10–p90 range; strategy scores are labelled **relative**.
- The groundwater line is labelled "stand-in for GRACE" with basis **assumed** (it is not a GRACE reading).

## Files
- New: `apps/web/lib/farm-future/{fixtures,model,store,model.test}.ts`,
  `apps/web/components/farm-future/{ui.tsx,styles.ts,Controls.tsx,FutureTimeline.tsx,LensCards.tsx,MapEffects.tsx,SoilHealth.tsx,Compare.tsx,FutureLayer.tsx}`,
  `apps/web/e2e/farm-view/future.spec.ts`
- Changed: `apps/web/components/farm-view/FarmView.tsx` (rebased onto the P1 header-grid layout; mounts the mode switch, lens control, future pills,
  future timeline, map effects and FutureLayer; layer bar gets `zIndex.popover` so the Lenses menu sits above
  cards). Now mode is untouched.

## How to run
`pnpm dev` in `apps/web`, open `/#farm=agroscope-reckenholz`, pick **Future · 10 yr** under the farm name.

## Checks
- `pnpm typecheck`: passes. `pnpm lint` on touched files: clean (one pre-existing warning in `SimulationTab.tsx`).
- `pnpm test`: 47 files, 469 tests pass (11 new in `lib/farm-future/model.test.ts`).
- `e2e/farm-view/future.spec.ts`: 5/5 pass against `pnpm dev` (Chrome, 1440×900).
- `pnpm build`: not verifiable in the sandbox used for this change (Google Fonts unreachable); run it locally.

## Known gaps (next prompt must know)
- **Field drapes on the 3D map** are not drawn yet: anomaly colours per field, erosion outlines and flow lines,
  ranked "dries first" pins and soil-test rings on the ground. They need the explore farm's field polygons in
  Cesium, the same work as the farm-view Slice B vigor/moisture layers. The lens cards carry the per-field
  numbers until then. Deep links set the clock and `focusFieldId` in the store, ready for that layer.
- **Compare** uses one shared 3D scene with hairline panes; three live twins need multi-viewport support in the
  viewer track.
- **Not built**: 3D crop wilting/bleaching, frost crystals and cold-air mist, the first-entry intro fly-through
  (dive-film), and the globe pin badges (flame / drop / snowflake).
- All numbers are synthetic; replace `lib/farm-future/fixtures.ts` with real projections (climate model,
  SMAP, GRACE, strategy outputs) and keep the model.ts API.
