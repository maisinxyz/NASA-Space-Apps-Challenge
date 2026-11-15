"use client";
// React binding for TimelineEngine: pointer capture, rAF loop, sound + haptics, keyboard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sound } from "@/lib/ui/sound";
import { TimelineEngine, dateOf, dayToX, strongest, vibrate, type TickEvent } from "./timeline";

export type UseTimelineOpts = {
  width: number;
  initialDay?: number;
  reducedMotion?: boolean;
  /** rAF-throttled: at most one call per frame with the latest day. */
  onDayChange?: (day: number) => void;
};

export function useTimeline({ width, initialDay = 0, reducedMotion = false, onDayChange }: UseTimelineOpts) {
  const [day, setDay] = useState(initialDay);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const pending = useRef<number | null>(null);
  const cb = useRef(onDayChange);
  cb.current = onDayChange;

  const engine = useMemo(() => {
    const pendingTicks: TickEvent[] = [];
    const e = new TimelineEngine({
      width, reducedMotion, initialDay,
      onDay: (d, drag) => { pending.current = d; setDragging(drag); schedule(); },
      onTick: (t) => pendingTicks.push(t),
    });
    // Flush ticks right after each engine call so sound lands with the input event.
    (e as any).flushTicks = () => {
      const s = strongest(pendingTicks.splice(0));
      if (!s) return;
      if (s.kind === "week") sound.tickWeek(); else sound.tickMonth();
      vibrate(s.kind);
    };
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function schedule() {
    if (raf.current) return;
    raf.current = requestAnimationFrame((t) => {
      raf.current = 0;
      if (engine.animating) engine.step(t);
      (engine as any).flushTicks();
      if (pending.current !== null) { const d = pending.current; pending.current = null; setDay(d); cb.current?.(d); }
      if (engine.animating) schedule();
    });
  }

  useEffect(() => { engine.setWidth(width); }, [engine, width]);
  useEffect(() => { engine.reducedMotion = reducedMotion; }, [engine, reducedMotion]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const flush = () => (engine as any).flushTicks();
  const localX = (e: { clientX: number }) => e.clientX - (trackRef.current?.getBoundingClientRect().left ?? 0);

  const handleProps = {
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": "Date",
    "aria-valuemin": 0,
    "aria-valuemax": 364,
    "aria-valuenow": Math.round(day),
    "aria-valuetext": dateOf(day).label,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      sound.unlock();
      engine.pointerDown(localX(e), e.timeStamp); flush(); schedule();
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => { if (engine.dragging) { engine.pointerMove(localX(e), e.timeStamp); flush(); } },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      engine.pointerUp(e.timeStamp); setDragging(false); schedule();
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => { engine.pointerUp(e.timeStamp); setDragging(false); schedule(); },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (engine.key(e.key, e.shiftKey)) { e.preventDefault(); flush(); schedule(); }
    },
  };

  const trackProps = {
    ref: trackRef as React.RefObject<any>,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      sound.unlock();
      engine.clickTrack(localX(e), e.timeStamp); schedule();
    },
  };

  const setDayExternal = useCallback((d: number) => { engine.jump(d); setDay(d); }, [engine]);

  return { day, dragging, date: dateOf(day), x: dayToX(day, width), handleProps, trackProps, setDay: setDayExternal };
}
