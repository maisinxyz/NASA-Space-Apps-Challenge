"use client";
// Compare mode, bottom tray + on-map divider: rotation A (left of the split) vs B (right), swap, non-drag split
// buttons, the season shown on both sides, and the bare-months calendar. The globe draws the split from `compare`.
import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import { useAppStore } from "@/lib/store";
import { rotationById, type TwinRotation } from "@/lib/twin/rotations";

import { CoverCalendar, hudBtn, hudBtnOn, hudSelect, useTwin } from "./shared";

const sideName = (rotations: TwinRotation[], id: string) => {
  const r = rotationById(rotations, id);
  return r ? (r.isExisting ? "Existing rotation" : r.name) : "";
};

const SPLITS = [
  { label: "Show A", d: 1 },
  { label: "50 / 50", d: 0.5 },
  { label: "Show B", d: 0 },
];

export function CompareTray({ className = "" }: { className?: string }) {
  const { compareA, compareB, divider, twinYear, twinMonth, showCropFills } = useAppStore();
  const { rotations } = useTwin();
  const a = rotationById(rotations, compareA)!;
  const b = rotationById(rotations, compareB)!;
  const years = Math.max(a.years.length, b.years.length);
  const rows = [
    ...a.years.map((months, i) => ({ label: `A · Year ${i + 1}`, months })),
    ...b.years.map((months, i) => ({ label: `B · Year ${i + 1}`, months })),
  ];
  const activeRow = twinYear % a.years.length; // the A row of the chosen year (B rows follow their own length)
  const pick = (side: "compareA" | "compareB", id: string) => {
    const other = side === "compareA" ? compareB : compareA;
    // Picking the other side's rotation swaps them, so A and B never show the same rotation.
    useAppStore.setState(id === other ? { compareA: compareB, compareB: compareA } : { [side]: id });
  };

  return (
    <section aria-label="A/B comparison" className={`glass grid gap-1.5 p-2 text-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {(["compareA", "compareB"] as const).map((side, i) => (
          <label key={side} className="flex items-center gap-1.5">
            <span className="grid size-6 place-items-center rounded bg-white/15 text-xs font-bold">{i ? "B" : "A"}</span>
            <span className="sr-only">Rotation {i ? "B, right of the split" : "A, left of the split"}</span>
            <select className={`${hudSelect} max-w-[11rem]`} value={i ? compareB : compareA} onChange={(e) => pick(side, e.target.value)}>
              {rotations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.isExisting ? `Existing rotation (${r.name})` : r.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className={hudBtn} onClick={() => useAppStore.setState({ compareA: compareB, compareB: compareA })} aria-label="Swap A and B">
          ⇄ Swap
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-xs">
          Fields show
          <select className={hudSelect} value={twinYear % years} onChange={(e) => useAppStore.setState({ twinYear: Number(e.target.value) })}>
            {Array.from({ length: years }, (_, i) => (
              <option key={i} value={i}>
                Year {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <CoverCalendar rows={rows} month={twinMonth} activeRow={activeRow} onPickMonth={(m) => useAppStore.setState({ twinMonth: m })} />
        <div role="group" aria-label="Split position" className="grid gap-1">
          {SPLITS.map((s) => (
            <button key={s.label} type="button" aria-pressed={divider === s.d} className={`${divider === s.d ? hudBtnOn : hudBtn} !min-h-6 justify-center text-xs`} onClick={() => useAppStore.setState({ divider: s.d })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <label className="flex items-center gap-1.5 text-ink">
          <input type="checkbox" checked={showCropFills} onChange={(e) => useAppStore.setState({ showCropFills: e.target.checked })} />
          Show crops on map
        </label>
        <span>Crops are illustrative, not farm records. Hover a field to see its name and crop · in the calendar, outlined = bare soil · fields are staggered by a year</span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" disabled aria-describedby="diff-note" />
          Difference map:
          <span id="diff-note">Difference map appears when a simulation scenario is loaded</span>
        </label>
      </div>
    </section>
  );
}

/**
 * Draggable split handle over the map (A left, B right). Keyboard: arrows move 5 %, Home/End go to the edges.
 * The split buttons in the tray are the non-drag alternative.
 */
export function DividerHandle() {
  const divider = useAppStore((s) => s.divider);
  const { compareA, compareB } = useAppStore();
  const { rotations } = useTwin();
  const root = useRef<HTMLDivElement>(null);
  const set = (d: number) => useAppStore.setState({ divider: Math.round(Math.min(1, Math.max(0, d)) * 1000) / 1000 });

  const move = (e: PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const box = root.current?.parentElement?.getBoundingClientRect();
    if (box) set((e.clientX - box.left) / box.width);
  };
  const onKey = (e: KeyboardEvent) => {
    const next = { ArrowLeft: divider - 0.05, ArrowRight: divider + 0.05, Home: 0, End: 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    set(next);
  };
  // Keep the knob on screen at the edges.
  const x = `${Math.min(98.5, Math.max(1.5, divider * 100))}%`;
  const pct = Math.round(divider * 100);

  return (
    <div ref={root} className="!pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/85 shadow-[0_0_6px_#000]" style={{ left: x }} />
      {divider > 0.04 && (
        <span className="glass absolute top-28 -translate-x-[calc(100%+0.75rem)] px-2 py-0.5 text-xs font-semibold" style={{ left: x }}>
          A · {sideName(rotations, compareA)}
        </span>
      )}
      {divider < 0.96 && (
        <span className="glass absolute top-28 translate-x-3 px-2 py-0.5 text-xs font-semibold" style={{ left: x }}>
          B · {sideName(rotations, compareB)}
        </span>
      )}
      <div
        role="slider"
        tabIndex={0}
        aria-label="A/B split position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`A ${pct} %, B ${100 - pct} %`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={move}
        className="pointer-events-auto absolute top-1/2 grid h-10 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full border border-white/40 bg-[#0e1014]/90 text-xs font-bold text-white"
        style={{ left: x }}
      >
        <span aria-hidden>⇔</span>
      </div>
    </div>
  );
}
