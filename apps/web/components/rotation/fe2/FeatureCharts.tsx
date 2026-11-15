import type { FeatureId, FeatureTable } from "@/lib/rotation/draft-types";

import { ChartFrame, SeriesChart, weekRows } from "./charts";

const CHARTS: { id: FeatureId; title: string; term?: string; color: string }[] = [
  { id: "soil_moisture_anomaly", title: "Soil-moisture anomaly", term: "soil_moisture_anomaly", color: "var(--basis-derived)" },
  { id: "water_balance_mm", title: "Water balance", term: "water_balance", color: "var(--accent)" },
  { id: "frost_prob", title: "Frost probability", term: "frost_risk", color: "var(--basis-modeled)" },
  { id: "heat_prob", title: "Heat probability", color: "var(--danger)" },
  { id: "extreme_rain_prob", title: "Extreme-rain probability", color: "var(--basis-derived)" },
];

/** F2-3. Shows only series the API returned; each has unit + basis chip. */
export function FeatureCharts({ table }: { table: FeatureTable }) {
  const shown = CHARTS.filter((c) => table.features[c.id]);
  return (
    <div className="grid gap-3">
      {table.quality.limited_data && (
        <p role="status" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          Limited data: no seeded satellite or soil data for this site (years available: {table.quality.years_available}). Treat these charts with caution.
        </p>
      )}
      {shown.length === 0 && <p className="text-sm text-ink-muted">No feature series were returned for this site.</p>}
      <div className="grid gap-3">
        {shown.map((c) => {
          const f = table.features[c.id]!;
          return (
            <ChartFrame key={c.id} title={c.title} term={c.term} unit={f.unit} basis={f.basis}>
              <SeriesChart data={weekRows(f.median)} name={c.title} unit={f.unit} color={c.color} />
            </ChartFrame>
          );
        })}
      </div>
      {table.caveats.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-ink-muted">
          {table.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
