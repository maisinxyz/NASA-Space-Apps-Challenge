# s2-ui-polish — homepage look: space backdrop, bigger labelled pins, hero and popup polish

## What was built
- **Space backdrop** (`components/hero/HeroEarth.tsx`, `Starfield`): procedural, seeded (deterministic) starfield of 5,200 points with star colours and gentle twinkle, a third of them crowded into a tilted Milky Way band over a faint noise glow. No image file, no licence to track. Twinkle stops under reduced motion.
- **Pins** (`components/hero/FarmPins.tsx`): 40 × 50 px amber teardrop with a dark disc holding the farm's own mark (grape cluster / silo pair / plot grid), a drop shadow and a glowing ground dot. One colour for every farm, as before.
- **Pin labels** (`HeroEarth.tsx`): a name pill next to each pin head (short name = farm name up to the first comma or bracket; amber dot = digital twin, grey = explore only). A label shows only where it covers no other pin or label; the selected farm, then the hovered one, then nearer pins win. Pin spacing constants grew to match the bigger pin.
- **Landing hero** (`components/hero/RestingHero.tsx`): eyebrow pill with live dot ("FieldTwin · NASA Space Apps 2026"), gradient last headline line, glassier stat cards, filled primary CTA plus a "Data & methods" link, and a "Drag the Earth to explore" hint under the Earth. The status bar shows only the live coordinates.
- **Farm popup** (`components/hero/FarmPopup.tsx`): wider card, tier chip on the photo ("Digital twin" / "Explore only"), location with a pin icon, 2-line note, coordinates row with "Approximate" when `coordsVerified` is false, filled "Go to farm" button.
- **Bug fix** (`components/globe/GlobeHome.tsx`): the Cesium credit line overlapped the NASA imagery line in globe view (`display:flex !important` in CREDITS_CSS beat the inline `display:none`). It is now hidden with `visibility`.

## How to run
`pnpm dev` in `apps/web`, open http://localhost:3000, click "Explore the farms".

## Checks
- `pnpm typecheck`: passes. `pnpm test`: 37 files, 385 tests pass.
- `pnpm lint`: one error, which was already there before this work: `Pin3D.tsx` calls `useId` after an early return (rules-of-hooks). Not touched here.

## Known gaps
- The small-screen fallback (< 768 px farm list) still uses the CSS gradient background, not the starfield.
- In dense clusters some labels stay hidden until you rotate or zoom. Hovering still shows the full name and location.
