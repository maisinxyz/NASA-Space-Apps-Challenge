"use client";
// Pointer readout. The viewer fires onProbe up to once per frame, so the value lives in its own tiny store:
// only this component re-renders, never the page or the canvas.
import { create } from "zustand";

import { MetricValue } from "@/components/ui/MetricValue";
import type { ProbeResult, ViewerLegend } from "@/components/viewer";
import type { Basis, TerrainPackage } from "@/lib/api/types";

const useProbe = create<{ p: ProbeResult | null }>()(() => ({ p: null }));
export const setProbe = (p: ProbeResult | null) => useProbe.setState({ p });

/** Elevation basis follows the terrain's elevation source; "assumed" when the terrain lists none. */
export const elevationBasis = (t: TerrainPackage): Basis => t.sources.find((s) => s.role === "elevation")?.basis ?? "assumed";

export function ProbeReadout({ terrain, legends }: { terrain: TerrainPackage; legends: ViewerLegend[] }) {
  const p = useProbe((s) => s.p);
  return (
    <section aria-labelledby="probe-h">
      <h2 id="probe-h" className="text-sm font-semibold text-ink">
        Point readout
      </h2>
      {!p ? (
        <p className="mt-1 text-sm text-ink-muted">Move the pointer over the terrain to read values at that point.</p>
      ) : (
        <div className="mt-2 grid gap-1 text-sm">
          {/* Position comes from the terrain georeference, hence "derived". */}
          <MetricValue label="Longitude" value={p.lon} unit="°" basis="derived" digits={5} />
          <MetricValue label="Latitude" value={p.lat} unit="°" basis="derived" digits={5} />
          <MetricValue label="Elevation" value={p.elevation_m} unit="m" basis={elevationBasis(terrain)} digits={1} />
          {Object.entries(p.layer ?? {}).map(([name, v]) => {
            const l = legends.find((x) => x.name === name);
            if (!l) return null;
            if (l.kind === "categorical") {
              const label = l.classes?.find((c) => c.value === v)?.label ?? `class ${v}`;
              return (
                <p key={name} className="text-ink">
                  <span className="text-ink-muted">{l.title}</span> {label}
                </p>
              );
            }
            return <MetricValue key={name} label={l.title} value={v} unit={l.unit} basis={l.basis} digits={2} />;
          })}
        </div>
      )}
    </section>
  );
}
