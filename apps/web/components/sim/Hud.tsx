import { MetricValue } from "@/components/ui/MetricValue";
import type { BasisOrRelative, Metrics } from "@/lib/api/types";

type Row = { label: string; unit: string; get(m: Metrics): number; basis(m: Metrics): BasisOrRelative; digits: number };

const ROWS: Row[] = [
  { label: "Runoff volume", unit: "m³", get: (m) => m.runoff_volume_m3, basis: (m) => m.basis.runoff, digits: 0 },
  { label: "Mean runoff depth", unit: "mm", get: (m) => m.runoff_depth_mm_mean, basis: (m) => m.basis.runoff, digits: 1 },
  { label: "Ponded area at peak", unit: "ha", get: (m) => m.ponded_area_ha, basis: (m) => m.basis.ponding, digits: 2 },
  { label: "Peak ponded depth", unit: "cm", get: (m) => m.ponded_peak_depth_cm, basis: (m) => m.basis.ponding, digits: 1 },
  { label: "Erosion index (relative)", unit: "index 0-100", get: (m) => m.erosion_index_mean, basis: (m) => m.basis.erosion_index, digits: 1 },
  { label: "High erosion share", unit: "% of area", get: (m) => m.erosion_high_share_pct, basis: (m) => m.basis.erosion_index, digits: 1 },
  // Metrics.basis has no entry for bare days; they come from the rotation's cover calendar, hence "derived".
  { label: "Bare soil", unit: "days/year", get: (m) => m.bare_days_per_year, basis: () => "derived", digits: 0 },
];

/** B relative to A, in words and signed percent. */
function Change({ a, b }: { a: number; b: number }) {
  if (a === 0) return <span className="text-xs text-ink-muted">{b === 0 ? "same" : "A is 0, no ratio"}</span>;
  const pct = ((b - a) / Math.abs(a)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-ink-muted">about the same</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1">
      <span aria-hidden className="text-ink">{pct < 0 ? "▼" : "▲"}</span>
      <MetricValue value={Math.abs(pct)} unit={pct < 0 ? "% less" : "% more"} basis="relative" digits={0} />
    </span>
  );
}

/** A vs B under the same storm. Comparison only: these are model outputs, not predictions. */
export function Hud({ a, b, nameA, nameB }: { a: Metrics | null; b: Metrics | null; nameA: string; nameB: string | null }) {
  return (
    <section aria-labelledby="hud-h">
      <h2 id="hud-h" className="text-sm font-semibold text-ink">
        A vs B under the same storm
      </h2>
      <p className="mt-1 text-xs text-ink-muted">Relative comparison between rotations from the same model run. Not a prediction of what will happen on this land.</p>
      <table className="mt-2 w-full text-left text-sm">
        <thead className="text-xs text-ink-muted">
          <tr>
            <th scope="col" className="py-1 font-normal">
              Measure
            </th>
            <th scope="col" className="py-1 font-normal">
              <b className="text-ink">A</b> {nameA}
            </th>
            {nameB && (
              <>
                <th scope="col" className="py-1 font-normal">
                  <b className="text-ink">B</b> {nameB}
                </th>
                <th scope="col" className="py-1 font-normal">
                  B vs A
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label} className="border-t border-line align-top">
              <th scope="row" className="py-1.5 pr-2 text-xs font-normal text-ink-muted">
                {r.label}
              </th>
              <td className="py-1.5 pr-2">{a ? <MetricValue value={r.get(a)} unit={r.unit} basis={r.basis(a)} digits={r.digits} /> : "–"}</td>
              {nameB && (
                <>
                  <td className="py-1.5 pr-2">{b ? <MetricValue value={r.get(b)} unit={r.unit} basis={r.basis(b)} digits={r.digits} /> : "–"}</td>
                  <td className="py-1.5">{a && b ? <Change a={r.get(a)} b={r.get(b)} /> : "–"}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
