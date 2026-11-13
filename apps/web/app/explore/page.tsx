"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { MetricValue } from "@/components/ui/MetricValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { assetUrl, getSites, isMock } from "@/lib/api/client";
import type { Site } from "@/lib/api/types";

type State = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; sites: Site[] };

function SiteCard({ site }: { site: Site }) {
  return (
    <Card className="flex flex-col p-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- API-served asset path; next/image would need remote host config */}
      <img src={assetUrl(site.preview_image)} alt={`Preview of ${site.name}`} className="aspect-[16/9] w-full rounded-t-lg border-b border-line object-cover" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{site.region}</p>
          {site.pre_built && <Badge variant="pre-built" />}
        </div>
        <h2 className="mt-1 font-display text-xl text-ink">{site.name}</h2>
        <p className="mt-2 text-sm text-ink-muted">{site.summary}</p>
        {/* relief_m and area_ha have no basis in the contract; both come from the elevation grid, so "derived". */}
        <div className="mt-4 grid gap-1 text-sm">
          <MetricValue label="Relief" value={site.relief_m} unit="m" basis="derived" />
          <MetricValue label="Area" value={site.area_ha} unit="ha" basis="derived" />
        </div>
        <ul className="mt-4 text-xs text-ink-muted">
          {site.attribution.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <Link href={`/viewer?site=${encodeURIComponent(site.id)}&terrain=${encodeURIComponent(site.terrain_id)}`} className="mt-5 self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90">
          Open in viewer<span className="sr-only">: {site.name}</span>
        </Link>
      </div>
    </Card>
  );
}

export default function ExplorePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const load = useCallback(() => {
    setState({ kind: "loading" });
    getSites().then(
      (sites) => setState({ kind: "ok", sites }),
      (error) => setState({ kind: "error", error }),
    );
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-ink">Choose a site</h1>
        {isMock && <Badge variant="mock" />}
      </div>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Pre-built sites use open elevation data prepared ahead of time. To model other land,{" "}
        <Link href="/scan" className="text-accent underline underline-offset-2">
          run a Land Scan
        </Link>
        .
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {state.kind === "loading" &&
          [0, 1, 2].map((i) => (
            <Card key={i} className="grid gap-3">
              <Skeleton className="aspect-[16/9] w-full" label={i === 0 ? "Loading sites" : undefined} />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        {state.kind === "error" && (
          <div className="md:col-span-2 lg:col-span-3">
            <ErrorCard title="Could not load the sites" error={state.error} onRetry={load} />
          </div>
        )}
        {state.kind === "ok" && state.sites.length === 0 && <p className="text-ink-muted">No sites are available yet. You can still run a Land Scan.</p>}
        {state.kind === "ok" && state.sites.map((s) => <SiteCard key={s.id} site={s} />)}
      </div>
    </div>
  );
}
