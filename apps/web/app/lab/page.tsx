"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";

import { EvidenceCardView } from "@/components/lab/EvidenceCardView";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { MetricValue } from "@/components/ui/MetricValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCrops, getEvidence, getRotationPresets, isMock, validateRotation } from "@/lib/api/client";
import type { CropTemplate, EvidenceBundle, Rotation, ValidateResult } from "@/lib/api/types";
import { useAppStore } from "@/lib/store";
import { useTerrainId } from "@/lib/useSiteData";

type Load<T> = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; value: T };

function useLoad<T>(fn: (() => Promise<T>) | null): Load<T> & { retry(): void } {
  const [state, setState] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!fn) return;
    let cancelled = false;
    setState({ kind: "loading" });
    fn().then(
      (value) => !cancelled && setState({ kind: "ok", value }),
      (error) => !cancelled && setState({ kind: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [fn, attempt]);
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

const WARNING_LABEL: Record<ValidateResult["warnings"][number]["code"], string> = {
  same_family_consecutive: "Same crop family in consecutive years",
  outside_season_window: "Outside the planting season window",
  unknown_crop: "Unknown crop",
};

/** A preset with an editable crop per step; "Check" sends the edited sequence to /rotations/validate. */
function RotationCard({ rotation, crops, terrainId }: { rotation: Rotation; crops: CropTemplate[]; terrainId: string }) {
  const [sequence, setSequence] = useState(rotation.sequence);
  const [editing, setEditing] = useState(false);
  const [check, setCheck] = useState<Load<ValidateResult> | null>(null);
  const cropName = (id: string) => crops.find((c) => c.id === id)?.name ?? id;
  const years = [...new Set(sequence.map((s) => s.year))];

  const validate = () => {
    setCheck({ kind: "loading" });
    validateRotation({ terrain_id: terrainId, rotation: { base_rotation_id: rotation.id, name: rotation.name, sequence } }).then(
      (value) => setCheck({ kind: "ok", value }),
      (error) => setCheck({ kind: "error", error }),
    );
  };

  return (
    <Card className="grid content-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg text-ink">{rotation.name}</h3>
        {rotation.is_existing && <span className="rounded border border-ink-muted px-1.5 text-xs text-ink">Current rotation</span>}
      </div>
      <ol className="grid gap-1 text-sm">
        {years.map((y) => (
          <li key={y}>
            <span className="text-ink-muted">Year {y}:</span>{" "}
            {editing
              ? sequence.map((s, i) =>
                  s.year !== y ? null : (
                    <select
                      key={i}
                      aria-label={`Year ${y}, crop ${i + 1}`}
                      value={s.crop_id}
                      onChange={(e) => {
                        setSequence(sequence.map((x, j) => (j === i ? { ...x, crop_id: e.target.value } : x)));
                        setCheck(null);
                      }}
                      className="mr-1 mb-1 rounded border border-line bg-surface-2 px-1 py-0.5 text-ink"
                    >
                      {crops.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ),
                )
              : sequence
                  .filter((s) => s.year === y)
                  .map((s) => cropName(s.crop_id))
                  .join(", then ")}
          </li>
        ))}
      </ol>
      <div className="grid gap-1 text-sm">
        {/* Computed by the API from crop cover curves, hence "derived". */}
        {rotation.cover_calendar.days_bare_per_year.map((d, i) => (
          <MetricValue key={i} label={`Bare soil, year ${i + 1}`} value={d} unit="days" basis="derived" digits={0} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)} className="rounded-md border border-line bg-surface-2 px-3 py-1 text-sm text-ink hover:bg-line">
          {editing ? "Done editing" : "Edit crops"}
        </button>
        <button type="button" onClick={validate} className="rounded-md border border-accent px-3 py-1 text-sm font-medium text-ink hover:bg-surface-2">
          Check this rotation
        </button>
      </div>
      <div aria-live="polite">
        {check?.kind === "loading" && <Skeleton className="h-10 w-full" label="Checking the rotation" />}
        {check?.kind === "error" && <ErrorCard title="Could not check the rotation" error={check.error} onRetry={validate} />}
        {check?.kind === "ok" && (
          <div className="grid gap-1 text-sm">
            <p className="font-medium text-ink">{check.value.valid ? "✓ Valid rotation" : "✗ Not valid: fix the problems below"}</p>
            {check.value.warnings.length === 0 && <p className="text-ink-muted">No warnings.</p>}
            <ul className="grid gap-1">
              {check.value.warnings.map((w, i) => (
                <li key={i} className="rounded border border-line bg-surface-2 px-2 py-1">
                  <span aria-hidden>⚠ </span>
                  <b>{WARNING_LABEL[w.code] ?? w.code}</b>
                  {w.year !== undefined && ` (year ${w.year})`}: {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function LabPage() {
  const { terrainId, error: idError, retry: retryId } = useTerrainId();
  const simId = useAppStore((s) => s.simId);
  const lists = useLoad(useCallback(() => (terrainId ? Promise.all([getRotationPresets(terrainId), getCrops()]) : new Promise<never>(() => {})), [terrainId]));
  const evidence = useLoad<EvidenceBundle>(useCallback(() => (simId ? getEvidence(simId) : Promise.resolve({ evidence_cards: [], insights: [] })), [simId]));
  const presets = lists.kind === "ok" ? lists.value[0] : [];
  const nameOf = (id: string) => presets.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-ink">Rotation Lab</h1>
        {isMock && <Badge variant="mock" />}
      </div>
      <p className="mt-2 max-w-2xl text-ink-muted">Compare crop rotations for this land, check an edited rotation for common problems, and read why each one is suggested.</p>

      <h2 className="mt-8 font-display text-2xl text-ink">Rotations</h2>
      {idError != null && <ErrorCard title="Could not choose a site" error={idError} onRetry={retryId} />}
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.kind === "loading" && [0, 1, 2].map((i) => <Skeleton key={i} className="h-56 w-full" label={i === 0 ? "Loading rotations" : undefined} />)}
        {lists.kind === "error" && (
          <div className="md:col-span-2 lg:col-span-3">
            <ErrorCard title="Could not load rotations" error={lists.error} onRetry={lists.retry} />
          </div>
        )}
        {lists.kind === "ok" && presets.length === 0 && <p className="text-ink-muted">No rotation presets for this terrain.</p>}
        {lists.kind === "ok" && terrainId && presets.map((r) => <RotationCard key={r.id} rotation={r} crops={lists.value[1]} terrainId={terrainId} />)}
      </div>

      <h2 className="mt-10 font-display text-2xl text-ink">Evidence from the last storm replay</h2>
      {!simId ? (
        <p className="mt-2 text-ink-muted">
          Evidence cards come from a storm replay.{" "}
          <Link href="/simulate" className="text-accent underline underline-offset-2">
            Run one on Simulate
          </Link>{" "}
          and come back here.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {evidence.kind === "loading" && <Skeleton className="h-72 w-full" label="Loading evidence" />}
          {evidence.kind === "error" && (
            <div className="md:col-span-2 lg:col-span-3">
              <ErrorCard title="Could not load the evidence" error={evidence.error} onRetry={evidence.retry} />
            </div>
          )}
          {evidence.kind === "ok" && evidence.value.evidence_cards.length === 0 && <p className="text-ink-muted">This replay returned no evidence cards.</p>}
          {evidence.kind === "ok" && evidence.value.evidence_cards.map((c) => <EvidenceCardView key={c.rotation_id} card={c} name={nameOf(c.rotation_id)} />)}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" label="Loading the Rotation Lab" />}>
      <LabPage />
    </Suspense>
  );
}
