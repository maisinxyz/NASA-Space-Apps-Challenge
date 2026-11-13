"use client";
import { memo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BasisChip } from "@/components/ui/BasisChip";
import { MetricValue } from "@/components/ui/MetricValue";
import type { Storm } from "@/lib/api/types";

/** Rainfall per step against hours from storm start; the dashed line marks the replay time. */
function Hyetograph({ storm, timeMin }: { storm: Storm; timeMin: number }) {
  const { step_minutes, mm } = storm.hyetograph;
  const data = mm.map((v, i) => ({ h: (i * step_minutes) / 60, mm: v }));
  const peak = Math.max(...mm);
  return (
    <figure className="mt-3">
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="font-medium text-ink">Rainfall per {step_minutes} min</span>
        <span>(mm)</span>
        <BasisChip basis={storm.hyetograph.synthetic ? "assumed" : storm.weather_source.basis} />
      </figcaption>
      <div role="img" aria-label={`Hyetograph: ${mm.length} steps of ${step_minutes} minutes, peak ${peak.toLocaleString("en-US", { maximumFractionDigits: 2 })} mm per step.`} className="mt-1 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="h" type="number" domain={[0, (mm.length * step_minutes) / 60]} tick={{ fill: "var(--ink-muted)", fontSize: 11 }} unit=" h" stroke="var(--line)" />
            <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 11 }} stroke="var(--line)" />
            <Tooltip
              isAnimationActive={false}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", fontSize: 12 }}
              labelFormatter={(h) => `${h} h from storm start`}
              formatter={(v) => [`${v} mm`, "Rainfall"]}
            />
            <Bar dataKey="mm" fill="var(--accent)" isAnimationActive={false} />
            <ReferenceLine x={timeMin / 60} stroke="var(--ink)" strokeDasharray="4 3" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-ink-muted">Hours from storm start. Dashed line: replay time.</p>
    </figure>
  );
}

export const StormPicker = memo(function StormPicker({ storms, stormId, timeMin, onPick }: { storms: Storm[]; stormId: string | null; timeMin: number; onPick(id: string): void }) {
  const storm = storms.find((s) => s.id === stormId);
  return (
    <section aria-labelledby="storm-h">
      <h2 id="storm-h" className="text-sm font-semibold text-ink">
        1. Storm
      </h2>
      {storms.length === 0 && <p className="mt-1 text-sm text-ink-muted">No storms are available for this terrain.</p>}
      <div role="radiogroup" aria-labelledby="storm-h" className="mt-2 grid gap-1">
        {storms.map((s) => (
          <label key={s.id} className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-sm ${s.id === stormId ? "border-accent bg-surface-2" : "border-line"}`}>
            <input type="radio" name="storm" checked={s.id === stormId} onChange={() => onPick(s.id)} className="mt-1 accent-[var(--accent)]" />
            <span>
              <span className="block text-ink">{s.label}</span>
              <span className="block text-xs text-ink-muted">
                {s.start} to {s.end}
              </span>
            </span>
          </label>
        ))}
      </div>
      {storm && (
        <div className="mt-3 grid gap-1 text-sm">
          <MetricValue label="Total" value={storm.total_mm} unit="mm" basis={storm.weather_source.basis} />
          <MetricValue label="Wettest day" value={storm.peak_day_mm} unit="mm" basis={storm.weather_source.basis} />
          <MetricValue label="Soil wetness before" value={storm.antecedent_wetness} unit="fraction (0-1)" basis={storm.weather_source.basis} digits={2} />
          <p className="text-xs text-ink-muted">
            Source: {storm.weather_source.name}, grid about <MetricValue value={storm.weather_source.resolution_km} unit="km" basis={storm.weather_source.basis} digits={0} />
          </p>
          {storm.hyetograph.synthetic && (
            <p className="mt-1 rounded border border-dashed border-ink-muted px-2 py-1 text-xs text-ink">
              <b>Synthetic hourly profile:</b> daily totals were spread over hours with an assumed shape ({storm.hyetograph.profile}).
            </p>
          )}
          <Hyetograph storm={storm} timeMin={timeMin} />
        </div>
      )}
    </section>
  );
});
