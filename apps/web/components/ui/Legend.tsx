import type { ViewerLegend } from "@/components/viewer";

import { BasisChip } from "./BasisChip";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Legend for a viewer layer: gradient (continuous/diverging) or swatches (categorical), always with unit and basis. */
export function Legend({ legend }: { legend: ViewerLegend }) {
  const { title, kind, unit, basis, range, stops, classes, pattern, note } = legend;
  const gradient = stops?.length ? `linear-gradient(to right, ${stops.map((s) => `${s.color} ${s.t * 100}%`).join(", ")})` : undefined;

  return (
    <figure className="text-sm">
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-ink">{title}</span>
        <span className="font-mono text-xs text-ink-muted">{unit ? `(${unit})` : "(categories, no unit)"}</span>
        <BasisChip basis={basis} />
      </figcaption>

      {kind !== "categorical" && gradient && range && (
        <div className="mt-2">
          <div aria-hidden className="h-2.5 rounded-sm border border-line" style={{ background: gradient }} />
          <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-ink-muted">
            <span>
              {fmt(range[0])} {unit}
            </span>
            {kind === "diverging" && <span>0 {unit}</span>}
            <span>
              {fmt(range[1])} {unit}
            </span>
          </div>
        </div>
      )}

      {kind === "categorical" && classes && (
        <ul className="mt-2 grid gap-1">
          {classes.map((c) => (
            <li key={c.value} className="flex items-center gap-2">
              <span aria-hidden className="size-3 shrink-0 rounded-sm border border-line" style={{ background: c.color }} />
              <span className="text-ink">{c.label}</span>
            </li>
          ))}
        </ul>
      )}

      {pattern && <p className="mt-2 text-xs text-ink">Pattern: {pattern}</p>}
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </figure>
  );
}
