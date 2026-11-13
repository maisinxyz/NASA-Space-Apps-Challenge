"use client";
// Farm twin overlay for "twin" farms in farm view: top bar (back, reset, modes) and a right-docked panel per mode.
// Rendering lives in components/globe/Globe.tsx; this file only writes the store (lib/store.ts).
import { type KeyboardEvent, useId } from "react";

import type { Farm, FarmSurface } from "@/components/globe/types";
import { EvidenceCardView } from "@/components/lab/EvidenceCardView";
import { BasisChip } from "@/components/ui/BasisChip";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { type TwinMode, useAppStore } from "@/lib/store";
import { AGASSIZ_FIELDS, FIELDS_ATTRIBUTION, FIELDS_NOTES, SIM_AREA_LABEL } from "@/lib/twin/agassiz";
import { ROTATIONS } from "@/lib/twin/rotations";
import { SCENARIOS } from "@/lib/twin/scenario";

import { ComparePanel } from "./ComparePanel";
import { CropSwatch } from "./shared";

const MODES: { id: TwinMode; label: string }[] = [
  { id: "explore", label: "Explore" },
  { id: "simulate", label: "Simulate" },
  { id: "compare", label: "Compare" },
  { id: "evidence", label: "Evidence" },
];
const WIDTH: Record<TwinMode, string> = { explore: "w-[22rem]", simulate: "w-[22rem]", compare: "w-[44rem]", evidence: "w-[30rem]" };
const btn = "rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:bg-line";
const SURFACES: { id: FarmSurface; label: string }[] = [
  { id: "google", label: "Photoreal 3D (Google)" },
  { id: "terrain", label: "Terrain only" },
];

/** The twin's fields for a farm; only Agassiz has one so far. */
export const twinFields = (farmId: string | null) => (farmId === "agassiz" ? AGASSIZ_FIELDS : undefined);

export function TwinPanel({ farm, onBack, onReset }: { farm: Farm; onBack(): void; onReset(): void }) {
  const mode = useAppStore((s) => s.twinMode);
  const base = useId();

  function onKeyDown(e: KeyboardEvent) {
    const i = MODES.findIndex((m) => m.id === mode);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: MODES.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = MODES[(next + MODES.length) % MODES.length].id;
    useAppStore.setState({ twinMode: id });
    document.getElementById(`${base}-${id}`)?.focus();
  }

  return (
    <>
      <div className="absolute top-4 left-4 grid max-w-[calc(100%-47rem)] gap-2 rounded-lg border border-line bg-surface/90 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" className={btn} onClick={onBack}>
            ← Back to globe
          </button>
          <button type="button" className={btn} onClick={onReset}>
            Reset view
          </button>
          <h1 className="font-display text-lg">{farm.name}</h1>
        </div>
        <div role="tablist" aria-label="Twin mode" onKeyDown={onKeyDown} className="flex gap-1">
          {MODES.map((m) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                id={`${base}-${m.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${base}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => useAppStore.setState({ twinMode: m.id })}
                className={`rounded-md px-3 py-1 text-sm ${on ? "bg-accent font-semibold text-accent-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <section
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-${mode}`}
        className={`absolute top-4 right-4 flex max-h-[calc(100%-4.5rem)] max-w-[calc(100%-2rem)] flex-col rounded-lg border border-line bg-surface/95 shadow-lg ${WIDTH[mode]}`}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-xs">
          {FIELDS_NOTES.map((n) => (
            <span key={n} className="rounded border border-dashed border-ink-muted px-1.5 py-px">
              {n}
            </span>
          ))}
        </header>
        <div className="overflow-y-auto p-4">
          {mode === "explore" && <Explore />}
          {mode === "simulate" && <Simulate />}
          {mode === "compare" && <ComparePanel />}
          {mode === "evidence" && <Evidence />}
        </div>
        <footer className="border-t border-line px-4 py-1.5 text-[0.7rem] text-ink-muted">{FIELDS_ATTRIBUTION}</footer>
      </section>
    </>
  );
}

function Explore() {
  const exaggeration = useAppStore((s) => s.exaggeration);
  const surface = useAppStore((s) => s.twinSurface);
  const fieldId = useAppStore((s) => s.twinFieldId);
  const crops = useAppStore((s) => s.twinRotationId);
  const field = AGASSIZ_FIELDS.find((f) => f.id === fieldId);

  return (
    <div className="grid gap-4">
      <section aria-labelledby="layers-h" className="grid gap-2">
        <h2 id="layers-h" className="text-sm font-semibold">
          Layers
        </h2>
        <p className="text-sm">
          <span className="font-semibold">{SIM_AREA_LABEL}</span>
          <span className="block text-xs text-ink-muted">The thin outline on the map marks where simulation layers apply; they only cover this area.</span>
        </p>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <legend className="sr-only">Map surface</legend>
          {SURFACES.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5">
              <input type="radio" name="twin-surface" checked={surface === s.id} onChange={() => useAppStore.setState({ twinSurface: s.id })} className="accent-accent" />
              {s.label}
            </label>
          ))}
        </fieldset>
        <label className="grid grid-cols-[auto_1fr_2.5rem] items-center gap-2 text-sm">
          Vertical exaggeration (1× = true scale)
          <input type="range" min={1} max={3} step={0.5} value={exaggeration} onChange={(e) => useAppStore.setState({ exaggeration: Number(e.target.value) })} className="accent-accent" />
          <output className="text-right tabular-nums">{exaggeration}×</output>
        </label>
      </section>

      <section aria-labelledby="field-h" className="grid gap-2">
        <h2 id="field-h" className="text-sm font-semibold">
          Selected field
        </h2>
        {field ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-line bg-surface-2/60 p-3 text-sm">
            <dt className="text-ink-muted">Name</dt>
            <dd>{field.name}</dd>
            <dt className="text-ink-muted">Area</dt>
            <dd>
              {field.areaHa.toLocaleString("en", { maximumFractionDigits: 1 })} ha <BasisChip basis="derived" />
            </dd>
            <dt className="text-ink-muted">Crop now</dt>
            <dd>
              <CropSwatch crop={field.crop} /> <BasisChip basis="assumed" />
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">Click a field on the map or pick one below.</p>
        )}
        <ul className="grid gap-1">
          {AGASSIZ_FIELDS.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={f.id === fieldId}
                onClick={() => useAppStore.setState({ twinFieldId: f.id === fieldId ? null : f.id })}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${f.id === fieldId ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-surface-2"}`}
              >
                <span>{f.name}</span>
                <span className="text-xs text-ink-muted">
                  <CropSwatch crop={f.crop} /> · {Math.round(f.areaHa)} ha
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">Area is computed from the mapped outline. Crops are illustrative{crops ? "; the map currently shows a rotation (see Compare)" : ""}.</p>
      </section>
    </div>
  );
}

const off = "rounded border border-line bg-surface-2 px-2 py-0.5 text-sm opacity-50";

function Simulate() {
  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-dashed border-line p-4 text-center">
        <p className="font-semibold">Climate scenarios arrive with real NASA data</p>
        <p className="mt-1 text-sm text-ink-muted">Storms, heat, drought and frost will be replayed here once they are built from NASA records for this farm. Nothing is simulated yet.</p>
      </div>
      <fieldset disabled className="grid gap-2" aria-describedby="sim-off">
        <legend className="text-sm font-semibold">Scenario</legend>
        <select className={off} aria-label="Scenario">
          <option>{SCENARIOS.length ? "Choose a scenario" : "No scenarios yet"}</option>
        </select>
        <label className="grid gap-1 text-sm">
          Rotation
          <select className={off}>
            {ROTATIONS.map((r) => (
              <option key={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className={off}>
            Play
          </button>
          <input type="range" aria-label="Scenario time" className="flex-1 opacity-50" />
        </div>
      </fieldset>
      <p id="sim-off" className="text-xs text-ink-muted">
        Controls are disabled until a scenario exists.
      </p>
    </div>
  );
}

function Evidence() {
  return (
    <div className="grid gap-3">
      <p role="note" className="rounded border border-line bg-surface-2 px-2 py-1 text-xs">
        {SUPPORT_SENTENCE}
      </p>
      {ROTATIONS.map((r) => (
        <EvidenceCardView key={r.id} card={r.card} name={`${r.name}${r.isExisting ? " (existing)" : ""}`} />
      ))}
    </div>
  );
}
