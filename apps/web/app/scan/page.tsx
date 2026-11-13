"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { ApiError, isMock, startScan, type StartScanInput, subscribeScanEvents } from "@/lib/api/client";
import type { ProgressEvent, ProgressStage } from "@/lib/api/types";
import { SCAN_IMAGE_TYPES, SCAN_MAX_IMAGES, SCAN_MAX_NAME, type ScanFormErrors, validateScanForm } from "@/lib/scanForm";
import { useAppStore } from "@/lib/store";

// Pipeline order from the contract (ProgressStage); "failed" is shown as an error instead of a step.
const STEPS: [Exclude<ProgressStage, "failed">, string][] = [
  ["queued", "Waiting to start"],
  ["reading_inputs", "Reading your photos"],
  ["locating", "Finding the location"],
  ["fetching_elevation", "Getting open elevation data"],
  ["building_mesh", "Building the 3D surface"],
  ["classifying_cover", "Reading the ground cover"],
  ["analyzing_drainage", "Tracing where water drains"],
  ["fetching_weather", "Getting the weather history"],
  ["packaging", "Packaging the model"],
  ["ready", "Ready"],
];

type Run = { kind: "idle" } | { kind: "running"; last?: ProgressEvent } | { kind: "failed"; last?: ProgressEvent; error: unknown };

const inputClass = "mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 font-mono tabular-nums text-ink aria-[invalid=true]:border-danger";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1 text-sm text-danger">
      {msg}
    </p>
  ) : null;
}

export default function ScanPage() {
  const router = useRouter();
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mockFail, setMockFail] = useState(false);
  const [errors, setErrors] = useState<ScanFormErrors>({});
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const lastInput = useRef<StartScanInput | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => () => unsubscribe.current?.(), []);

  async function go(input: StartScanInput) {
    unsubscribe.current?.();
    lastInput.current = input;
    setRun({ kind: "running" });
    try {
      const { scan_id } = await startScan(input);
      unsubscribe.current = subscribeScanEvents(
        scan_id,
        {
          onEvent: (e) => {
            if (e.stage === "failed") {
              setRun({ kind: "failed", last: e, error: e.error ? new ApiError(e.error, 0) : new Error(e.message) });
            } else if (e.stage === "ready" && e.terrain_id) {
              setRun({ kind: "running", last: e });
              useAppStore.setState({ siteId: null, terrainId: e.terrain_id, selectedFieldId: null });
              router.push(`/viewer?terrain=${encodeURIComponent(e.terrain_id)}`);
            } else {
              setRun({ kind: "running", last: e });
            }
          },
          onError: (error) => setRun((r) => ({ kind: "failed", last: r.kind === "idle" ? undefined : r.last, error })),
        },
        { mockScenario: mockFail ? "fail" : "success" },
      );
    } catch (error) {
      setRun({ kind: "failed", error });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { errors, input } = validateScanForm({ lat, lon, name, images: files });
    setErrors(errors);
    if (input) go({ ...input, images: files });
  }

  const current = run.kind === "idle" ? -1 : STEPS.findIndex(([s]) => s === run.last?.stage);
  const pct = run.kind === "idle" ? 0 : (run.last?.pct ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-ink">Land Scan</h1>
        {isMock && <Badge variant="mock" />}
      </div>
      <p className="mt-2 text-ink-muted">
        Give a location and, if you like, a few photos. Elevation always comes from open data; photos only set how the land looks. Prefer a ready-made site?{" "}
        <Link href="/explore" className="text-accent underline underline-offset-2">
          Choose a pre-built site
        </Link>
        .
      </p>

      {run.kind === "idle" ? (
        <form noValidate onSubmit={onSubmit} className="mt-8 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink">
              Latitude (decimal degrees)
              <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="49.10" aria-invalid={!!errors.lat} aria-describedby="lat-err" className={inputClass} />
              <FieldError id="lat-err" msg={errors.lat} />
            </label>
            <label className="block text-sm font-medium text-ink">
              Longitude (decimal degrees)
              <input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-122.30" aria-invalid={!!errors.lon} aria-describedby="lon-err" className={inputClass} />
              <FieldError id="lon-err" msg={errors.lon} />
            </label>
          </div>
          <label className="block text-sm font-medium text-ink">
            Name (optional)
            <input value={name} maxLength={SCAN_MAX_NAME} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby="name-err" className={`${inputClass} font-sans`} />
            <FieldError id="name-err" msg={errors.name} />
          </label>
          <label className="block text-sm font-medium text-ink">
            Photos (optional, up to {SCAN_MAX_IMAGES}, JPG, PNG or WEBP)
            <input type="file" multiple accept={SCAN_IMAGE_TYPES.join(",")} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} aria-invalid={!!errors.images} aria-describedby="images-err images-help" className="mt-1 block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink" />
            <span id="images-help" className="mt-1 block text-xs font-normal text-ink-muted">
              Without photos, an open-imagery texture is used instead.
            </span>
            <FieldError id="images-err" msg={errors.images} />
          </label>
          {isMock && (
            <label data-dev-only className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={mockFail} onChange={(e) => setMockFail(e.target.checked)} />
              Dev only: replay the mock failure (no elevation coverage)
            </label>
          )}
          <button type="submit" className="justify-self-start rounded-md bg-accent px-5 py-2.5 font-medium text-accent-ink hover:opacity-90">
            Start scan
          </button>
        </form>
      ) : (
        <Card className="mt-8">
          <h2 className="font-semibold text-ink">{run.kind === "failed" ? "The scan stopped" : "Building your land model"}</h2>
          <p aria-live="polite" className="mt-1 text-sm text-ink-muted">
            {run.last?.message ?? "Starting…"}
          </p>
          <div role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full transition-[width] duration-300 ${run.kind === "failed" ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right font-mono text-xs tabular-nums text-ink-muted">{pct} %</p>
          <ol className="mt-4 grid gap-1.5 text-sm">
            {STEPS.map(([stage, label], i) => {
              const status = i < current || (stage === "ready" && i === current) ? "done" : i === current ? (run.kind === "failed" ? "stopped" : "now") : "todo";
              return (
                <li key={stage} className={`flex items-center gap-2 ${status === "todo" ? "text-ink-muted" : "text-ink"}`}>
                  <span aria-hidden className="w-4 text-center font-mono">
                    {{ done: "✓", now: "›", stopped: "✕", todo: "·" }[status]}
                  </span>
                  <span>{label}</span>
                  <span className="sr-only">{{ done: "(done)", now: "(in progress)", stopped: "(stopped here)", todo: "(not started)" }[status]}</span>
                </li>
              );
            })}
          </ol>
          {run.kind === "failed" && (
            <div className="mt-5">
              <ErrorCard title="We could not build this land model" error={run.error} onRetry={() => lastInput.current && go(lastInput.current)}>
                <button type="button" onClick={() => setRun({ kind: "idle" })} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
                  Edit the location
                </button>
                <Link href="/explore" className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
                  Use a pre-built site
                </Link>
              </ErrorCard>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
