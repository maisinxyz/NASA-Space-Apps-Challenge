// Per-farm pin marks, one per farm (Farm.pin). Each is a solid single-colour silhouette with generous negative space,
// the same 36 x 34 box and visual weight, ground point at the bottom centre (marked by a small dot). One colour for every
// farm (tier is shown in the popup and list, not on the pin): warm amber with a thin dark outline. Contrast, as WCAG
// ratios against sample backdrops: amber #ffc857 is 7.4 on deep ocean, 3.7 mid ocean, 3.3 green land, 13 on the night
// side; the #0b0d12 outline is 5.6 on light ocean, 4.4 on brown land, 7.2 on desert, 17 on cloud. Every backdrop gets at
// least 3:1 from one of the two.
// Samples and rationale: hive/pin-samples. Unknown ids are not here, so the caller falls back to the satin pin.

/** Box for every farm pin, px. Shared so the set has one visual weight. */
export const FARM_PIN_BOX = { w: 36, h: 34 } as const;

/** Brightens a touch on hover and focus; the same for every farm. */
const TONE = "[--col:#ffc857] group-hover:[--col:#ffd98a] group-focus-visible:[--col:#ffd98a]";

const INK = "#0b0d12";

/** Shapes carry no paint of their own: the outline pass and the fill pass both draw the same geometry. */
type Mark = () => React.ReactElement;

/** Oakville: Napa Valley vineyard. A bunch of six grapes on a short stem. */
const GrapeCluster: Mark = () => (
  <>
    {[[15.3, 17], [20, 17], [24.7, 17], [17.65, 21.6], [22.35, 21.6], [20, 26.2]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.7} />)}
    <rect x={19.2} y={11.4} width={1.6} height={3.4} rx={0.8} />
  </>
);

/** Cornell: dairy research farm (corn silage). Two domed silos of different height. */
const SiloPair: Mark = () => (
  <>
    <path d="M11 29V17A4 4 0 0 1 19 17V29Z" />
    <path d="M21 29V21.5A4 4 0 0 1 29 21.5V29Z" />
  </>
);

/** Beltsville: USDA research centre. A 2 x 2 grid of trial plots. */
const PlotGrid: Mark = () => (
  <>
    {[[12.5, 14], [20.5, 14], [12.5, 22], [20.5, 22]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={7} height={7} rx={1.4} />)}
  </>
);

const DESIGNS: Record<string, Mark> = { "grape-cluster": GrapeCluster, "silo-pair": SiloPair, "plot-grid": PlotGrid };

export const hasFarmPin = (design: string | undefined): design is string => !!design && design in DESIGNS;

export function FarmPin({ design, className = "", style }: { design: string; className?: string; style?: React.CSSProperties }) {
  const Shape = DESIGNS[design];
  return (
    <svg viewBox="6 6 28 26" width={FARM_PIN_BOX.w} height={FARM_PIN_BOX.h} className={`${TONE} transition-opacity group-active:opacity-80 ${className}`} style={{ overflow: "visible", ...style }} aria-hidden>
      {/* Outline pass first (1 px of ink around the union of the shapes), then the amber on top. */}
      <g fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round">
        <Shape />
        <circle cx={20} cy={31.2} r={1.2} />
      </g>
      <g fill="var(--col)">
        <Shape />
        {/* The exact spot: a small dot at the bottom centre of the box, where the farm is. */}
        <circle cx={20} cy={31.2} r={1.2} />
      </g>
    </svg>
  );
}
