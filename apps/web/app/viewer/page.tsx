"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Attribution } from "@/components/twin/Attribution";
import { FieldPanel } from "@/components/twin/FieldPanel";
import { InsightPanel, insightPins, visibleInsights } from "@/components/twin/InsightPanel";
import { LayerPanel } from "@/components/twin/LayerPanel";
import { ProbeReadout, setProbe } from "@/components/twin/ProbeReadout";
import { Badge } from "@/components/ui/Badge";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { VIEWPORT_H, ViewerStage } from "@/components/ViewerStage";
import { buildLayerLegends, type TwinViewerHandle } from "@/components/viewer/meta";
import { isMock } from "@/lib/api/client";
import { useAppStore } from "@/lib/store";
import { TOUR } from "@/lib/tour";
import { useSiteData, useTerrainId } from "@/lib/useSiteData";

function ViewerPage() {
  const { terrainId, error: idError, retry: retryId } = useTerrainId();
  const data = useSiteData(terrainId);
  const viewerRef = useRef<TwinViewerHandle>(null);
  const { layers, selectedFieldId, tourStep } = useAppStore();
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const ok = data.kind === "ok" ? data.data : null;

  // Contract layers only here: the risk layer needs a simulation (see /simulate).
  const legends = useMemo(() => (ok ? buildLayerLegends(ok.catalog) : []), [ok]);
  const insights = useMemo(() => (ok && Array.isArray(ok.insights) ? visibleInsights(ok.insights, null) : []), [ok]);
  const pins = useMemo(() => insightPins(insights, activeInsight), [insights, activeInsight]);

  // Tour beat 3 needs a field selected; pick the first one if nobody has.
  const fields = ok?.fields;
  useEffect(() => {
    if (tourStep !== null && TOUR[tourStep]?.beat === 3 && !useAppStore.getState().selectedFieldId && fields?.[0]) useAppStore.setState({ selectedFieldId: fields[0].properties.id });
  }, [tourStep, fields]);

  if (idError) return <Centered><ErrorCard title="Could not choose a site" error={idError} onRetry={retryId} /></Centered>;
  if (data.kind === "error") return <Centered><ErrorCard title="Could not load this terrain" error={data.error} onRetry={data.retry}><Link href="/explore" className="rounded-md border border-line px-3 py-1.5 text-sm">Choose another site</Link></ErrorCard></Centered>;

  return (
    <div className={`theme-dark grid bg-paper text-ink lg:grid-cols-[20rem_1fr_19rem] ${VIEWPORT_H}`}>
      <aside aria-label="Site, layers and fields" className="grid min-w-0 content-start gap-5 overflow-x-hidden overflow-y-auto border-r border-line p-4">
        {ok ? (
          <>
            <div>
              <h1 className="font-display text-2xl text-ink">{ok.site?.name ?? ok.terrain.name}</h1>
              <div className="mt-1 flex flex-wrap gap-2">
                {ok.site?.pre_built && <Badge variant="pre-built" />}
                {isMock && <Badge variant="mock" />}
              </div>
            </div>
            <LayerPanel legends={legends} />
            <FieldPanel terrain={ok.terrain} catalog={ok.catalog} fields={ok.fields} viewerRef={viewerRef} />
            <ProbeReadout terrain={ok.terrain} legends={legends} />
          </>
        ) : (
          <Skeleton className="h-64 w-full" label="Loading site data" />
        )}
      </aside>

      <div className="relative min-h-[24rem]">
        {ok ? (
          <ViewerStage
            viewerRef={viewerRef}
            terrain={ok.terrain}
            fields={ok.fields}
            layers={layers.filter((l) => l !== "risk")}
            selectedFieldId={selectedFieldId}
            mode="single"
            rotationIds={[""]} // no simulation on this page; the viewer skips empty ids
            timeMin={0}
            showDiff={false}
            onFieldSelect={(id) => useAppStore.setState({ selectedFieldId: id })}
            onProbe={setProbe}
            pins={pins}
            onPinSelect={setActiveInsight}
          />
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </div>

      <aside aria-label="Insights and next steps" className="grid min-w-0 content-start gap-5 overflow-x-hidden overflow-y-auto border-l border-line p-4">
        {ok ? (
          <>
            <InsightPanel insights={insights} hiddenCount={0} activeId={activeInsight} onSelect={setActiveInsight} error={Array.isArray(ok.insights) ? undefined : ok.insights.error} />
            <Link href="/simulate" className="rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink hover:opacity-90">
              Replay a storm on this land →
            </Link>
            <Attribution terrain={ok.terrain} site={ok.site} />
          </>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </aside>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-16">{children}</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" label="Loading the viewer" />}>
      <ViewerPage />
    </Suspense>
  );
}
