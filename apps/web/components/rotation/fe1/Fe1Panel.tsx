"use client";
// Frontend 1 entry: priorities + constraints form, then analysis results. Mounted in ComparePanel.
import { ClimatePanel } from "@/components/rotation/fe2/ClimatePanel";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { normalizeWeights } from "@/lib/rotation/rank";
import { useRotationStore } from "@/lib/rotation/store";

import { ConstraintsForm } from "./ConstraintsForm";
import { PrioritiesForm } from "./PrioritiesForm";
import { RotationResults } from "./RotationResults";
import { useCropNames, useRotationAnalysis } from "./useRotationAnalysis";

export function Fe1Panel() {
  const { criteria_selected, weights } = useRotationStore((s) => s.farmerRequest);
  const cropNames = useCropNames();
  const { farmId, isMock, data, error, loading, retry } = useRotationAnalysis();
  const allZero = normalizeWeights(weights, criteria_selected) === null;
  return (
    <div className="grid gap-3">
      <PrioritiesForm allZero={allZero} />
      <ConstraintsForm cropNames={cropNames} />
      {/* Frontend 2 scenario sliders, hazard timeline and feature charts: same rotScenario state drives the results below. */}
      {farmId && <ClimatePanel siteId={farmId} monthlyCover={data?.rotations.find((r) => r.is_existing)?.cover_calendar.monthly_cover} />}
      {!farmId ? (
        <p className="text-xs text-ink-muted">Pick a farm to see rotation results.</p>
      ) : error ? (
        <ErrorCard title="Could not load rotation results" error={error} onRetry={retry} />
      ) : data ? (
        <div aria-busy={loading}>
          <RotationResults analysis={data} weights={weights} selected={criteria_selected} cropNames={cropNames} showMock={isMock} />
        </div>
      ) : (
        <p role="status" className="text-xs text-ink-muted">
          Loading rotation results...
        </p>
      )}
    </div>
  );
}
