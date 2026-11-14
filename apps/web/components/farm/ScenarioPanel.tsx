"use client";
// Simulate mode UI: scenario cards (right panel), the chosen scenario's panel, and the scenario clock (bottom tray).
// Pure logic (inputs, clock labels) is in lib/twin/scenarios; the ticker that moves the clock is useScenarioRun.
// With no run source (the real twin until the backend exists) everything shows an empty state and nothing renders on the map.
import { useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";

import { BasisChip } from "@/components/ui/Provenance";
import { useAppStore } from "@/lib/store";
import { clampInput, clockLabel, clockSpec, currentStep, resolveInputs, SPEEDS, stepProgress } from "@/lib/twin/scenarios/clock";
import { FAMILY_LABEL, FAMILY_ORDER, SCENARIO_DEFS, scenarioById } from "@/lib/twin/scenarios/registry";
import { EMPTY_RUN_MESSAGE, SYNTHETIC_BADGE, SYNTHETIC_NOTE, type RunSource } from "@/lib/twin/scenarios/runSource";
import { scenarioLegend } from "@/lib/twin/scenarios/legend";
import type { OutputKind, ScenarioDef, ScenarioFamily, ScenarioFrame, ScenarioInput, ScenarioRun, TimeKind } from "@/lib/twin/scenario";

import { ScenarioExtras } from "./scenarios/ScenarioExtras";
import { hudBtn, hudBtnOn, hudSelect, Kbd, useTwin } from "./shared";

const TIME_CHIP: Record<TimeKind, string> = { "event-hours": "Event, hours", "season-months": "Season", "multi-year": "Years", decades: "Decades", static: "Static" };
const OUTPUT_CHIP: Record<OutputKind, string> = { frames: "Animated", zones: "Zones", series: "Series", timeline: "Timeline" };
const chip = "rounded-full border border-white/15 px-1.5 text-[0.65rem] leading-4 text-ink-muted";

/** Small family glyphs (inline SVG, no emoji). */
function Glyph({ family }: { family: ScenarioFamily }) {
  const p = { width: 18, height: 18, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (family) {
    case "rain-water":
      return (
        <svg {...p}>
          <path d="M8 1.8C8 1.8 3.5 7 3.5 10a4.5 4.5 0 009 0C12.5 7 8 1.8 8 1.8z" />
        </svg>
      );
    case "dry-hot":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </svg>
      );
    case "cold":
      return (
        <svg {...p}>
          <path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5" />
        </svg>
      );
    case "seasons-years":
      return (
        <svg {...p}>
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M2 5h12M2 11h12" />
          <circle cx="5.5" cy="5" r="1.6" fill="currentColor" />
          <circle cx="10.5" cy="11" r="1.6" fill="currentColor" />
        </svg>
      );
  }
}

const openScenario = (id: ScenarioDef["id"] | null) => useAppStore.setState({ scenarioId: id, scenarioProgress: 0, scenarioPlaying: false });

export function SimulateBody({ runSource, frame }: { runSource: RunSource; frame: ScenarioFrame | null }) {
  const id = useAppStore((s) => s.scenarioId);
  const def = scenarioById(id);
  return (
    <div className="grid gap-3">
      {runSource === "fixture" && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted" title={SYNTHETIC_NOTE}>
          <span className="rounded-full border border-amber-300/60 bg-amber-300/15 px-2 text-[0.7rem] leading-5 font-semibold text-amber-200">{SYNTHETIC_BADGE}</span>
          {SYNTHETIC_NOTE}
        </p>
      )}
      {def ? <ScenarioDetail def={def} runSource={runSource} frame={frame} /> : <ScenarioCards />}
    </div>
  );
}

function ScenarioCards() {
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-xs text-ink-muted">Pick a scenario. Results are relative comparisons between options, not predictions.</p>
      {FAMILY_ORDER.map((fam) => (
        <section key={fam} aria-labelledby={`fam-${fam}`}>
          <h3 id={`fam-${fam}`} className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <Glyph family={fam} />
            {FAMILY_LABEL[fam]}
          </h3>
          <ul className="grid gap-1.5">
            {SCENARIO_DEFS.filter((d) => d.family === fam).map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => openScenario(d.id)} className="grid w-full gap-1 rounded-md border border-white/15 bg-white/5 p-2 text-left hover:bg-white/15">
                  <span className="font-semibold">{d.label}</span>
                  <span className="text-xs text-ink-muted">{d.summary}</span>
                  <span className="flex flex-wrap gap-1">
                    <span className={chip}>{TIME_CHIP[d.timeKind]}</span>
                    <span className={chip}>{OUTPUT_CHIP[d.outputKind]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ScenarioDetail({ def, runSource, frame }: { def: ScenarioDef; runSource: RunSource; frame: ScenarioFrame | null }) {
  const { rotations } = useTwin();
  const stored = useAppStore((s) => s.scenarioInputs[def.id]);
  const rotation = useAppStore((s) => s.scenarioRotation);
  const inputs = resolveInputs(def, stored);
  const setInput = (i: ScenarioInput, v: number) => useAppStore.setState((s) => ({ scenarioInputs: { ...s.scenarioInputs, [def.id]: { ...s.scenarioInputs[def.id], [i.id]: clampInput(i, v) } } }));
  const resetInputs = () => useAppStore.setState((s) => ({ scenarioInputs: { ...s.scenarioInputs, [def.id]: {} } }));
  const h = "mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase";
  const farmId = useAppStore((s) => s.farmId) ?? "";
  const progress = useAppStore((s) => s.scenarioProgress);
  const run: ScenarioRun = { scenarioId: def.id, farmId, progress, inputs, rotationId: rotation, timeS: 0 };
  // Cover scenarios: key built from the map's colour table for this month; others keep the registry legend.
  const legend = scenarioLegend(def, run) ?? def.legend;

  return (
    <div className="grid gap-3 text-sm">
      <button type="button" className={`${hudBtn} w-fit !min-h-6 text-xs`} onClick={() => openScenario(null)}>
        ← All scenarios
      </button>
      <div>
        <h3 className="flex flex-wrap items-center gap-1.5 text-base font-semibold">
          {def.label}
          <span className={chip}>{TIME_CHIP[def.timeKind]}</span>
          <span className={chip}>{OUTPUT_CHIP[def.outputKind]}</span>
        </h3>
        <p className="mt-1">{def.plainMeaning}</p>
        <p className="mt-1 text-xs text-ink-muted">{def.durationLabel}</p>
      </div>

      {runSource === "none" && (
        <p role="status" className="rounded-md border border-dashed border-white/20 p-2 text-center text-xs">
          {EMPTY_RUN_MESSAGE}
        </p>
      )}

      {def.rotationDependent && (
        <label className="grid gap-1 text-xs">
          Rotation
          <select className={hudSelect} value={rotation} onChange={(e) => useAppStore.setState({ scenarioRotation: e.target.value })}>
            {rotations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.isExisting ? `Existing rotation: ${r.name}` : r.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {def.family !== "seasons-years" && def.timeKind !== "static" && (
        <label className="grid gap-1 text-xs">
          Real event
          <select disabled className={hudSelect}>
            <option>Real events arrive from the backend</option>
          </select>
        </label>
      )}

      {def.inputs.length > 0 && (
        <section aria-labelledby="sc-inputs" className="grid gap-2">
          <div className="flex items-center justify-between">
            <h3 id="sc-inputs" className={h}>
              What if
            </h3>
            <button type="button" className={`${hudBtn} !min-h-6 text-xs`} onClick={resetInputs}>
              Reset inputs
            </button>
          </div>
          {def.inputs.map((i) => (
            <InputRow key={i.id} input={i} value={inputs[i.id]} onChange={(v) => setInput(i, v)} />
          ))}
        </section>
      )}

      <section aria-labelledby="sc-legend">
        <h3 id="sc-legend" className={`${h} flex items-center gap-1.5`}>
          Colour key <BasisChip basis={def.basis} />
        </h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-sm ring-1 ring-white/20" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      </section>

      {frame && frame.readouts.length > 0 && (
        <section aria-labelledby="sc-read">
          <h3 id="sc-read" className={h}>
            Readouts
          </h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-xs">
            {frame.readouts.map((r) => (
              <Readout key={r.label} label={r.label}>
                <span className="font-mono tabular-nums">
                  {r.value}
                  {r.unit ? ` ${r.unit}` : ""}
                </span>{" "}
                <BasisChip basis={r.basis} />
              </Readout>
            ))}
          </dl>
        </section>
      )}

      {/* Wet-spell readout is computed, so it waits for a run (frame); the trends chart has no numbers without a series. */}
      <ScenarioExtras run={def.id === "trends" || frame ? run : null} />

      <p className="rounded-md border border-white/10 p-2 text-xs text-ink-muted">{def.effectCaption}</p>

      <details className="text-xs">
        <summary className="cursor-pointer text-ink-muted">What a real run needs</summary>
        <ul className="mt-1 list-disc pl-4">
          {def.dataNeeds.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </>
  );
}

/** Slider plus minus / number / plus buttons (non-drag ways to set it) and a per-input reset. */
function InputRow({ input: i, value, onChange }: { input: ScenarioInput; value: number; onChange(v: number): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== "") onChange(Number(draft));
    setDraft(null);
  };
  return (
    <div className="grid gap-1 rounded-md border border-white/10 p-2">
      <label className="text-xs font-medium" htmlFor={`in-${i.id}`}>
        {i.label}
      </label>
      <input id={`in-${i.id}`} type="range" min={i.min} max={i.max} step={i.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-accent" aria-valuetext={`${value} ${i.unit}`} />
      <div className="flex items-center gap-1">
        <button type="button" className={`${hudBtn} !px-2`} aria-label={`Decrease ${i.label}`} disabled={value <= i.min} onClick={() => onChange(value - i.step)}>
          −
        </button>
        <input
          type="number"
          aria-label={`${i.label} value`}
          min={i.min}
          max={i.max}
          step={i.step}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="min-h-7 w-16 rounded-md border border-white/15 bg-[#1b1e24] px-1 text-center text-sm tabular-nums"
        />
        <button type="button" className={`${hudBtn} !px-2`} aria-label={`Increase ${i.label}`} disabled={value >= i.max} onClick={() => onChange(value + i.step)}>
          +
        </button>
        <span className="text-xs text-ink-muted">{i.unit}</span>
        <BasisChip basis={i.basis ?? "assumed"} />
        <button type="button" className={`${hudBtn} ml-auto !min-h-6 text-xs`} aria-label={`Reset ${i.label}`} disabled={value === i.default} onClick={() => onChange(i.default)}>
          Reset
        </button>
      </div>
      {i.hint && <p className="text-[0.7rem] text-ink-muted">{i.hint}</p>}
    </div>
  );
}

/** Bottom-tray scenario clock. Without a run source it is shown disabled so the layout is the same. Space toggles play when it has focus. */
export function ScenarioClock({ runSource, className = "" }: { runSource: RunSource; className?: string }) {
  const reduced = !!useReducedMotion();
  const { scenarioId, scenarioInputs, scenarioProgress: progress, scenarioPlaying: playing, scenarioSpeed: speed } = useAppStore();
  const def = scenarioById(scenarioId);
  // Reduced motion: never autoplay, and a run in progress stops.
  useEffect(() => {
    if (reduced) useAppStore.setState({ scenarioPlaying: false });
  }, [reduced]);
  if (!def) return null;

  const spec = clockSpec(def, resolveInputs(def, scenarioInputs[def.id]));
  const off = runSource === "none" || spec.steps <= 0;
  const label = runSource === "none" ? "No run yet" : clockLabel(spec, progress);
  const n = currentStep(spec, progress);
  const set = (p: number) => useAppStore.setState({ scenarioProgress: Math.min(1, Math.max(0, p)) });
  const toggle = () => {
    if (off || reduced) return;
    useAppStore.setState({ scenarioPlaying: !playing, ...(!playing && progress >= 1 && { scenarioProgress: 0 }) });
  };
  const step = (d: number) => useAppStore.setState({ scenarioPlaying: false, scenarioProgress: stepProgress(spec, progress, d) });

  return (
    <div
      role="group"
      aria-label={`Scenario clock: ${def.label}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === " ") {
          e.preventDefault();
          toggle();
        } else if (e.key === "ArrowRight" && !off) step(1);
        else if (e.key === "ArrowLeft" && !off) step(-1);
      }}
      className={`glass flex flex-wrap items-center gap-x-2 gap-y-1 p-2 ${className}`}
    >
      <button type="button" className={hudBtn} disabled={off || reduced} aria-pressed={playing} onClick={toggle} title={reduced ? "Autoplay is off (reduced motion). Use the step buttons or the slider." : undefined}>
        {playing ? "Pause" : "Play"} <Kbd>Space</Kbd>
      </button>
      <button type="button" className={`${hudBtn} !px-2`} disabled={off} aria-label="Step back" onClick={() => step(-1)}>
        ◀
      </button>
      <button type="button" className={`${hudBtn} !px-2`} disabled={off} aria-label="Step forward" onClick={() => step(1)}>
        ▶
      </button>
      <input
        type="range"
        aria-label="Scenario time"
        aria-valuetext={label}
        disabled={off}
        min={1}
        max={Math.max(1, spec.steps)}
        step={1}
        value={Math.max(1, n)}
        onChange={(e) => set((Number(e.target.value) - 0.5) / spec.steps)}
        className="min-w-24 flex-1 accent-accent"
      />
      <output aria-live="off" className="min-w-28 text-sm tabular-nums">
        {label}
      </output>
      <div role="group" aria-label="Speed" className="flex gap-1">
        {SPEEDS.map((v) => (
          <button key={v} type="button" disabled={off} aria-pressed={speed === v} onClick={() => useAppStore.setState({ scenarioSpeed: v })} className={`${speed === v ? hudBtnOn : hudBtn} !px-2`}>
            {v}×
          </button>
        ))}
      </div>
    </div>
  );
}
