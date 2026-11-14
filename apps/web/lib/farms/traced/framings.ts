// Farm-view start framings for the explore-only farms, set in /dev/trace on Google Photorealistic 3D Tiles (2026-11-13).
// The framing target must lie inside the farm's camera box (simBbox, else a box inscribed in Farm.radiusM): the
// renderer clamps it into the box otherwise (clamp.ts startFraming).
import type { Farm } from "@/components/globe/types";

type Framing = NonNullable<Farm["framing"]>;

/**
 * Mead NE: over the US-Ne1 centre-pivot field (AmeriFlux point 41.1651, -96.4766) so the whole pivot circle reads.
 * Proposed, not screenshotted at these exact values (the Mead check used 400 m / -30 deg at US-Ne3 and closer views).
 */
export const MEAD_FRAMING: Framing = { lon: -96.4766, lat: 41.1651, rangeM: 600, pitchDeg: -35, headingDeg: 0 };

/**
 * Farmland near Intercourse PA: strip-cropped fields and farmsteads ~900 m E / 600 m N of the village centre
 * (-76.1075, 40.0383), looking NNW. Private farmland: pair with minRangeM 250 (no closer views). The target is
 * ~1.1 km from the village point, so the farm's radiusM must be at least ~1300 m (box half-side = radius / sqrt 2).
 */
export const LANCASTER_FRAMING: Framing = { lon: -76.097011, lat: 40.043747, rangeM: 500, pitchDeg: -30, headingDeg: 330 };
export const LANCASTER_MIN_RANGE_M = 250;

/** Oakville Grade area, Napa: vineyard blocks, oak woodland and ponds, looking WNW toward the hillside vineyards. */
export const OAKVILLE_FRAMING: Framing = { lon: -122.412502, lat: 38.420301, rangeM: 500, pitchDeg: -30, headingDeg: 300 };
