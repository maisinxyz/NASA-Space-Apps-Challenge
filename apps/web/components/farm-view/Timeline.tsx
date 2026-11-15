"use client";
// Bottom timeline: big month + date line, a thin track with month ticks, a draggable handle (spec: TIMELINE).
// Behaviour lives in lib/farm-view/timeline.ts and use-timeline.ts.
import { useEffect, useRef, useState } from "react";

import { useAppStore } from "@/lib/store";
import { INITIAL_DAY } from "@/lib/farm-view/sample";
import { color, layout, motion as m, shadow } from "@/lib/farm-view/tokens";
import { LAST_DAY, MONTH_NAMES, MONTH_STARTS } from "@/lib/farm-view/timeline";
import { useTimeline } from "@/lib/farm-view/use-timeline";

const L = layout.timeline;
const monthX = (d: number, w: number) => (d / LAST_DAY) * w;

export function Timeline({
  reduced,
  onDayChange,
}: {
  reduced: boolean;
  onDayChange?: (day: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1360);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const tl = useTimeline({
    width,
    initialDay: INITIAL_DAY,
    reducedMotion: reduced,
    onDayChange,
  });
  const { handleProps, trackProps, date, x, dragging } = tl;
  const held = dragging && !reduced;
  const edges = [...MONTH_STARTS, LAST_DAY];

  return (
    <div
      data-testid="timeline"
      style={{
        position: "absolute",
        left: L.left,
        right: L.right,
        bottom: 0,
        height: L.trackBottom + L.hitHeight / 2 + 40,
        pointerEvents: "none",
      }}
    >
      <div
        data-testid="date-label"
        className="fv-onmap"
        style={{
          position: "absolute",
          left: 0,
          bottom: L.trackBottom + L.dateBaselineAbove - 8,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span className="fv-month">{date.monthName}</span>
        <span className="fv-meta">{`${date.dayOfMonth} · ${date.season} · week ${date.week}`}</span>
      </div>
      <div
        ref={wrap}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: L.trackBottom - L.hitHeight / 2,
          height: L.hitHeight,
        }}
      >
        <div
          data-testid="timeline-track"
          {...trackProps}
          className="fv-auto"
          style={{
            position: "absolute",
            inset: 0,
            cursor: "pointer",
            touchAction: "none",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: L.hitHeight / 2 - L.track / 2,
              height: L.track,
              borderRadius: 1,
              background: color.trackFuture,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              width: x,
              top: L.hitHeight / 2 - L.track / 2,
              height: L.track,
              borderRadius: 1,
              background: color.trackPast,
            }}
          />
          {edges.map((d, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                left: monthX(d, width),
                top: L.hitHeight / 2,
                width: 1,
                height: L.tickHeight,
                background: color.tick,
              }}
            />
          ))}
          {MONTH_NAMES.map((name, i) => {
            const mid = (MONTH_STARTS[i] + (edges[i + 1] ?? LAST_DAY)) / 2;
            return (
              <span
                key={name}
                aria-hidden
                className="fv-mtick fv-onmap"
                data-sel={i === date.month}
                style={{
                  left: monthX(mid, width),
                  top: L.hitHeight / 2 + 27 - 8,
                }}
              >
                {name.slice(0, 3)}
              </span>
            );
          })}
          <div
            {...handleProps}
            data-testid="timeline-handle"
            aria-valuemin={1}
            aria-valuemax={365}
            aria-valuenow={Math.round(tl.day) + 1}
            className="fv-auto"
            style={{
              position: "absolute",
              left: x - 22,
              top: 0,
              width: 44,
              height: L.hitHeight,
              display: "grid",
              placeItems: "center",
              cursor: held ? "grabbing" : "grab",
              touchAction: "none",
              outlineOffset: -4,
            }}
          >
            <span
              aria-hidden
              style={{
                width: L.handle,
                height: L.handle,
                borderRadius: "50%",
                background: color.trackPast,
                boxShadow: held ? shadow.handleHaloHeld : shadow.handleHalo,
                transform: held ? `scale(${m.handleHeldScale})` : "scale(1)",
                transition: reduced
                  ? "none"
                  : "transform 120ms cubic-bezier(0.23,1,0.32,1), box-shadow 120ms",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Comparison month is shared with the rotation calendars; there is no unrelated historical date. */
export function ComparisonTimeline() {
  const month = useAppStore((s) => s.twinMonth);
  const year = useAppStore((s) => s.twinYear);
  return (
    <label
      className="fv-glass fv-auto"
      style={{
        position: "absolute",
        left: 16,
        bottom: 24,
        width: "min(480px,calc(100% - 32px))",
        padding: 12,
        borderRadius: 12,
        display: "grid",
        gap: 6,
      }}
    >
      <span>
        Crop calendar · Year {year + 1} · {MONTH_NAMES[month]}
      </span>
      <input
        aria-label="Comparison crop month"
        data-testid="comparison-month"
        type="range"
        min={0}
        max={11}
        step={1}
        value={month}
        onChange={(e) =>
          useAppStore.setState({ twinMonth: Number(e.target.value) })
        }
      />
    </label>
  );
}
