# S2-W: sky and weather engine

Every sky effect is an **illustrative mood effect** ("Illustrative weather effect" caption from the registry). Only the
rain streak density follows a data field (`rainRateMmH`, taken from the user's rain-rate input). Effects render only
when a scenario frame exists, i.e. only on `/dev/scenarios` with "Fixture run source" ticked. The real twin (run
source "none") passes `weather = null`, and the engine then removes its passes.

## What was built
- **Engine** (`components/viewer/cesium/weather/`): one depth-aware post-process pass (`shader.ts`, own GLSL). Each pixel
  is lifted into a local east/north/up frame anchored on the ground at the screen centre, so these sit in the world:
  - a **low broken cloud layer**, ray-marched as a slab of fbm puffs with gaps. Cesium 1.147 does ship
    `CloudCollection`/`CumulusCloud`, but the marched slab gives **cloud shadows** that match the puffs exactly, honours
    `scene.splitPosition` per pixel, and adds no draw calls.
    The slab is nominally 150-350 m but is kept ~50 m **below the camera** (`cloudSlab()`): the default farm camera sits
    ~200 m up, so a fixed 170-330 m slab put the camera inside the clouds and nothing showed.
  - drifting cloud shadows, overcast dimming, ground fog with wisps (thick below ~40 m), dust/heat haze with distance,
    frost sparkle (sparse twinkling glints stuck to the ground).
  - screen space: rain in 1-3 depth layers (each hidden behind closer geometry, slant from `windSlantDeg`, parallax from
    camera heading/pitch), drizzle, heat shimmer (UV wobble over mid-distance ground), colour grade from `tint`, soft
    lightning pulse (adds at most +0.16 brightness, never white).
  - **Sun/time of day** (`sunFor`): a stylised sun (east at 06:00, ~55 deg at noon, west at 18:00; not an ephemeris) sets
    exposure, warm dawn/dusk and moonlit night colour, and the shadow direction. It also sets `scene.light`, which is
    restored on clear. Google photogrammetry is unlit, so the grade carries the look there.
  - **Lightning limiter**: at most one flash start per 3 s; none under reduced motion. Reduced motion also turns off
    rain/drizzle streaks, shimmer, sparkle and cloud drift (static tint and clouds stay).
  - **Detail tiers** (`tierSettings`): high 6 cloud steps / 4 fbm octaves / 3 rain layers; medium 4/3/2; low 2/2/1 with
    no shimmer or sparkle. These become shader `#define`s, and the pass is rebuilt on a tier change.
  - **Auto step-down** (`createAutoTier`): smoothed fps < 45 for 2 s drops one tier (1 s grace after each rebuild). A new
    Detail choice resets it. Capped 0.1 s gaps (stalled or throttled window) are ignored. Shown in the perf readout as
    a second line under Globe's box: `sky tier low (auto-stepped from medium)  fx fps ..  cam .. m above anchor`
    (dev or `?perf=1`, backtick toggles).
  - Anchor: a depth pick at the screen centre, re-checked every second and replaced unless the camera is 15 m-3 km above
    it (picks made while tiles stream landed 800+ m off).
  - Dev hooks (dev or `?perf=1` only): `window.__ftWeather.bypass = true` skips the pass while keeping frames rendering;
    `window.__ftWeather.measure(n)` forces n renders, each followed by a 1 px readPixels, and returns the median ms
    (GPU-synchronous; automation browsers throttle rAF to ~1 fps).
  - Climate-shift A/B (stretch): `?sky=split` draws the **today** baseline left of `scene.splitPosition` (0.5 when unset)
    and the shifted sky right of it; `?sky=today` shows the baseline everywhere. A gated second copy of the pass does this.
- **Evaluators** (`lib/twin/scenarios/atmosphere/evaluators.ts`), pure and deterministic:
  storm (curve `stormCurve`, peaks at the peak-rain input at ~45 %, clouds lead/trail the rain, lightning near the
  peak), wet-spell (rainy days spread through each week, grey overcast, drizzle, fog from the wetness input, 08:30
  sun; `rainRateMmH` stays 0 because there is no rain-rate input), drought (haze/shimmer rise over the spell, hard 13:00
  sun), heat-wave (orange grade, haze and shimmer build to the peak day at ~65 % and ease 30 % after), frost (clock
  starts 18:00, so 48 h = two nights; sparkle builds over the hours below freezing before 06:00 and thaws within 1.5 h),
  climate-shift (live from the sliders over an **assumed** 30 mm/h reference storm; carries `baseline` = all sliders 0),
  compound (dry sun and haze, a hand-off over about ±2 % of progress at `compoundHandoff()`, then a storm curve to the
  peak input). Ground-only scenarios stay `CLEAR_SKY`.

## Files
`apps/web/components/viewer/cesium/weather/{index.ts, shader.ts, logic.ts, logic.test.ts}`,
`apps/web/lib/twin/scenarios/atmosphere/{index.ts, evaluators.ts, atmosphere.test.ts}`,
`apps/web/lib/twin/scenarios/registry.test.ts` (one line: the atmosphere stub assertion now applies only to
"No weather effect" scenarios; the test name says the owners fill it in).

## How to run
`corepack pnpm dev` in apps/web → `/dev/scenarios?perf=1` → tick "Fixture run source" → pick a card → scrub or Play.
`&sky=split` / `&sky=today` for the climate-shift A/B.

## Measured (Chrome 1920x1080 window, canvas 2132x1052 at dpr 1.5, Intel Arc 140T iGPU, Cornell, storm hour 11 of 24, camera 200 m up)
Method: `__ftWeather.measure(40)` (forced render + 1 px readPixels, median), three runs with the pass on and three with
`bypass`, median of the three; effect cost = on - off. Ground layers (S2-G) were active in both; the delta is the sky only.

| Surface | Detail | Frame ms, sky on | Frame ms, sky off | Sky pass cost | fps (sky on) |
|---|---|---|---|---|---|
| Google 3D | high | 41.2 | 35.0 | 6.2 ms | 24 |
| Google 3D | medium | 30.3 | 28.9 | **1.4 ms** | 33 |
| Google 3D | low | 15.9 | 15.7 | 0.2 ms | 63 |
| Terrain | high | 28.7 | 24.0 | 4.7 ms | 35 |
| Terrain | medium | 22.1 | 19.4 | **2.7 ms** | 45 |
| Terrain | low | 21.1 | 22.5 | ~0 (noise) | 47 |

Medium is within the ~3 ms budget on both surfaces. High is over it (it renders at a higher resolution scale too).
fps above comes from forced synchronous frames, so it is a lower bound; the scene without effects is already
below 60 fps at high/medium on this machine. The Playwright run (dpr 1) showed 58-66 fps on the perf readout with the
storm at medium. No 60 fps claim beyond that.

Screenshots (1920x1080, gitignored): `.playwright-mcp/s2w-{storm,wetspell,drought,heatwave,frost,compound,climate}-*.png`
(three time points each), `s2w-terrain-storm-45.png`, `s2w-storm-peak.png`, `s2w-frost-predawn.png` (medium, with
sparkle), `s2w-climate-split-early.png` / `-peak.png` (`?sky=split`). Some shots taken after drought ran at low, because
the auto step-down fired at a real 29-43 fps with ground layers on (those shots have no shimmer or sparkle).

## Known gaps
- No contract field for an A/B atmosphere: climate shift passes `baseline` as an extra property on the state
  (`AtmosphereWithBaseline`, produced and consumed only in my folders) and the split is a dev URL toggle.
  **Request for the project lead:** add an optional `compareWeather?: AtmosphereState | null` (right side of the split)
  to GlobeProps, so the product's Compare mode can drive it instead of `?sky=split`.
- Reduced motion is covered by unit tests (limiter and param zeroing) but was not checked in a browser.
- Low tier clouds (2 march steps) look grainy at the slab edges.
- The sun is stylised, not an ephemeris; its azimuth ignores latitude and season.
- The cloud slab moves with camera height (puff xy pattern stays put; shadows shift slightly while zooming).
- High tier costs ~5-6 ms on an iGPU; consider 5 steps / 3 octaves if high must fit the budget.

## For S2-G
- `stormCurve(p)` and `compoundHandoff(phase1Days)` are exported from `lib/twin/scenarios/atmosphere` so water/runoff
  can follow the same rain timing and hand-off.
- `registry.test.ts` "composeFrame(...) is a clear sky with no ground layers" now fails on the **ground** line
  (`expect(f.ground).toEqual([])`) since your evaluators landed; that line is yours to update. Lint has 2 warnings in
  `components/globe/GlobeHome.tsx` (unused `dev`, `tier`), not from S2-W.
- The sky pass runs after the scene render, so it grades and fogs your ground layers too (intended: one look).
