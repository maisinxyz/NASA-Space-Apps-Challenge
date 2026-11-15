"use client";
// Screen-level lens effects over the 3D map. pointer-events: none, aria-hidden, and a still under reduced motion.
// Field-polygon drapes (anomaly colours, erosion outlines, flow lines, soil-test pins on the ground) need the
// farm's field geometry in Cesium; they land with the farm-view map-layer slice (see docs/progress note).
import { useReducedMotion } from "framer-motion";

import { conditionsAt } from "@/lib/farm-future/model";
import { useFutureStore } from "@/lib/farm-future/store";

export function MapEffects() {
  const lens = useFutureStore((s) => s.lens);
  const mode = useFutureStore((s) => s.mode);
  const t = useFutureStore((s) => s.t);
  const w = useFutureStore((s) => s.whatIf);
  const reduced = !!useReducedMotion();
  if (mode === "now") return null;
  const c = conditionsAt(t, w);
  // Warm tint grows with heat days: subtle at all times in Future mode, stronger under the Heat lens.
  const heat = Math.max(0, Math.min(1, (c.heatDays - 9) / 20));
  const tint = lens === "heat" ? 0.06 + heat * 0.12 : heat * 0.05;
  return (
    <div aria-hidden data-testid="map-effects" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 60% 60%, rgba(217,135,58,${tint.toFixed(3)}), rgba(217,135,58,${(tint * 0.4).toFixed(3)}) 70%)`, mixBlendMode: "multiply", transition: reduced ? "none" : "background 300ms" }} />
      {lens === "heat" && !reduced && <div className="ff-shimmer" style={{ position: "absolute", inset: 0 }} />}
      {lens === "frost" && <div style={{ position: "absolute", inset: 0, background: "rgba(191,211,230,0.10)", mixBlendMode: "screen" }} />}
      {lens === "uncertainty" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, bottom: 140, backgroundImage: "linear-gradient(rgba(242,235,221,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(242,235,221,0.16) 1px, transparent 1px)", backgroundSize: "96px 96px" }} />
      )}
      {lens === "rain" && !reduced && <div className="ff-rain" style={{ position: "absolute", inset: 0 }} />}
    </div>
  );
}

export const EFFECTS_CSS = `
@keyframes ff-shimmer { 0% { transform: translateY(0) } 50% { transform: translateY(-1px) } 100% { transform: translateY(0) } }
.ff-shimmer { backdrop-filter: blur(0.6px) saturate(1.05); -webkit-backdrop-filter: blur(0.6px) saturate(1.05); animation: ff-shimmer 1.6s ease-in-out infinite; mask-image: linear-gradient(transparent 20%, #000 55%, #000 100%); }
@keyframes ff-rain { from { background-position: 0 0 } to { background-position: -40px 220px } }
.ff-rain { background-image: repeating-linear-gradient(105deg, transparent 0 22px, rgba(242,235,221,0.10) 22px 23px); animation: ff-rain 0.7s linear infinite; }
@media (prefers-reduced-motion: reduce) { .ff-shimmer, .ff-rain { animation: none !important; } }
`;
