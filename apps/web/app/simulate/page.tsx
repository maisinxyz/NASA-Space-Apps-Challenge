"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Hud } from "@/components/sim/Hud";
import { StormPicker } from "@/components/sim/StormPicker";
import { InsightPanel, insightPins, visibleInsights } from "@/components/twin/InsightPanel";
import { LayerPanel } from "@/components/twin/LayerPanel";
import { setProbe } from "@/components/twin/ProbeReadout";
import { Badge } from "@/components/ui/Badge";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Legend } from "@/components/ui/Legend";
import { MetricValue } from "@/components/ui/MetricValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { VIEWPORT_H, ViewerStage } from "@/components/ViewerStage";
import { buildLayerLegends, diffLegend, RISK_LEGEND } from "@/components/viewer/meta";
import { ApiError, getDiff, getEvidence, getRotationPresets, getSimulation, getStorms, isMock, runSimulation } from "@/lib/api/client";
import type { DiffStats, Insight, Rotation, SimulationStatus, Storm } from "@/lib/api/types";
import { hasModifier, usesArrows, usesSpace } from "@/lib/keys";
import { followSimulation, simulationInvalidated } from "@/lib/simulation";
import { useAppStore } from "@/lib/store";
import { TOUR } from "@/lib/tour";
import { useSiteData, useTerrainId } from "@/lib/useSiteData";

const MAX_ROTATIONS = 3;
/** A full replay takes about this long at 1x. */
const REPLAY_SECONDS = 12;

type Sim = { kind: "idle" } | { kind: "running"; phase: "queued" | "running"; progress: number } | { kind: "failed"; error: unknown } | { kind: "done"; status: SimulationStatus };
type Lists = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; storms: Storm[]; presets: Rotation[] };

function SimulatePage() {
  const { terrainId, error: idError, retry: retryId } = useTerrainId();
  const data = useSiteData(terrainId);
  const ok = data.kind === "ok" ? data.data : null;
  const s = useAppStore();
  const [lists, setLists] = useState<Lists>({ kind: "loading" });
  const [listAttempt, setListAttempt] = useState(0);
  const [sim, setSim] = useState<Sim>({ kind: "idle" });
  const [diff, setDiff] = useState<{ key: string; stats?: DiffStats; error?: unknown } | null>(null);
  const [timedInsights, setTimedInsights] = useState<Insight[]>([]);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const task = useRef<AbortController | null>(null);

  // Subscribe synchronously: Reset can restore the same inputs before React renders.
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((next, previous) => {
      if (!simulationInvalidated(next, previous)) return;
      task.current?.abort();
      task.current = null;
      setSim({ kind: "idle" });
      setDiff(null);
      setTimedInsights([]);
      setActiveInsight(null);
      if (next.simId || next.playing || next.timeMin || next.showDiff) {
        useAppStore.setState({ simId: null, playing: false, timeMin: 0, showDiff: false });
      }
    });
    return () => {
      unsubscribe();
      task.current?.abort();
      task.current = null;
    };
  }, []);

  // Storms and rotation presets; pick defaults the first time (existing rotation as A).
  useEffect(() => {
    if (!terrainId) return;
    let cancelled = false;
    setLists({ kind: "loading" });
    Promise.all([getStorms(terrainId), getRotationPresets(terrainId)]).then(
      ([storms, presets]) => {
        if (cancelled) return;
        setLists({ kind: "ok", storms, presets });
        const st = useAppStore.getState();
        const patch: Partial<typeof st> = {};
        if (!storms.some((x) => x.id === st.stormId) && storms[0]) patch.stormId = storms[0].id;
        const validIds = st.simRotationIds.filter((id) => presets.some((r) => r.id === id));
        if (!validIds.length || validIds.length !== st.simRotationIds.length) {
          const ids = validIds.length ? validIds : [...presets].sort((x, y) => Number(y.is_existing) - Number(x.is_existing)).slice(0, 2).map((r) => r.id);
          patch.simRotationIds = ids;
          patch.rotationIds = ids.length >= 2 ? [ids[0], ids[1]] : ids.length ? [ids[0]] : [];
        }
        if (!storms.length) patch.stormId = null;
        useAppStore.setState(patch);
      },
      (error) => !cancelled && setLists({ kind: "error", error }),
    );
    return () => { cancelled = true; };
  }, [terrainId, listAttempt]);

  const start = useCallback(async (initial: () => Promise<SimulationStatus>) => {
    task.current?.abort();
    const controller = new AbortController();
    task.current = controller;
    setSim({ kind: "running", phase: "queued", progress: 0 });
    try {
      const status = await followSimulation({
        initial, read: getSimulation, signal: controller.signal,
        onProgress: (pending) => {
          setSim({ kind: "running", phase: pending.status === "queued" ? "queued" : "running", progress: pending.progress });
          useAppStore.setState({ simId: pending.id });
        },
      });
      if (!status || controller.signal.aborted) return;
      setSim({ kind: "done", status });
      useAppStore.setState({ simId: status.id });
    } catch (error) {
      if (!controller.signal.aborted) setSim({ kind: "failed", error });
    } finally {
      if (task.current === controller) task.current = null;
    }
  }, []);

  // Restored queued/running jobs use the same polling and failure handling as new jobs.
  useEffect(() => {
    if (!s.simId || sim.kind !== "idle" || task.current) return;
    const id = s.simId;
    void start(() => getSimulation(id));
  }, [s.simId, sim.kind, start]);

  const run = useCallback(async () => {
    const st = useAppStore.getState();
    if (!st.terrainId || !st.stormId || !st.simRotationIds.length) return;
    useAppStore.setState({ simId: null, playing: false, timeMin: 0, showDiff: false });
    await start(() => runSimulation({ terrain_id: st.terrainId!, storm_id: st.stormId!, rotation_ids: [...st.simRotationIds] }));
  }, [start]);
  const pickStorm = useCallback((id: string) => useAppStore.setState({ stormId: id }), []);

  // Guided tour: run with the defaults once the storm beat is reached.
  const beat = s.tourStep !== null ? TOUR[s.tourStep]?.beat : undefined;
  useEffect(() => {
    if (beat && beat >= 4 && lists.kind === "ok" && ok && sim.kind === "idle" && !s.simId && s.stormId && s.simRotationIds.length) void run();
  }, [beat, lists.kind, ok, sim.kind, s.simId, s.stormId, s.simRotationIds.length, run]);

  const status = sim.kind === "done" ? sim.status : null;
  const [a, b] = s.rotationIds;
  const times = (a && status?.results[a]?.frame_times_min) || [0];
  const maxT = times.at(-1) ?? 0;
  const stepMin = (a && status?.results[a]?.step_minutes) || 1;

  // Playback: advance timeMin in real time; stop at the end.
  useEffect(() => {
    if (!s.playing || !status) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const t = Math.min(maxT, useAppStore.getState().timeMin + ((now - last) / 1000) * (maxT / REPLAY_SECONDS));
      last = now;
      useAppStore.setState(t >= maxT ? { timeMin: maxT, playing: false } : { timeMin: t });
      if (t < maxT) raf = requestAnimationFrame(tick);
    };
    if (useAppStore.getState().timeMin >= maxT) useAppStore.setState({ timeMin: 0 });
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [s.playing, status, maxT]);

  // Space: play/pause. Arrows: scrub one frame step (Shift: ten). Ignored while a control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!status || hasModifier(e)) return;
      if (e.key === " " && !usesSpace(e.target)) {
        e.preventDefault();
        useAppStore.setState((st) => ({ playing: !st.playing }));
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !usesArrows(e.target)) {
        e.preventDefault();
        const d = (e.key === "ArrowLeft" ? -1 : 1) * stepMin * (e.shiftKey ? 10 : 1);
        useAppStore.setState((st) => ({ playing: false, timeMin: Math.min(maxT, Math.max(0, st.timeMin + d)) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, stepMin, maxT]);

  // Diff stats for the current pair.
  const diffKey = status && a && b && s.showDiff ? `${status.id}|${a}|${b}` : null;
  useEffect(() => {
    if (!diffKey || !status || !a || !b) return;
    let cancelled = false;
    setDiff({ key: diffKey });
    getDiff(status.id, a, b).then(
      (stats) => !cancelled && setDiff({ key: diffKey, stats }),
      (error) => !cancelled && setDiff({ key: diffKey, error }),
    );
    return () => { cancelled = true; };
  }, [diffKey, status, a, b]);

  // Timed insights come with the evidence bundle.
  useEffect(() => {
    setTimedInsights([]);
    if (!status) return;
    let cancelled = false;
    getEvidence(status.id).then((e) => !cancelled && setTimedInsights(e.insights), () => {});
    return () => { cancelled = true; };
  }, [status]);

  const allInsights = useMemo(() => [...(ok && Array.isArray(ok.insights) ? ok.insights : []), ...timedInsights], [ok, timedInsights]);
  const shownInsights = useMemo(() => visibleInsights(allInsights, status ? s.timeMin : null), [allInsights, status, s.timeMin]);
  const pins = useMemo(() => insightPins(shownInsights, activeInsight), [shownInsights, activeInsight]);
  const legends = useMemo(() => (ok ? [...buildLayerLegends(ok.catalog), ...(status ? [RISK_LEGEND] : [])] : []), [ok, status]);

  if (idError) return <Centered><ErrorCard title="Could not choose a site" error={idError} onRetry={retryId} /></Centered>;
  if (data.kind === "error") return <Centered><ErrorCard title="Could not load this terrain" error={data.error} onRetry={data.retry}><Link href="/explore" className="rounded-md border border-line px-3 py-1.5 text-sm">Choose another site</Link></ErrorCard></Centered>;

  const presets = lists.kind === "ok" ? lists.presets : [];
  const nameOf = (id: string | undefined) => presets.find((r) => r.id === id)?.name ?? id ?? "";
  const pair = s.mode === "split" || s.showDiff;
  const setPair = (na: string | undefined, nb: string | undefined) => useAppStore.setState({ rotationIds: na ? (nb ? [na, nb] : [na]) : [], showDiff: nb ? s.showDiff : false, mode: nb ? s.mode : "single" });
  const toggleRotation = (id: string) => {
    const cur = s.simRotationIds;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    if (next.length > MAX_ROTATIONS) return;
    setPair(next[0], next[1]);
    useAppStore.setState({ simRotationIds: next });
  };

  return (
    <div className={`theme-dark grid bg-paper text-ink lg:grid-cols-[20rem_1fr_27rem] ${VIEWPORT_H}`}>
      <aside aria-label="Storm and rotations" className="grid min-w-0 content-start gap-5 overflow-x-hidden overflow-y-auto border-r border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-ink">Storm replay</h1>
          {isMock && <Badge variant="mock" />}
        </div>
        {lists.kind === "loading" && <Skeleton className="h-48 w-full" label="Loading storms and rotations" />}
        {lists.kind === "error" && <ErrorCard title="Could not load storms or rotations" error={lists.error} onRetry={() => setListAttempt((n) => n + 1)} />}
        {lists.kind === "ok" && (
          <>
            {/* Hourly marker: the chart need not re-render on every playback frame. */}
            <StormPicker storms={lists.storms} stormId={s.stormId} timeMin={Math.floor(s.timeMin / 60) * 60} onPick={pickStorm} />
            <section aria-labelledby="rot-h">
              <h2 id="rot-h" className="text-sm font-semibold text-ink">
                2. Rotations <span className="font-normal text-ink-muted">(up to {MAX_ROTATIONS})</span>
              </h2>
              {presets.length === 0 && <p className="mt-1 text-sm text-ink-muted">No rotation presets for this terrain.</p>}
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {presets.map((r) => {
                  const on = s.simRotationIds.includes(r.id);
                  const full = !on && s.simRotationIds.length >= MAX_ROTATIONS;
                  return (
                    <li key={r.id}>
                      <button type="button" aria-pressed={on} disabled={full} onClick={() => toggleRotation(r.id)} className={`rounded-full border px-3 py-1 text-left text-xs ${on ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:border-ink-muted"} disabled:opacity-50`}>
                        {on ? "✓ " : "+ "}
                        {r.name}
                        {r.is_existing && " (current)"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {s.simRotationIds.length >= 1 && (
                <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-sm">
                  <label htmlFor="rot-a" className="font-semibold">
                    A
                  </label>
                  <select id="rot-a" value={a ?? ""} onChange={(e) => setPair(e.target.value, b === e.target.value ? a : b)} className="w-full min-w-0 rounded border border-line bg-surface-2 px-1 py-0.5 text-ink">
                    {s.simRotationIds.map((id) => (
                      <option key={id} value={id}>
                        {nameOf(id)}
                      </option>
                    ))}
                  </select>
                  {s.simRotationIds.length >= 2 && (
                    <>
                      <label htmlFor="rot-b" className="font-semibold">
                        B
                      </label>
                      <select id="rot-b" value={b ?? ""} onChange={(e) => setPair(a === e.target.value ? (b as string) : (a as string), e.target.value)} className="w-full min-w-0 rounded border border-line bg-surface-2 px-1 py-0.5 text-ink">
                        {s.simRotationIds.map((id) => (
                          <option key={id} value={id}>
                            {nameOf(id)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}
            </section>
            <section aria-labelledby="run-h">
              <h2 id="run-h" className="text-sm font-semibold text-ink">
                3. Replay
              </h2>
              <button type="button" onClick={() => void run()} disabled={!s.stormId || !s.simRotationIds.length || sim.kind === "running"} className="mt-2 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
                {sim.kind === "done" ? "Run again" : "Run the storm on these rotations"}
              </button>
              {sim.kind === "running" && (
                <div role="status" className="mt-2 text-sm">
                  <div className="h-2 overflow-hidden rounded bg-surface-2">
                    <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(sim.progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-ink-muted">{sim.phase === "queued" ? "Queued…" : "Simulating…"} {Math.round(sim.progress * 100)}% done</p>
                </div>
              )}
              {sim.kind === "failed" && (
                <div className="mt-2">
                  <ErrorCard title="The simulation did not finish" error={sim.error} onRetry={sim.error instanceof ApiError && !sim.error.retryable ? undefined : () => void run()} />
                </div>
              )}
              {sim.kind === "done" && <p className="mt-2 text-sm text-ink-muted">{status?.cached ? "Ready (from an earlier identical run)." : "Ready."} Press Play or Space.</p>}
            </section>
          </>
        )}
      </aside>

      <div className="flex min-h-[24rem] min-w-0 flex-col">
        <div className="relative min-h-[20rem] flex-1">
          {ok && a ? (
            <ViewerStage
              terrain={ok.terrain}
              fields={ok.fields}
              layers={s.layers.filter((l) => l !== "risk" || status)}
              selectedFieldId={s.selectedFieldId}
              mode={pair && b ? s.mode : "single"}
              rotationIds={pair && b ? [a, b] : [a]}
              sim={status ? { simId: status.id, results: status.results } : undefined}
              timeMin={s.timeMin}
              showDiff={!!(s.showDiff && b && status)}
              onFieldSelect={(id) => useAppStore.setState({ selectedFieldId: id })}
              onProbe={setProbe}
              pins={pins}
              onPinSelect={setActiveInsight}
            />
          ) : (
            <Skeleton className="h-full w-full" label="Loading the terrain" />
          )}
          {s.mode === "split" && b && (
            <div className="pointer-events-none absolute inset-x-0 top-9 flex justify-between px-3 text-xs font-semibold text-white">
              <span className="rounded bg-black/70 px-2 py-0.5">A: {nameOf(a)}</span>
              <span className="rounded bg-black/70 px-2 py-0.5">B: {nameOf(b)}</span>
            </div>
          )}
        </div>
        <Timeline status={status} maxT={maxT} stepMin={stepMin} hasB={!!b} />
      </div>

      <aside aria-label="Results" className="grid min-w-0 content-start gap-5 overflow-x-hidden overflow-y-auto border-l border-line p-4">
        {status && a ? (
          <Hud a={status.results[a]?.metrics ?? null} b={b ? (status.results[b]?.metrics ?? null) : null} nameA={nameOf(a)} nameB={b ? nameOf(b) : null} />
        ) : (
          <p className="text-sm text-ink-muted">Run a storm to compare rotations here. Results are relative comparisons from a model, not predictions.</p>
        )}
        {s.showDiff && diff && diff.key === diffKey && (
          <section aria-labelledby="diff-h" className="grid gap-2">
            <h2 id="diff-h" className="text-sm font-semibold text-ink">
              Difference, B minus A
            </h2>
            {diff.error != null && <ErrorCard title="Could not load the difference" error={diff.error} />}
            {!diff.stats && diff.error == null && <Skeleton className="h-16 w-full" label="Loading difference" />}
            {diff.stats && (
              <>
                <Legend legend={diffLegend(diff.stats)} />
                <MetricValue label="Mean change in peak water depth" value={diff.stats.mean_diff_mm} unit={diff.stats.unit} basis={diff.stats.basis} digits={1} />
                <MetricValue label="Area where it changes by more than 1 mm" value={diff.stats.changed_area_ha} unit="ha" basis={diff.stats.basis} digits={2} />
              </>
            )}
          </section>
        )}
        {ok && <LayerPanel legends={legends} />}
        {ok && <InsightPanel insights={shownInsights} hiddenCount={allInsights.length - shownInsights.length} activeId={activeInsight} onSelect={setActiveInsight} error={Array.isArray(ok.insights) ? undefined : ok.insights.error} />}
        {status && (
          <Link href="/lab" className="rounded-md border border-accent px-4 py-2 text-center text-sm font-medium text-ink hover:bg-surface-2">
            See the evidence for each rotation →
          </Link>
        )}
      </aside>
    </div>
  );
}

/** Play/pause, scrub, A/B and difference toggles, split divider. All write the store; the viewer reads it. */
function Timeline({ status, maxT, stepMin, hasB }: { status: SimulationStatus | null; maxT: number; stepMin: number; hasB: boolean }) {
  const { timeMin, playing, mode, showDiff, divider } = useAppStore();
  const off = !status;
  return (
    <div className="grid gap-2 border-t border-line bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={off} onClick={() => useAppStore.setState({ playing: !playing })} aria-label={playing ? "Pause replay" : "Play replay"} className="min-w-24 rounded-md border border-line bg-surface-2 px-3 py-1 font-medium whitespace-nowrap disabled:opacity-50">
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <label htmlFor="scrub" className="sr-only">
          Replay time, minutes from storm start
        </label>
        <input id="scrub" type="range" disabled={off} min={0} max={maxT} step={stepMin} value={timeMin} onChange={(e) => useAppStore.setState({ timeMin: Number(e.target.value), playing: false })} aria-valuetext={`${Math.round(timeMin)} minutes from storm start`} className="flex-1 accent-[var(--accent)]" />
        <span className="w-full text-right font-mono sm:w-44 text-xs tabular-nums text-ink">
          {Math.round(timeMin).toLocaleString("en-US")} min <span className="text-ink-muted">({(timeMin / 60).toFixed(1)} h) from start</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="View" className="flex overflow-hidden rounded-md border border-line">
          {(["single", "split"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} disabled={m === "split" && !hasB} onClick={() => useAppStore.setState({ mode: m })} className={`px-3 py-1 disabled:opacity-50 ${mode === m ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink"}`}>
              {mode === m && <span aria-hidden>✓ </span>}
              {m === "single" ? "Single (A)" : "Side by side A | B"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" disabled={off || !hasB} checked={showDiff} onChange={(e) => useAppStore.setState({ showDiff: e.target.checked })} className="size-4 accent-[var(--accent)]" />
          Show difference (B minus A)
        </label>
        {mode === "split" && hasB && (
          <label className="flex items-center gap-2">
            Split position
            <input type="range" min={0.1} max={0.9} step={0.05} value={divider} onChange={(e) => useAppStore.setState({ divider: Number(e.target.value) })} aria-valuetext={`${Math.round(divider * 100)}% from the left`} className="w-32 accent-[var(--accent)]" />
          </label>
        )}
        <span className="text-xs text-ink-muted sm:ml-auto">Keys: Space play/pause, ← → scrub (Shift ×10)</span>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-16">{children}</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" label="Loading the simulator" />}>
      <SimulatePage />
    </Suspense>
  );
}
