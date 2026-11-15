"use client";
import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GlossaryTerm } from "./Glossary";
import { BasisChip } from "@/components/ui/BasisChip";
import type { BasisOrRelative } from "@/lib/api/types";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Approximate: week w (1-52) to month index 0-11. */
export const monthOfWeek = (w: number) => Math.min(11, Math.floor(((w - 1) * 12) / 52));
export const MONTH_TICKS = MONTHS.map((_, m) => Math.ceil((m * 52) / 12) + 1);
export const weekRows = (...series: (number[] | undefined)[]) => Array.from({ length: 52 }, (_, i) => ({ week: i + 1, ...Object.fromEntries(series.map((s, k) => [`s${k}`, s?.[i]])) }));

/** Consecutive runs of weeks as [from, to] bands. */
export function weekRuns(weeks: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const w of [...new Set(weeks)].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && w === last[1] + 1) last[1] = w;
    else out.push([w, w]);
  }
  return out;
}

/** Title, unit and basis are always shown, outside the SVG so they also reach screen readers and tests. */
/** `term`: optional glossary id; wraps the title in a tooltip. */
export function ChartFrame({ title, term, unit, basis, children }: { title: string; term?: string; unit: string; basis: BasisOrRelative; children?: ReactNode }) {
  return (
    <figure className="rounded-md border border-line p-3">
      <figcaption className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-semibold text-ink">{term ? <GlossaryTerm id={term}>{title}</GlossaryTerm> : title}</span>
        <span className="text-xs text-ink-muted">Unit: {unit}</span>
        <BasisChip basis={basis} />
      </figcaption>
      <div className="mt-2 h-44 w-full" role="img" aria-label={`${title}, 52 weeks, ${unit}`}>
        {children}
      </div>
    </figure>
  );
}

const axis = { stroke: "var(--ink-muted)", fontSize: 11 } as const;
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", fontSize: 12 } };
const xAxis = <XAxis dataKey="week" type="number" domain={[1, 52]} ticks={MONTH_TICKS} tickFormatter={(w: number) => MONTHS[monthOfWeek(w)]} /* ticks are each month's first week, so this reads Jan..Dec */ {...axis} />;

export function SeriesChart({ data, name, unit, color = "var(--accent)", domain }: { data: { week: number; s0?: number }[]; name: string; unit: string; color?: string; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        {xAxis}
        <YAxis width={36} domain={domain} {...axis} />
        <Tooltip {...tip} labelFormatter={(w) => `Week ${w}`} formatter={(v) => `${v} ${unit}`} />
        <Line type="monotone" dataKey="s0" name={name} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HazardChart({ data, vulnerable, bare }: { data: { week: number; s0?: number; s1?: number }[]; vulnerable: [number, number][]; bare: [number, number][] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        {vulnerable.map(([a, b]) => (
          <ReferenceArea key={`v${a}`} x1={a - 0.5} x2={b + 0.5} fill="var(--danger)" fillOpacity={0.12} stroke="var(--danger)" strokeDasharray="4 3" strokeOpacity={0.7} />
        ))}
        {bare.map(([a, b]) => (
          <ReferenceArea key={`b${a}`} x1={a - 0.5} x2={b + 0.5} fill="var(--ink-muted)" fillOpacity={0.15} stroke="none" />
        ))}
        {xAxis}
        <YAxis width={36} domain={[0, 1]} {...axis} />
        <Tooltip {...tip} labelFormatter={(w) => `Week ${w}`} formatter={(v) => `${v} (share of years)`} />
        <Area type="monotone" dataKey="s0" name="Wet-ground heavy rain" stroke="var(--basis-derived)" fill="var(--basis-derived)" fillOpacity={0.25} isAnimationActive={false} />
        <Area type="monotone" dataKey="s1" name="Dry spell" stroke="var(--basis-assumed)" fill="var(--basis-assumed)" fillOpacity={0.25} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
