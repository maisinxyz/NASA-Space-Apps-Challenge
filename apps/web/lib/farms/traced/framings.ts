// Farm-view start framings for the explore-only farms, set in /dev/trace on Google Photorealistic 3D Tiles (2026-11-13).
// The framing target must lie inside the farm's camera box (simBbox, else a box inscribed in Farm.radiusM): the
// renderer clamps it into the box otherwise (clamp.ts startFraming).
import type { Farm } from "@/components/globe/types";

type Framing = NonNullable<Farm["framing"]>;

/** Oakville Grade area, Napa: vineyard blocks, oak woodland and ponds, looking WNW toward the hillside vineyards. */
export const OAKVILLE_FRAMING: Framing = { lon: -122.412502, lat: 38.420301, rangeM: 500, pitchDeg: -30, headingDeg: 300 };
