# Farm screen window system: change documentation

Date: 2026-11-15. Scope: the farm screen (`apps/web/components/farm-view/FarmView.tsx`) in Now, Future and Compare modes. Existing behaviour and data logic are unchanged.

## What changed for the user

1. **Shift-free time readout.** The year (or month, in 1 yr zoom), the "January 1 · year 3 of 10" label, the play button and the 10 yr / 1 yr toggle no longer move while you scrub the slider.
2. **Every panel is a window.** These can be dragged by the title bar and resized from all 4 edges and 4 corners: the farm sidebar, the timeline, the drawer (Conditions / Map tools / Field report / More / Compare rotations / Campus info), the Future cards (what-if, soil, forecast, lens, review), Ask Gus and the Rotation planner. Each has minimise, maximise/restore and close buttons. Double-clicking the title bar toggles maximise. Clicking or focusing a window brings it to the front.
3. **Dock.** A "Windows" pill at the top centre shows a chip for each minimised or hidden window (click to restore). It also has a menu that lists every window and a **Reset layout** item.
4. **Stays on screen.** Dragging or resizing past an edge rubber-bands, and on release the window springs back fully into view. Shrinking the browser refits every window and still respects minimum sizes.
5. **Responsive content.** Window bodies are CSS size containers (`container-name: fw`). The timeline and the 12-month outlook each have compact, regular and spacious tiers, and timeline tick labels thin out instead of overlapping.
6. **Layout is remembered.** Saved per browser in `localStorage` under `app.windowLayout.v1`, and restored before first paint. A new browser or cleared storage starts from the default layout.
7. **2D map chrome.** The scale bar, imagery caption and MapLibre attribution sit in a 40px strip along the bottom that default windows leave free, so they no longer collide with the timeline.

## Files

| File | What |
|---|---|
| `apps/web/lib/window/config.ts` | `WINDOW_CONFIG`: window ids, titles, min/max sizes (each value has a comment explaining it) and default layout, which stacks full-width below 760px |
| `apps/web/lib/window/geometry.ts` | Pure maths: clamp, rubber band, resize edges, fractions, ease-out-back |
| `apps/web/lib/window/store.ts` | `useWindowManager` zustand store: rects, minimise/maximise, open, z-order (the only place z-index is assigned), plus persistence with validation |
| `apps/web/components/window/Window.tsx` | `<Window>` frame, pointer and keyboard gestures, and `useWindowHost` (measures the screen and refits on resize, rotation or zoom) |
| `apps/web/components/window/Dock.tsx` | Dock, launcher menu and Reset layout |
| `apps/web/components/window/window-css.ts` | Window chrome CSS; neutralises the old map positioning of content inside windows |
| `apps/web/components/farm-view/FarmView.tsx` | Wraps each panel in `<Window>`; renders the dock |
| `apps/web/components/farm-view/desktop-workspace.ts` | Removed the old map-chrome position overrides |
| `apps/web/components/farm-future/FutureTimeline.tsx`, `styles.ts` | Fixed-column grid readout, tabular numerals, fixed-size boxes, size tiers, label thinning (`visibleLabelStep`) |
| `apps/web/components/farm-future/MonthlyOutlook.tsx` | Size tiers for the outlook card and horizon tabs |
| `apps/web/components/map2d/Map2D.tsx` | Scale bar, caption and attribution placed in the bottom strip |
| `apps/web/lib/window/*.test.ts` | 36 unit tests: geometry and persistence validation |
| `apps/web/e2e/farm-view/windows.spec.ts` | Browser checks: scrub with no shift, drag, recoil, resize limits, min/max, z-order, keyboard, persistence |

## Size limits (`WINDOW_CONFIG`)

The max for every window is the screen minus an 8px margin (the dock row is excluded vertically). On a screen smaller than a window's minimum, the minimum yields so the title bar always fits.

| Window | Min W × H | Why |
|---|---|---|
| Farm (sidebar) | 220 × 260 | Action buttons stay on one line; title, back link and three actions stay visible |
| Timeline | 320 × 220 | Compact tier with 40px touch targets, and year ticks thinned to every 2nd |
| Panel (drawer) | 280 × 200 | Condition pills two per row; observations keep two columns |
| Details (Future cards) | 300 × 200 | What-if sliders and sparklines keep label and value on one line |
| Ask Gus | 300 × 320 | About 36 characters per chat line; the composer fits |
| Rotation planner | 560 × 360 | Its crop-list and plan columns fit side by side |

## Keyboard

- Tab to a window's title bar, then:
  - Arrow keys move it 10px.
  - Shift + arrow keys resize it.
  - Enter maximises or restores it.
- Esc while dragging cancels the drag.
- The dock menu supports arrow-key navigation, and Esc closes it.
- Focus rings are visible. Windows have `role="dialog"` (non-modal) and are labelled by their title.

## How to run

- `cd apps/web && pnpm dev`, then open `http://localhost:3000/#farm=ubc-farm` and click **Future**.
- Unit tests: `pnpm exec vitest run lib/window`
- Browser checks (against a running dev server): `QA_BASE_URL=http://localhost:3000 pnpm exec playwright test -c e2e/farm-view/playwright.config.ts windows.spec.ts`

## Verification status

- Typecheck and lint are clean for the changed files.
- Unit tests: 36/36 pass. Existing farm-view, farm-future and map2d tests pass.
- Browser (Chromium, 1440×900):
  - Passes: zero-pixel readout shift across 120 monthly steps in 10 yr zoom and 60 steps in 1 yr zoom.
  - Passes: drag; recoil after a +3000px pull past the edges.
  - Passes: resize clamps to min.
  - Passes: minimise to the dock and restore to the same rect; maximise and restore; bring to front.
  - Passes: keyboard move, resize and maximise; layout persists across reload; corrupt storage falls back to defaults.
- **Not yet verified:** the last step of the persistence test, shrinking the viewport to 700×520, timed out reading the window's box. Whether a window can be stranded at that size still needs checking. Screen-reader output and touch devices were not tested.

## Known gaps

- MapLibre's own popovers inside the 2D map (map tools, analysis, plot popover) and the full-screen Compare view are not windows.
- Future cards keep their own heading and close button inside the "Details" window; the drawer's duplicate heading is hidden.
