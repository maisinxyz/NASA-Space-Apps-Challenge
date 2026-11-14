# S1 hero: ORBIT layout, drag-to-centre map UI, title sweep, control gating

Branch `fe/S1-hero` (from `fe/S1-cesium-globe`). Date 2026-11-13. Parts 1, 2, 4, 5 of the task are done; Part 3 (new
2 s Agassiz dive film) was not started: the Higgsfield MCP is not connected in this session (see Known gaps).

## STEP 0 (coordination)
The landing page is FE-01, track FE-A (owner Westley, `Prompts.md`). The globe is FE-B (Vince). Tell Westley this
replaces the homepage hero.

## References (both opened in a real browser, 2026-11-13)
- Link 1, superdesign ORBIT: 96 px numbered sidebar; 5/12 info column with 64 px padding: eyebrow 12 px bold uppercase,
  0.4em tracking; heading Cabinet Grotesk 96 px, weights 700-900, uppercase, -0.02em, leading-none; body Satoshi light
  gray-400, relaxed; 2x2 glass stat cards (24 px padding, 16 px radius, 10 px uppercase labels, 24 px bold values);
  one pill action; planet right inside thin 800/600 px rings; 56 px status bar. Its three "Astronaut" avatar images
  and "+14 people" line are not used.
- Link 2, Clear Street globe (Awwwards element, video only): used for interaction feel only.

## Decisions (asked 2026-11-13)
- Copy: link 1's structure and type, FieldTwin's own copy (the Mars copy and invented figures would break the honesty
  rules). **Draft copy for sign-off** lives in `HERO_COPY` (`components/hero/RestingHero.tsx`): eyebrow "FieldTwin";
  headline "Farms — / from / orbit"; body "FieldTwin turns NASA Earth observations into a 3D model of a farm, so you
  can see when and where its soil is most exposed and compare crop rotations on the land itself."; action "Explore
  the farms"; status "Challenge: Field Shift" / "NASA Space Apps 2026". Stat values are computed (8 farms, 8 countries,
  twin "Agassiz", "1.4 × 1.4 km" from `SIM_AREA_LABEL`); the status bar shows real imagery state and live camera
  coordinates.
- Fonts: Cabinet Grotesk + Satoshi (Fontshare, ITF Free Font License v2.0). The licence allows self-hosting for our own
  site (clause 01) but forbids redistribution via a repository or public server (clause 02), so the files are **not
  committed**: `scripts/fetch-fonts.mjs` (run by predev/prebuild, or `pnpm fonts`) downloads each developer's own copy
  into `public/fonts/fontshare/` (git-ignored), unmodified. Missing files fall back to the existing fonts.
- Visor, HUD and cursor look-around removed; the icon cluster + waypoints became the map UI.
- Earth: kept the Cesium globe (real imagery, terrain, the dive and the twin depend on it) and improved it: the sun
  follows the camera from the upper left (lit face, soft terminator and rim on the right limb), lighting visible from
  space, existing colour grading. Lighting is now on from the start (no shader recompile when landing).

## What was built
- Resting hero (`RestingHero.tsx`): link 1 layout, sizes scaled by `--u = min(1px, 100vh/1022, 100vw/1440)` so it fits
  1024 x 640 up. Sidebar numbers pick a farm. Earth on the right (camera yaw, `screenOffsetX`), spinning slowly on its
  axis; no cursor effect.
- Hero state machine in `GlobeHome.tsx`: `hero → dragging → centred → ui → hero`. Press-and-drag (4 px): auto-rotation
  stops, text fades right side first, then the left column, headline last; when the text is gone the Earth glides to
  the centre (950 ms, ease in-out). Release: stays centred; map UI fades in 2 s later; 7 s with no pointer/key activity
  (and no open farm card): map UI out, Earth back right, text back in reverse order, rotation resumes. Timers are
  cancel-safe (cleared on new input and unmount). "Explore the farms" is the keyboard path into the map UI.
- Map UI: existing waypoints, popover, farm card and dive flow; accent changed to a soft light blue `#a3bfe9`.
- Arrival title (`Arrival.tsx`): entrance sweeps right to left (country letter by letter, then words below), each piece
  drifting slightly left; exit sweeps left to right. Timing in `tokens.arrivalTitle`. Reduced motion: crossfade.
- Gating: farm controls mount only in phase `explore`, set by `AnimatePresence onExitComplete` after the title's exit
  (no timer guess); they fade in (`tokens.farmControlsIn`).
- Fixes found while testing: the frustum-offset approach drew Cesium's sky-atmosphere ring in the wrong place (replaced
  by a camera yaw); waypoints did not appear until something re-rendered (render-on-demand): now rendered for a few
  frames after a visibility change; Cesium credit kept on one line in the status bar.

## Files touched (apps/web)
- New: `components/hero/RestingHero.tsx`, `scripts/fetch-fonts.mjs`.
- Changed: `components/globe/GlobeHome.tsx`, `components/globe/Globe.tsx`, `components/globe/types.ts` (optional props
  `screenOffsetX`, `autoRotate`, `allowZoom`), `components/hero/Arrival.tsx`, `components/hero/tokens.ts`,
  `components/hero/ControlCluster.tsx` (Settings: "Spin the Earth at rest"), `package.json` (predev/prebuild/fonts),
  `.gitignore`.
- Deleted (unused after the visor/HUD removal): `components/hero/HelmetVisor.tsx`, `components/hero/HudLayer.tsx`.
- Not touched: `DiveFilm.tsx`, the dive clips, `lib/farms.ts` data, other farms.

## Checks (run from a copy outside iCloud, see Known gaps)
- `pnpm typecheck`: pass. `pnpm lint`: pass (0 warnings). `pnpm test`: 21 files, 129 tests pass.
- `pnpm build`: pass (first attempt failed fetching Manrope from Google Fonts, a network error; the re-run passed);
  `check-build: OK`.
- Browser (Chrome, 1440x900, 1280x720, 1024x640): hero layout, drag, centring, map UI with waypoints, popover, card,
  dive, title sweep, controls after the title, back to globe, 7 s idle back to the hero: all seen. Gating probe: the
  back button did not exist while the title was on screen, with and without reduced motion.

## Behaviour list
- Pass: layout/type of link 1; avatars removed; no cursor effect; slow axis rotation; drag stops rotation; staggered
  text fade; glide to centre after the text is gone; stays centred; map UI at 2 s; idle 7 s restore in reverse order;
  timers reset on input; soft light-blue accent; existing waypoint/dive flow; title sweep in/out with tokens; reduced
  motion crossfade; controls only after the title exit; no random motion.
- Not verified: frame rate this round (not measured); touch input on a real device; the film-failure fallback in a
  browser (same phase path as the procedural dive, which was tested); exact stagger order frame by frame.
- Not done: Part 3 (video).

## Known gaps
- **Part 3 blocked:** Higgsfield MCP not connected. Connect it (`/mcp`), then: balance, `models_explore`, pick a model
  with native clips of 2 s or less, report model/duration/resolution/cost and wait for approval before generating.
- **Hero copy needs product-owner sign-off** (`HERO_COPY`).
- **iCloud:** the repo is in iCloud Desktop; about 28,900 files (mostly `node_modules`) had been offloaded, which stalls
  `next dev`, ESLint and the build. Checks ran from a copy in the temp folder with a fresh install. Move the repo out of
  `~/Desktop` or mark it "Keep Downloaded".
- iCloud conflict duplicates (`README 2.md`, `docs/progress/* 2.md`, …) exist in the working tree: delete before
  committing.
- Waypoints appear/disappear instantly with the map UI fade (Cesium billboards, no opacity tween).
