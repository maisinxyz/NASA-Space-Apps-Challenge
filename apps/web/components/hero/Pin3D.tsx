// A sleek map pin with real volume and no ornament: a slim teardrop in satin red, lit softly from the upper left (one
// broad highlight, one dark falloff, no outline, no gloss spot), a black dot set into the head, and a soft contact
// shadow under the tip. The tip is the bottom-centre of the box, so put that point on the spot. `--f` (0..1, set by the
// Earth every frame) squashes the contact shadow as the pin nears the limb, as foreshortening would.
import { useId } from "react";

/** Width : height of the artwork. */
export const PIN_ASPECT = 20 / 30;

/** Muted satin tones: [light, mid, dark]. Full-twin farms are a dusty terracotta, explore-only farms a quiet slate. */
const TONES = {
  twin: ["#d98a7c", "#b4574c", "#6a2f2a"],
  explore: ["#8fa6c4", "#627b9e", "#34445c"],
} as const;

export function Pin3D({ width, height, className = "", style, tone = "twin" }: { width: number; height: number; className?: string; style?: React.CSSProperties; tone?: keyof typeof TONES }) {
  const [c0, c1, c2] = TONES[tone];
  const id = useId().replace(/:/g, "");
  const body = "M10 29 C10 29 2 17.2 2 9.8 A8 8 0 0 1 18 9.8 C18 17.2 10 29 10 29 Z";
  return (
    <svg viewBox="0 0 20 30" width={width} height={height} className={className} style={{ overflow: "visible", ...style }} aria-hidden>
      <defs>
        {/* Satin body: light from the upper left, deep falloff to the lower right. */}
        <linearGradient id={`${id}b`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={c0} />
          <stop offset="0.45" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        {/* One broad soft highlight, not a spot. */}
        <radialGradient id={`${id}h`} cx="0.3" cy="0.25" r="0.55">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Rim shade on the far side gives the head roundness. */}
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={`${id}d`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0.7" stopColor="#0b0c0f" />
          <stop offset="1" stopColor="#1c1f26" />
        </radialGradient>
        <radialGradient id={`${id}s`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="10" cy="29" rx="6" ry="1.8" fill={`url(#${id}s)`} style={{ transformBox: "fill-box", transformOrigin: "center", transform: "scaleY(calc(0.3 + 0.7 * var(--f, 1)))" }} />
      <path d={body} fill={`url(#${id}b)`} />
      <path d={body} fill={`url(#${id}r)`} />
      <path d={body} fill={`url(#${id}h)`} />
      {/* The dot: a soft recess (slightly darker ring), then the black. */}
      <circle cx="10" cy="9.8" r="3.6" fill="#000" fillOpacity="0.3" />
      <circle cx="10" cy="9.8" r="2.8" fill={`url(#${id}d)`} />
    </svg>
  );
}
