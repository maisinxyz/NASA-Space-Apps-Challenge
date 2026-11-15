"use client";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { isMock } from "@/lib/api/client";
import type { FeatureTable, HazardCalendar, HazardCatalog } from "@/lib/rotation/draft-types";
import { getFeatures, getHazardCalendar, getHazards } from "@/lib/rotation/api";
import { useRotationStore } from "@/lib/rotation/store";

import { FeatureCharts } from "./FeatureCharts";
import { HazardTimeline } from "./HazardTimeline";
import { ScenarioControls } from "./ScenarioControls";

type Data = { features: FeatureTable; calendar: HazardCalendar; hazards: HazardCatalog };

/** F2-1 + F2-2 + F2-3 in one panel. `monthlyCover` (12 values, a rotation's cover_calendar) is optional and only adds bare-field bands. */
export function ClimatePanel({ siteId, monthlyCover }: { siteId: string; monthlyCover?: number[] }) {
  const scenario = useRotationStore((s) => s.rotScenario);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    Promise.all([getFeatures(siteId, scenario), getHazardCalendar(siteId, scenario), getHazards(siteId)]).then(
      ([features, calendar, hazards]) => live && setData({ features, calendar, hazards }),
      (e) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [siteId, scenario, nonce]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl text-ink">Climate and hazards</h3>
        {isMock && <Badge variant="mock" />}
      </div>
      <ScenarioControls />
      {error ? (
        <ErrorCard title="Could not load climate data" error={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !data ? (
        <Skeleton className="h-44 w-full" label="Loading climate data" />
      ) : (
        <>
          <HazardTimeline calendar={data.calendar} hazards={data.hazards} monthlyCover={monthlyCover} />
          <FeatureCharts table={data.features} />
        </>
      )}
    </div>
  );
}
