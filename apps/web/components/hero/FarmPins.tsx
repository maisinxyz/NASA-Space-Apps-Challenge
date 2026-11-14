// Per-farm pin artwork, one design per farm (Farm.pin). Flat or lightly shaded, all on the same 36 x 34 box and visual
// weight, with the ground point at the bottom centre. One colour for every farm (tier is shown in the popup and list, not
// on the pin): warm amber with a thin dark outline. Contrast, measured as WCAG ratios against sample backdrops: amber
// #ffc857 is 7.4 on deep ocean, 3.7 mid ocean, 3.3 green land, 13 on the night side; the #0b0d12 outline is 5.6 on light
// ocean, 4.4 on brown land, 7.2 on desert and 17 on cloud. Every backdrop gets at least 3:1 from one of the two.
// Samples and rationale: hive/pin-samples "By farm". Unknown ids are not here, so the caller falls back to the satin pin.
import { useId } from "react";

/** Box for every farm pin, px. Shared so the set has one visual weight. */
export const FARM_PIN_BOX = { w: 36, h: 34 } as const;

/** Brightens a touch on hover and focus; the same for every farm. */
const TONE = "[--col:#ffc857] group-hover:[--col:#ffd98a] group-focus-visible:[--col:#ffd98a]";

/** Fill plus a thin dark outline drawn outside the shape (paint-order stroke), so the pin reads on light and dark ground. */
const FILL = { fill: "var(--col)", stroke: "#0b0d12", strokeWidth: 1.5, strokeLinejoin: "round", paintOrder: "stroke" } as const;

type Art = (p: { id: string }) => React.ReactElement;

const Shadow = ({ x = 20, y = 30.5, rx, ry = 1.9 }: { x?: number; y?: number; rx: number; ry?: number }) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#000" opacity={0.45} />;

/** Oakville: Napa Valley vineyard. A flat grape bunch. */
const GrapeCluster: Art = () => (
  <g transform="translate(0 2.2)">
    <path d="M20 9.5V13" stroke="#0b0d12" strokeWidth={2.6} strokeLinecap="round" fill="none" /><path d="M20 9.5V13" stroke="var(--col)" strokeWidth={1.1} strokeLinecap="round" fill="none" />
    <path style={FILL} d="M20 11C22 8.8 25 8.6 26.5 9.4C25.6 11.6 22.8 12.4 20 11Z" />
    {[[15.5, 16], [20, 16], [24.5, 16], [17.7, 20.6], [22.3, 20.6], [20, 25.2]].map(([x, y]) => <circle key={`${x}-${y}`} style={FILL} cx={x} cy={y} r={2.6} />)}
  </g>
);

/** Lancaster: working barn-and-farmstead country. A gambrel barn, lit front, shaded side. */
const Barn: Art = () => (
  <>
    <Shadow rx={10.5} ry={2} />
    <path style={FILL} d="M10.5 29V19.5L13 14.5H21L23.5 19.5V29Z" />
    <path d="M10.5 29V19.5L13 14.5H21L23.5 19.5V29Z" fill="#fff" opacity={0.14} />
    <path style={FILL} d="M23.5 19.5L26 17V29H23.5Z" />
    <path d="M23.5 19.5L26 17V29H23.5Z" fill="#000" opacity={0.42} />
    <path d="M13 14.5H21L26 17H18Z" fill="#fff" opacity={0.28} />
    <path d="M14.7 29V21.6H19.3V29Z" fill="#0b0c0f" opacity={0.72} />
  </>
);

/** Cornell: dairy research farm (corn silage). Two domed silos shaded as cylinders. */
const SiloPair: Art = ({ id }) => (
  <>
    <Shadow rx={10} ry={2} />
    <path style={FILL} d="M10.5 29.5V13H19V29.5Z" />
    <path d="M10.5 29.5V13H19V29.5Z" fill={`url(#${id})`} />
    <path style={FILL} d="M10.5 13A4.25 3.6 0 0 1 19 13Z" />
    <path d="M10.5 13A4.25 3.6 0 0 1 19 13Z" fill="#fff" opacity={0.22} />
    <path style={FILL} d="M21 29.5V18.5H28.5V29.5Z" />
    <path d="M21 29.5V18.5H28.5V29.5Z" fill={`url(#${id})`} />
    <path style={FILL} d="M21 18.5A3.75 3.2 0 0 1 28.5 18.5Z" />
    <path d="M21 18.5A3.75 3.2 0 0 1 28.5 18.5Z" fill="#fff" opacity={0.22} />
    <path d="M10.5 19H19M10.5 24H19M21 24H28.5" stroke="#000" strokeWidth={0.6} opacity={0.35} />
  </>
);

/** Beltsville: USDA research centre. A 3 x 3 grid of trial plots at different values. */
const PlotGrid: Art = () => (
  <g transform="translate(0 2.1)">
    <Shadow y={29.5} rx={9} ry={1.7} />
    {[0.95, 0.45, 0.7, 0.35, 0.85, 0.5, 0.6, 0.9, 0.4].map((o, i) => <rect key={i} style={FILL} x={13.5 + (i % 3) * 5.1} y={13.5 + Math.floor(i / 3) * 5.1} width={4.2} height={4.2} rx={0.6} opacity={o} />)}
  </g>
);

const DESIGNS: Record<string, Art> = { "grape-cluster": GrapeCluster, barn: Barn, "silo-pair": SiloPair, "plot-grid": PlotGrid };

export const hasFarmPin = (design: string | undefined): design is string => !!design && design in DESIGNS;

export function FarmPin({ design, className = "", style }: { design: string; className?: string; style?: React.CSSProperties }) {
  const id = `fp${useId().replace(/:/g, "")}`;
  const Art = DESIGNS[design];
  return (
    <svg viewBox="6 6 28 26" width={FARM_PIN_BOX.w} height={FARM_PIN_BOX.h} className={`${TONE} transition-opacity group-active:opacity-80 ${className}`} style={{ overflow: "visible", ...style }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </linearGradient>
      </defs>
      <Art id={id} />
      {/* The exact spot: a small dot at the bottom centre of the box, where the farm is. */}
      <circle style={FILL} cx={20} cy={31} r={1.7} />
    </svg>
  );
}
