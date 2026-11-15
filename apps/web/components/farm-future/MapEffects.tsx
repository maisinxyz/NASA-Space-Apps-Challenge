"use client";
// Screen-level lens effects over the 3D map. pointer-events: none, aria-hidden, and a still under reduced motion.
// Field-polygon drapes (anomaly colours, erosion outlines, flow lines, soil-test pins on the ground) need the
// farm's field geometry in Cesium; they land with the farm-view map-layer slice (see docs/progress note).
/** The lens effects were driven by made-up numbers, so nothing is drawn until real data feeds them. */
export function MapEffects() {
  return null;
}

export const EFFECTS_CSS = `
@keyframes ff-shimmer { 0% { transform: translateY(0) } 50% { transform: translateY(-1px) } 100% { transform: translateY(0) } }
.ff-shimmer { backdrop-filter: blur(0.6px) saturate(1.05); -webkit-backdrop-filter: blur(0.6px) saturate(1.05); animation: ff-shimmer 1.6s ease-in-out infinite; mask-image: linear-gradient(transparent 20%, #000 55%, #000 100%); }
@keyframes ff-rain { from { background-position: 0 0 } to { background-position: -40px 220px } }
.ff-rain { background-image: repeating-linear-gradient(105deg, transparent 0 22px, rgba(242,235,221,0.10) 22px 23px); animation: ff-rain 0.7s linear infinite; }
@media (prefers-reduced-motion: reduce) { .ff-shimmer, .ff-rain { animation: none !important; } }
`;
