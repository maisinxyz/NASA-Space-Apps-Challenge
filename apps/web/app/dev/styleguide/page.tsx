"use client";
// Dev-only reference for the design system. Not linked from the nav.
import type { ReactNode } from "react";

import { diffLegend, RISK_LEGEND, type ViewerLegend } from "@/components/viewer/meta";
import { Badge } from "@/components/ui/Badge";
import { BASIS_DESCRIPTIONS, BasisChip } from "@/components/ui/BasisChip";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Legend } from "@/components/ui/Legend";
import { MetricValue } from "@/components/ui/MetricValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { SupportBanner } from "@/components/ui/SupportBanner";
import { Tabs } from "@/components/ui/Tabs";
import { ApiError } from "@/lib/api/client";
import type { BasisOrRelative } from "@/lib/api/types";

// Sample legends for display only (shapes match the fixtures' layers.json).
const SLOPE: ViewerLegend = {
  name: "slope",
  title: "Slope",
  kind: "continuous",
  unit: "deg",
  basis: "derived",
  range: [0, 30],
  stops: [
    { t: 0, color: "#440154" },
    { t: 0.5, color: "#21918c" },
    { t: 1, color: "#fde725" },
  ],
};
const COVER: ViewerLegend = {
  name: "cover_class",
  title: "Ground cover",
  kind: "categorical",
  unit: "",
  basis: "derived",
  classes: [
    { value: 1, label: "vegetation", color: "#4d7c3a" },
    { value: 2, label: "bare soil", color: "#a0764a" },
    { value: 3, label: "water", color: "#3a6ea5" },
  ],
};
const DIFF = diffLegend({ a: "rot_forage", b: "rot_existing", quantity: "peak_water_depth", unit: "mm", max_abs_diff_mm: 12, mean_diff_mm: 1.5, changed_area_ha: 1.9, basis: "modeled" });

const SWATCHES = ["paper", "surface", "surface-2", "ink", "ink-muted", "line", "accent", "danger"];

function Sample({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  return <div className={`${dark ? "theme-dark" : ""} rounded-lg border border-line bg-paper p-5 text-ink`}>{children}</div>;
}

function Everything() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-3">
        {SWATCHES.map((s) => (
          <div key={s} className="text-xs">
            <div className="size-12 rounded border border-line" style={{ background: `var(--${s})` }} />
            <span className="font-mono">{s}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BASIS_DESCRIPTIONS) as BasisOrRelative[]).map((b) => (
          <BasisChip key={b} basis={b} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="pre-built" />
        <Badge variant="mock" />
        <Badge variant="illustrative" />
        <Badge variant="coarse" />
      </div>
      <div className="grid gap-1">
        <MetricValue label="Runoff volume" value={1234.5} unit="m³" basis="modeled" />
        <MetricValue label="Erosion index" value={42} unit="index" basis="relative" />
        <MetricValue label="Relief" value={22.1} unit="m" basis="derived" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Legend legend={SLOPE} />
        <Legend legend={COVER} />
        <Legend legend={RISK_LEGEND} />
        <Legend legend={DIFF} />
      </div>
      <Card>
        <p className="font-semibold">Card</p>
        <div className="mt-3 grid gap-2">
          <Skeleton className="h-4 w-2/3" label="Loading example" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
      <ErrorCard title="Could not load the sites" error={new ApiError({ code: "DATA_SOURCE_UNAVAILABLE", message: "Cannot reach the FieldTwin API.", hint: "Is the API running?", retryable: true }, 0)} onRetry={() => {}} />
      <Tabs
        label="Example tabs"
        items={[
          { id: "a", label: "Layers", content: <p>Layer panel content.</p> },
          { id: "b", label: "Field", content: <p>Field panel content.</p> },
        ]}
      />
      <SupportBanner />
      <p className="font-display text-2xl">Display serif · Aa</p>
      <p className="font-mono tabular-nums">Mono tabular 0123456789</p>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12">
      <h1 className="font-display text-3xl">Styleguide</h1>
      <h2 className="text-lg font-semibold">Light (content pages)</h2>
      <Sample>
        <Everything />
      </Sample>
      <h2 className="text-lg font-semibold">Dark panel (viewer pages): wrap in .theme-dark</h2>
      <Sample dark>
        <Everything />
      </Sample>
    </div>
  );
}
