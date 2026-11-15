import { useId } from "react";

// Farm pins: one slim, quiet map marker for every farm (Farm.pin ids are kept), the same 40 x 50 box, ground point at the
// bottom centre (the tip). Tier is shown in the popup and list, not on the pin. A hairline edge and a soft shadow keep
// it readable on any backdrop. Unknown ids are not here, so the caller falls back to the satin pin.

/** Box for every farm pin, px. Shared so the set has one visual weight. The ground point is the bottom centre. */
export const FARM_PIN_BOX = { w: 40, h: 50 } as const;

/** Lifts a touch on hover and focus; the same for every farm. */
const TONE = "[--col:#d9443c] group-hover:[--col:#e85a50] group-focus-visible:[--col:#e85a50]";

/** Farm pin ids (Farm.pin). The pin itself is the same for every farm; the id stays so farms keep a known design. */
const DESIGNS = new Set(["grape-cluster", "silo-pair", "plot-grid"]);

/** Restrained motion: a short lift on hover/focus, no idle animation. Off under reduced motion. */
const PIN_CSS = `
.ft-pin-body { transform-box: view-box; transform-origin: 20px 47px; transition: transform 0.18s ease-out; }
.group:hover .ft-pin-body, .group:focus-visible .ft-pin-body { transform: translateY(-2px); }
@media (prefers-reduced-motion: reduce) { .ft-pin-body { transition: none } }
`;

export const hasFarmPin = (design: string | undefined): design is string => !!design && DESIGNS.has(design);

/**
 * A slim map marker: a red teardrop with a soft top-to-bottom shade, a hairline edge, a white centre dot and a small
 * contact shadow under the tip. `design` is accepted for the known ids; the artwork is the same for all.
 */
export function FarmPin({ className = "", style }: { design: string; className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const body = "M20 47 C20 47 10.5 31 10.5 18 A9.5 9.5 0 0 1 29.5 18 C29.5 31 20 47 20 47 Z";
  return (
    <svg viewBox="0 0 40 50" width={FARM_PIN_BOX.w} height={FARM_PIN_BOX.h} className={`${TONE} transition-opacity group-active:opacity-85 ${className}`} style={{ overflow: "visible", ...style }} aria-hidden>
      <style>{PIN_CSS}</style>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {/* Contact shadow under the tip (squashed toward the limb by --f). */}
      <ellipse cx={20} cy={47.5} rx={4.5} ry={1.4} fill="#000" fillOpacity={0.35} style={{ transformBox: "fill-box", transformOrigin: "center", transform: "scaleY(calc(0.35 + 0.65 * var(--f, 1)))" }} />
      <g className="ft-pin-body">
        <path d={body} fill="var(--col)" stroke="#000" strokeOpacity={0.35} strokeWidth={0.8} strokeLinejoin="round" style={{ filter: "drop-shadow(0 1.5px 2px rgba(0,0,0,0.45))" }} />
        <path d={body} fill={`url(#${id}s)`} />
        <circle cx={20} cy={18} r={3.6} fill="#fff" />
      </g>
    </svg>
  );
}
