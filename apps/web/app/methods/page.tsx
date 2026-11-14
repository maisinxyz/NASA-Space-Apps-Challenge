"use client";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { BASIS_DESCRIPTIONS, BasisChip } from "@/components/ui/BasisChip";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { MetricValue } from "@/components/ui/MetricValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { getProvenance, getSites, isMock } from "@/lib/api/client";
import { FARMS } from "@/lib/farms";
import { TIER_LABEL } from "@/components/globe/FarmList";
import type { BasisOrRelative, Provenance } from "@/lib/api/types";

// Regex, not the literal marker, so this file itself never trips scripts/check-build.mjs.
const UNVERIFIED = /(TODO\(verify\))/;

/** Highlights unverified markers coming from the data so they cannot be missed. */
function Text({ children }: { children?: string }) {
  if (!children) return <span className="text-ink-muted">not given</span>;
  return (
    <>
      {children.split(UNVERIFIED).map((part, i) =>
        UNVERIFIED.test(part) ? (
          <mark key={i} className="rounded bg-mock px-1 font-mono text-xs text-black">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function SourceLink({ url }: { url?: string }) {
  if (!url) return <span className="text-ink-muted">no link given</span>;
  if (!/^https?:\/\//.test(url)) return <code className="font-mono text-xs break-all">{url}</code>;
  return (
    <a href={url} className="break-all text-accent underline underline-offset-2">
      {url}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-10">
      <h2 id={id} className="font-display text-2xl text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Sources of the farm twin (3D surface, field outlines, weather). Static: these are not in the per-terrain provenance
 * API. Unknown licence details say "not yet verified" on screen and carry a TODO(verify) here.
 */
const TWIN_SOURCES: { name: string; role: string; basis: BasisOrRelative; licence: string; attribution: string; url?: string; note: string }[] = [
  {
    name: "Google Photorealistic 3D Tiles, streamed through Cesium ion",
    role: "farm view, photoreal 3D",
    basis: "measured",
    // TODO(verify): exact Google Map Tiles API terms and the Cesium ion plan terms for this use; link to both.
    licence: "Google Map Tiles terms via a personal, non-commercial Cesium ion plan (not yet verified for commercial use). Not redistributed.",
    attribution: "Google logo and data attribution, shown on the map (bottom left) and never covered",
    note: "Photogrammetry mesh; capture date and accuracy on farmland not known. Trees and buildings are Google's, not ours.",
  },
  {
    name: "Bing Maps Aerial, streamed through Cesium ion",
    role: "farm view, terrain-only surface imagery",
    basis: "measured",
    // TODO(verify): Bing Maps imagery terms as provided through Cesium ion.
    licence: "Bing Maps terms via Cesium ion (not yet verified)",
    attribution: "Shown in the map credits",
    note: "Capture date not shown; imagery can be several years old.",
  },
  {
    name: "Cesium World Terrain",
    role: "farm view, ground elevation",
    basis: "measured",
    // TODO(verify): Cesium World Terrain licence/attribution text from the Cesium ion asset page.
    licence: "Cesium ion terms (not yet verified)",
    attribution: "Shown in the map credits",
    note: "Global elevation model; much coarser than a field survey. Height exaggeration defaults to 1× (true scale).",
  },
  {
    name: "OpenStreetMap",
    role: "field outlines (Beltsville), approximate Cornell pin",
    basis: "measured",
    licence: "Open Database License (ODbL) 1.0",
    attribution: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    note: "Volunteer-mapped. Beltsville field outlines: landuse ways 224922167, 224819517 and 224922168, downloaded 2026-11-13; community data, not USDA plot boundaries. Cornell pin: relation 6483196, not a farm boundary.",
  },
  {
    name: "FieldTwin traced field outlines",
    role: "field outlines (Cornell)",
    basis: "assumed",
    licence: "Made by the FieldTwin team",
    attribution: "FieldTwin",
    note: "Traced by eye on Google Photorealistic 3D imagery, 2026-11-13 (OpenStreetMap has no farmland outlines there). Approximate: they may not match the farm's managed fields. Field names and crops on both twins are made up by us, not farm records.",
  },
  {
    name: "NASA POWER",
    role: "weather for storm replay (coming)",
    basis: "measured",
    // TODO(verify): NASA POWER data-use / citation policy wording.
    licence: "NASA open data (citation wording not yet verified)",
    attribution: "NASA Langley Research Center POWER Project",
    url: "https://power.larc.nasa.gov/docs/services/api/",
    note: "Reanalysis grid of about 0.5° (roughly 55 km): one value covers the whole farm and much more.",
  },
];

type State = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; prov: Provenance };

export default function MethodsPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    setState({ kind: "loading" });
    getSites()
      .then((sites) => sites[0]?.terrain_id)
      .then((tid) => {
        if (!tid) throw new Error("No terrain is available to describe yet.");
        return getProvenance(tid);
      })
      .then(
        (prov) => setState({ kind: "ok", prov }),
        (error) => setState({ kind: "error", error }),
      );
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-ink">Data &amp; Methods</h1>
        {isMock && <Badge variant="mock" />}
      </div>
      <p className="mt-3 max-w-2xl text-lg text-ink-muted">
        What FieldTwin is built from, what it assumes, and where it stops being reliable. <strong className="text-ink">Every output is a relative comparison between options, not a prediction.</strong>
      </p>

      <Section id="reading" title="How to read the numbers">
        <p className="text-ink-muted">Every number shows its unit and one of five labels. The label says where the number comes from.</p>
        <ul className="mt-4 grid gap-2">
          {(Object.keys(BASIS_DESCRIPTIONS) as BasisOrRelative[]).map((b) => (
            <li key={b} className="flex flex-wrap items-baseline gap-2">
              <BasisChip basis={b} />
              <span className="text-ink">{BASIS_DESCRIPTIONS[b]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-3 text-sm text-ink-muted">
          <span>
            <Badge variant="pre-built" /> curated site prepared ahead of time
          </span>
          <span>
            <Badge variant="illustrative" /> made up for illustration, such as field outlines and crops on curated sites
          </span>
          <span>
            <Badge variant="coarse" /> low-resolution data, not fine-scale detail
          </span>
        </div>
      </Section>

      <Section id="datasets" title="Datasets">
        {state.kind === "loading" && (
          <div className="grid gap-3">
            <Skeleton className="h-24 w-full" label="Loading data sources" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {state.kind === "error" && <ErrorCard title="Could not load the data sources" error={state.error} onRetry={load} />}
        {state.kind === "ok" && (
          <>
            <p className="mb-4 text-sm text-ink-muted">
              For terrain <code className="font-mono">{state.prov.terrain_id}</code>.
            </p>
            <div className="grid gap-4">
              {state.prov.datasets.map((d) => (
                <Card key={`${d.role}-${d.name}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">
                      <Text>{d.name}</Text>
                    </h3>
                    <span className="text-xs tracking-wide text-ink-muted uppercase">{d.role}</span>
                    <BasisChip basis={d.basis} />
                  </div>
                  <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt className="text-ink-muted">Licence</dt>
                    <dd>
                      <Text>{d.license}</Text>
                    </dd>
                    <dt className="text-ink-muted">Attribution</dt>
                    <dd>
                      <Text>{d.attribution}</Text>
                    </dd>
                    <dt className="text-ink-muted">Source</dt>
                    <dd>
                      <SourceLink url={d.url} />
                    </dd>
                    {d.resolution_m !== undefined && (
                      <>
                        <dt className="text-ink-muted">Resolution</dt>
                        <dd>
                          {/* The contract gives no basis for resolution; it is a property of this dataset, so it carries the dataset's basis. */}
                          <MetricValue value={d.resolution_m} unit="m" basis={d.basis} />
                        </dd>
                      </>
                    )}
                    {d.date_range && (
                      <>
                        <dt className="text-ink-muted">Date range</dt>
                        <dd className="font-mono tabular-nums">
                          {d.date_range.start} to {d.date_range.end}
                        </dd>
                      </>
                    )}
                  </dl>
                </Card>
              ))}

              {state.prov.texture && (
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">Surface imagery</h3>
                    <span className="text-xs tracking-wide text-ink-muted uppercase">{state.prov.texture.source.replace("_", " ")}</span>
                    {/* Same heuristic as the viewer's isCoarseImagery (TextureInfo has no coarse flag). */}
                    {(state.prov.texture.source === "nasa_gibs" || (state.prov.texture.resolution_m ?? 0) >= 10) && <Badge variant="coarse" />}
                  </div>
                  <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt className="text-ink-muted">Licence</dt>
                    <dd>
                      <Text>{state.prov.texture.license}</Text>
                    </dd>
                    <dt className="text-ink-muted">Attribution</dt>
                    <dd>
                      <Text>{state.prov.texture.attribution}</Text>
                    </dd>
                    {state.prov.texture.resolution_m !== undefined && (
                      <>
                        <dt className="text-ink-muted">Resolution</dt>
                        <dd>
                          {/* TextureInfo has no basis; pixel size follows from image size over its bounds, so "derived". */}
                          <MetricValue value={state.prov.texture.resolution_m} unit="m" basis="derived" />
                        </dd>
                      </>
                    )}
                  </dl>
                </Card>
              )}
            </div>

            {state.prov.quality_flags.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-ink">Quality flags</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {state.prov.quality_flags.map((f) => (
                    <li key={f} className="rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Section>

      <Section id="twin-sources" title="Farm twin: map, 3D and weather sources">
        <div className="grid gap-4">
          {TWIN_SOURCES.map((d) => (
            <Card key={d.name}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{d.name}</h3>
                <span className="text-xs tracking-wide text-ink-muted uppercase">{d.role}</span>
                <BasisChip basis={d.basis} />
              </div>
              <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-ink-muted">Licence</dt>
                <dd>{d.licence}</dd>
                <dt className="text-ink-muted">Attribution</dt>
                <dd>{d.attribution}</dd>
                <dt className="text-ink-muted">Source</dt>
                <dd>
                  <SourceLink url={d.url} />
                </dd>
                <dt className="text-ink-muted">Limitation</dt>
                <dd>{d.note}</dd>
              </dl>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-muted">Look filters (thermal, vegetation, night) are illustrative styling of the imagery, not sensor data.</p>
      </Section>

      <Section id="farms" title="Farms on the globe">
        <p className="text-ink-muted">Where each pin comes from. Private farmland is described by area only: no owners or addresses.</p>
        <div className="mt-4 grid gap-4">
          {FARMS.map((f) => (
            <Card key={f.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{f.name}</h3>
                <span className="text-xs tracking-wide text-ink-muted uppercase">{TIER_LABEL[f.tier]}</span>
              </div>
              <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-ink-muted">Operated by</dt>
                <dd>{f.owner}</dd>
                <dt className="text-ink-muted">Location</dt>
                <dd className="flex flex-wrap items-baseline gap-2">
                  {f.coordsVerified ? "Coordinates published by the source" : "Approximate: the source publishes no coordinates for this pin"}
                  <BasisChip basis={f.coordsVerified ? "measured" : "assumed"} />
                </dd>
                <dt className="text-ink-muted">Source</dt>
                <dd>
                  <SourceLink url={f.sourceUrl} />
                </dd>
                {f.tier === "twin" && (
                  <>
                    <dt className="text-ink-muted">Twin</dt>
                    <dd>Approximate field outlines; illustrative crops and rotations (not farm records).</dd>
                  </>
                )}
              </dl>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="assumptions" title="Assumptions">
        {state.kind === "ok" ? (
          state.prov.assumptions.length ? (
            <ul className="grid gap-2">
              {state.prov.assumptions.map((a) => (
                <li key={a.statement} className="flex flex-wrap items-baseline gap-2">
                  <BasisChip basis={a.basis} />
                  <span className="text-ink">
                    <Text>{a.statement}</Text>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">The data source lists no assumptions for this terrain.</p>
          )
        ) : state.kind === "loading" ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <p className="text-ink-muted">Shown once the data sources load.</p>
        )}
      </Section>

      <Section id="limits" title="Limits">
        <ul className="grid list-disc gap-2 pl-5 text-ink">
          {state.kind === "ok" &&
            state.prov.limitations.map((l) => (
              <li key={l}>
                <Text>{l}</Text>
              </li>
            ))}
          <li>Outputs compare rotations under the same storm. They are relative comparisons, not predictions of what will happen.</li>
          <li>FieldTwin gives no yield, profit or absolute soil-loss figures. The erosion index only ranks options against each other.</li>
          <li>Weather records are much coarser than a single field. A real storm can be stronger or weaker on your land than shown.</li>
          <li>Field outlines on the farm twins are approximate, and their crops and rotations are illustrative, not surveyed boundaries or farm records.</li>
          <li>Most farm pins are approximate locations; only the Mead pin uses published coordinates (an AmeriFlux tower).</li>
          <li>Coarse data stays labelled coarse. Stretching it over a detailed 3D surface does not add detail.</li>
          <li>Photos you upload only change how the land looks. Elevation always comes from open data.</li>
          <li>Drone and video capture are on the roadmap only. They do not work in this version.</li>
        </ul>
        <p className="mt-6 rounded-md border border-line bg-surface-2 px-4 py-3 text-ink">{SUPPORT_SENTENCE}</p>
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/" className="text-accent underline underline-offset-2">
            Back to the farm globe
          </Link>
        </p>
      </Section>
    </div>
  );
}
