"use client";
// Screen-level lens effects over the 3D map. pointer-events: none, aria-hidden, and a still under reduced motion.
// Field-polygon drapes (anomaly colours, erosion outlines, flow lines, soil-test pins on the ground) need the
// farm's field geometry in Cesium; they land with the farm-view map-layer slice (see docs/progress note).
import { useAppStore } from "@/lib/store";
import { isEventId } from "@/lib/farm-future/events";
import { resolveInputs } from "@/lib/twin/scenarios/clock";
import { composeFrame, scenarioById } from "@/lib/twin/scenarios/registry";
import { runSourceFor } from "@/lib/twin/scenarios/runSource";
import { farmById } from "@/lib/farms";

/** The lens effects were driven by made-up numbers, so nothing is drawn until real data feeds them. */
export function MapEffects() {
  return null;
}

/**
 * What-if weather event over the 2D map (the 3D globe draws its own sky). Reads the same sky evaluator as the 3D
 * weather engine, so rain, glare and frost follow the event clock.
 */
export function EventSky() {
  const farmId = useAppStore((s) => s.farmId);
  const id = useAppStore((s) => s.scenarioId);
  const progress = useAppStore((s) => s.scenarioProgress);
  const stored = useAppStore((s) => s.scenarioInputs);
  const mode = useAppStore((s) => s.twinMode);
  const def = scenarioById(id);
  if (!farmId || !def || !isEventId(def.id) || mode !== "simulate" || runSourceFor(farmById(farmId)) === "none") return null;
  const a = composeFrame({ scenarioId: def.id, farmId, progress, inputs: resolveInputs(def, stored[def.id]), rotationId: null, timeS: 0 }).atmosphere;
  const [r, g, b, k] = a.tint;
  const rain = Math.min(1, a.rainRateMmH / 8 + a.drizzle * 0.4);
  const dark = a.cloudCover * a.cloudDarkness * 0.45;
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }} data-testid="event-sky">
      <div style={{ position: "absolute", inset: 0, background: `rgba(${r * 255},${g * 255},${b * 255},${k})`, mixBlendMode: "multiply" }} />
      <div style={{ position: "absolute", inset: 0, background: `rgba(18,24,34,${dark})` }} />
      {a.frostSparkle > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(225,240,255,${0.35 * a.frostSparkle})` }} />}
      {a.heatShimmer > 0.05 && <div className="ff-shimmer" style={{ position: "absolute", inset: 0, opacity: a.heatShimmer }} />}
      {rain > 0.02 && <div className="ff-rain" style={{ position: "absolute", inset: 0, opacity: rain }} />}
      {rain > 0.02 && <div className="ff-rain" style={{ position: "absolute", inset: 0, opacity: rain * 0.7, backgroundSize: "37px 37px", animationDuration: "0.45s" }} />}
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
