# S1 hero: dive film (Agassiz only)

## What was built
- When the Agassiz waypoint is clicked on the hero globe, a pre-rendered fly-through plays over the live Cesium dive
  (orbit, clouds, ocean, city towers, forest, farm) and dissolves into the live 3D farm. Every other farm, reduced
  motion, or a clip that is not buffered when the dive starts, keeps the existing procedural dive veil.
- The clip was generated with Higgsfield (model `minimax_h3_max`, 480p, 5 s, 7.5 credits) from two frames captured from
  this app at 16:9: the whole-Earth view centred on Agassiz (first frame) and the farm landing framing with the three
  fields drawn (last frame). So the clip starts and ends on what the globe draws underneath. It plays at its original
  speed and length (5.2 s, 832x480).
- Sequence: click, the globe swings Agassiz to the centre, the film dissolves in (300 ms) and plays while the real dive
  runs underneath, the film holds its last frame until the camera has landed and the fields are built, then dissolves
  (800 ms) into the live farm and the arrival title starts.
- A small caption, "Illustrative fly-in · AI-generated video", shows while the film plays (honesty rule: it is not
  imagery of the real route).
- A 1.5 s shortened cut was tried on 2026-11-13 and reverted at the user's request.
- Update 2026-11-13 (user request: click to interactive farm in 2 s, same journey, no speed-up):
  - `public/hero/agassiz-dive-2s.mp4` (new, 1.71 s, 0.8 MB): six stretches of the original at its original speed,
    cut with ffmpeg trim + concat (globe, clouds, ocean, city, trees, farm landing). The full clip stays in
    `public/hero/agassiz-dive.mp4` (unused). The Higgsfield CDN fallback source was dropped (it is the long clip).
  - The film starts on the click (120 ms fade in) instead of after the swing to centre, and dissolves out in 250 ms.
  - New Globe prop `quickDive`: under a film the camera skips the 5.4 s swing + fall and cuts to the farm framing
    150 ms after the click (terrain lookup capped at 0.5 s), so the farm tiles stream in while the film plays.
  - The farm panels now show during the arrival title (phase `title`), so the farm is usable as the film dissolves.
    The title moves left of the twin panel when it is open.
  - Arrival title: new "lock-on" transition (letters pull into focus one by one, hairline draws, lines rise from a
    mask; exit blurs and lifts the letters in order). Plain opacity with reduced motion.

## Files touched
- `apps/web/components/hero/DiveFilm.tsx` (new): `DIVE_FILMS` registry and the `<DiveFilm />` overlay.
- `apps/web/components/globe/GlobeHome.tsx`: new `hold` phase, film state, mounts the film, veil only when no film runs.
- `apps/web/public/hero/agassiz-dive.mp4` (new): the clip, 3.4 MB.
- No change to `Globe.tsx`, `types.ts`, the contract, or any API.

## How to run
- `pnpm dev` in `apps/web`, open `/` on a screen at least 768 px wide, click the Agassiz waypoint.
- Add a film for another farm: generate a clip from that farm's two frames and add an entry to `DIVE_FILMS`.

## Checks
- `tsc --noEmit`: passes. ESLint and Vitest could not run in the sandbox (missing ESLint plugin, native binding): run `pnpm lint` and `pnpm test` locally.

## Known gaps
- 480p (832x480), scaled to full screen: soft compared with the live farm. A 720p+ render with both keyframes needs a
  paid Higgsfield plan or more credits (2.5 credits were left on the free plan after this clip).
- The first frame assumes the default whole-Earth height. If the user has zoomed the globe a lot before clicking, the
  300 ms dissolve into the film shows a size jump.
- Screens narrower than 16:9 crop the clip's sides (object-cover), so the last frame is slightly larger than the live
  farm there; at 16:9 and wider it lines up.
- The second source in `DIVE_FILMS` is the Higgsfield CDN copy, used only if the local file is missing
  (`TODO(verify)`: how long Higgsfield keeps it is unknown).
- The arrival title still uses Syncopate Bold (unchanged).
