"use client";
// Guided demo runner (script in lib/tour.ts) and the global Reset key. Mounted once in the root layout.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { hasModifier, isTextEntry, RESET_EVENT } from "@/lib/keys";
import { initialState, useAppStore } from "@/lib/store";
import { TOUR, tourDurationMs } from "@/lib/tour";

const BACKUP_VIDEO_URL = process.env.NEXT_PUBLIC_BACKUP_VIDEO_URL;
const dev = process.env.NODE_ENV !== "production";

export const startTour = () => useAppStore.setState({ ...initialState, tourStep: 0 });

export function BackupVideo() {
  return BACKUP_VIDEO_URL ? (
    <a href={BACKUP_VIDEO_URL} className="text-accent underline underline-offset-2">
      Backup video
    </a>
  ) : (
    <span>Backup video: not recorded yet</span>
  );
}

export function TourController() {
  const tourStep = useAppStore((s) => s.tourStep);
  const router = useRouter();
  const path = usePathname();
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(0);
  const [finishedS, setFinishedS] = useState<number | null>(null);
  const startedAt = useRef(0);
  const stepStartedAt = useRef(0);
  const remaining = useRef(0);
  const running = tourStep !== null;

  const go = (i: number) => {
    if (i >= TOUR.length) {
      const s = (performance.now() - startedAt.current) / 1000;
      if (dev) console.info(`Guided tour finished in ${s.toFixed(1)} s (scripted ${tourDurationMs() / 1000} s)`);
      setFinishedS(s);
      useAppStore.setState({ tourStep: null, playing: false });
    } else useAppStore.setState({ tourStep: Math.max(0, i) });
  };

  // Enter a beat: apply its store patch, move to its route, restart its timer.
  useEffect(() => {
    if (tourStep === null) return;
    const step = TOUR[tourStep];
    if (tourStep === 0 && !startedAt.current) startedAt.current = performance.now();
    useAppStore.setState(step.patch);
    if (window.location.pathname !== step.route) router.push(step.route);
    remaining.current = step.durationMs;
    stepStartedAt.current = performance.now();
    setPaused(false);
  }, [tourStep, router]);

  useEffect(() => {
    if (!running) startedAt.current = 0;
  }, [running]);

  // Beat timer, pausable.
  useEffect(() => {
    if (tourStep === null || paused) return;
    stepStartedAt.current = performance.now();
    const t = setTimeout(() => go(tourStep + 1), remaining.current);
    const tick = setInterval(() => setNow(performance.now()), 100);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
      remaining.current -= performance.now() - stepStartedAt.current;
    };
  }, [tourStep, paused]);

  // R: reset everything to the start state and replay the terraform. Escape: leave the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTextEntry(e.target)) return;
      if (e.key === "r" || e.key === "R") {
        useAppStore.getState().reset();
        setFinishedS(null);
        window.dispatchEvent(new Event(RESET_EVENT));
      } else if (e.key === "Escape" && useAppStore.getState().tourStep !== null) {
        useAppStore.setState({ tourStep: null, playing: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!running) {
    if (finishedS === null) return null;
    return (
      <div role="status" className="theme-dark fixed bottom-36 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink shadow-lg">
        Guided demo finished{dev && <span data-dev-only> in {finishedS.toFixed(1)} s</span>}.
        <button type="button" onClick={() => setFinishedS(null)} className="rounded border border-line px-2 py-0.5">
          Close
        </button>
      </div>
    );
  }

  const step = TOUR[tourStep];
  const left = Math.min(step.durationMs, paused ? remaining.current : Math.max(0, remaining.current - (now - stepStartedAt.current)));
  const btn = "rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:bg-line disabled:opacity-50";
  return (
    <section aria-label="Guided demo" className="theme-dark fixed bottom-36 left-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-line bg-surface/95 p-3 text-ink shadow-lg">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Beat {step.beat} of {TOUR.length}
          {path !== step.route && " · loading page…"}
        </p>
        {dev && (
          <p data-dev-only className="font-mono text-xs text-ink-muted">
            elapsed {(Math.max(0, now - startedAt.current) / 1000).toFixed(1)} s · scripted {tourDurationMs() / 1000} s
          </p>
        )}
      </div>
      <p aria-live="polite" className="mt-1">
        <b>{step.title}.</b> {step.caption}
      </p>
      <div aria-hidden className="mt-2 h-1 overflow-hidden rounded bg-surface-2">
        <div className="h-full bg-accent" style={{ width: `${100 - (left / step.durationMs) * 100}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={tourStep === 0} onClick={() => go(tourStep - 1)}>
          ← Back
        </button>
        <button type="button" className={btn} aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? "▶ Resume" : "❚❚ Pause"}
        </button>
        <button type="button" className={btn} onClick={() => go(tourStep + 1)}>
          Skip →
        </button>
        <button type="button" className={btn} onClick={() => useAppStore.setState({ tourStep: null, playing: false })}>
          Exit (Esc)
        </button>
        <span className="ml-auto text-xs text-ink-muted">
          R resets · <BackupVideo />
        </span>
      </div>
    </section>
  );
}
