"use client";
// Farm twin workspace HUD over the full-bleed 3D farm: honesty notes (top centre), "Fields & layers" (left, ≤300 px),
// inspector (right, ≤360 px), Compare tray + split handle, and the bottom command dock. Keys: 1–4 modes, H hide
// panels, Esc close the inspector (R reset lives in TourController). Rendering is Globe.tsx; this file writes the store.
import { useEffect, useState } from "react";

import type { CameraState, CropLook, Farm, FarmField, FarmSurface, LookFilter } from "@/components/globe/types";
import { BasisChip } from "@/components/ui/Provenance";
import { hasModifier, isTextEntry } from "@/lib/keys";
import { TWIN_MODES, type TwinMode, useAppStore } from "@/lib/store";
import { encodeShare, LOOKS } from "@/lib/share";
import { FIELDS_ATTRIBUTION, FIELDS_NOTES } from "@/lib/twin/agassiz";

import { ComparePanel } from "./ComparePanel";
import { CompareTray, DividerHandle } from "./CompareTray";
import { EvidenceBody, ExploreBody, FieldCard, SimulateBody } from "./Inspector";
import { CropSwatch, hudBtn, hudBtnOn, hudSelect, Kbd, Panel } from "./shared";

const MODE_LABEL: Record<TwinMode, string> = { explore: "Explore", simulate: "Simulate", compare: "Compare", evidence: "Evidence" };
const SURFACES: { id: FarmSurface; label: string }[] = [
  { id: "google", label: "Photoreal 3D" },
  { id: "terrain", label: "Terrain only" },
];
const LOOK_LABEL: Record<LookFilter, string> = { none: "None (true colour)", thermal: "Thermal style", vegetation: "Vegetation style", night: "Night style" };

/** Compare and Evidence need the width: the left panel folds away there (the user can open it again). */
export const setMode = (m: TwinMode) => useAppStore.setState({ twinMode: m, leftOpen: m === "explore" || m === "simulate" });

type Props = {
  farm: Farm;
  fields: FarmField[];
  /** Crop shown on each side (A = left/whole map, B = right half in Compare). */
  cropA: Record<string, CropLook> | undefined;
  cropB: Record<string, CropLook> | undefined;
  pending: number;
  onBack(): void;
  onReset(): void;
  getCamera(): CameraState | null;
};

export function TwinPanel({ farm, fields, cropA, cropB, pending, onBack, onReset, getCamera }: Props) {
  const { twinMode: mode, twinFieldId, panelsHidden, leftOpen, rightOpen } = useAppStore();
  const [msg, setMsg] = useState("");
  const field = fields.find((f) => f.id === twinFieldId);
  const compare = mode === "compare";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTextEntry(e.target) || document.querySelector("dialog[open]")) return;
      const s = useAppStore.getState();
      const n = Number(e.key);
      if (n >= 1 && n <= TWIN_MODES.length) setMode(TWIN_MODES[n - 1]);
      else if (e.key === "h" || e.key === "H") useAppStore.setState({ panelsHidden: !s.panelsHidden });
      else if (e.key === "Escape") useAppStore.setState(s.twinFieldId ? { twinFieldId: null } : { rightOpen: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function share() {
    const s = useAppStore.getState();
    const hash = encodeShare({ farm: farm.id, mode: s.twinMode, field: s.twinFieldId, a: s.compareA, b: s.compareB, divider: s.divider, surface: s.twinSurface, look: s.look, camera: getCamera() });
    history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(location.href);
      setMsg("Link copied");
    } catch {
      setMsg("Link is in the address bar");
    }
  }

  const show = !panelsHidden;
  const inspectorTitle = field ? field.name : MODE_LABEL[mode];
  return (
    <>
      {compare && <DividerHandle />}

      {/* Always visible, even with panels hidden: what the fields are, and the OSM credit. */}
      <div className="!pointer-events-none absolute top-3 left-1/2 flex max-w-[calc(100%-44rem)] -translate-x-1/2 flex-wrap justify-center gap-1.5 text-[0.7rem]">
        {FIELDS_NOTES.map((n) => (
          <span key={n} className="glass !rounded-md border-dashed px-2 py-0.5">
            {n}
          </span>
        ))}
        <span className="glass !rounded-md px-2 py-0.5 text-ink-muted">{FIELDS_ATTRIBUTION}</span>
        {pending > 0 && (
          <span role="status" className="glass basis-full !rounded-full px-3 py-0.5 text-center text-xs sm:basis-auto">
            Loading 3D detail…
          </span>
        )}
      </div>

      {show && (
        <Panel title="Fields & layers" open={leftOpen} onToggle={() => useAppStore.setState({ leftOpen: !leftOpen })} className="absolute top-3 left-3 max-h-[calc(100%-8rem)] w-[18.75rem]">
          <LeftBody fields={fields} crops={cropA} />
        </Panel>
      )}

      {show && (
        <Panel
          title={
            field ? (
              <span className="flex items-center gap-2">
                {inspectorTitle}
                <span className="text-xs font-normal text-ink-muted">field</span>
              </span>
            ) : (
              inspectorTitle
            )
          }
          open={rightOpen}
          onToggle={() => useAppStore.setState({ rightOpen: !rightOpen })}
          className="absolute top-3 right-3 max-h-[calc(100%-10rem)] w-[22.5rem]"
        >
          <div id="twin-inspector" tabIndex={-1} className="outline-none">
            {field ? (
              <div className="grid gap-2">
                <button type="button" className={`${hudBtn} w-fit !min-h-6 text-xs`} onClick={() => useAppStore.setState({ twinFieldId: null })}>
                  ← Back to {MODE_LABEL[mode]} <Kbd>Esc</Kbd>
                </button>
                <FieldCard field={field} cropA={cropA?.[field.id] ?? field.crop} cropB={compare ? (cropB?.[field.id] ?? field.crop) : undefined} />
              </div>
            ) : mode === "explore" ? (
              <ExploreBody farm={farm} fieldCount={fields.length} />
            ) : mode === "simulate" ? (
              <SimulateBody />
            ) : compare ? (
              <ComparePanel />
            ) : (
              <EvidenceBody />
            )}
          </div>
        </Panel>
      )}

      {show && compare && <CompareTray className={`absolute bottom-[6.5rem] left-3 mx-auto max-w-[42rem] ${rightOpen ? "right-[24.75rem]" : "right-3"}`} />}

      <nav id="twin-dock" tabIndex={-1} aria-label="Twin commands" className="glass absolute bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-1 p-1.5 whitespace-nowrap">
        <div role="group" aria-label="Mode" className="flex gap-1">
          {TWIN_MODES.map((m, i) => (
            <button key={m} type="button" aria-pressed={mode === m} aria-keyshortcuts={String(i + 1)} onClick={() => setMode(m)} className={mode === m ? hudBtnOn : hudBtn}>
              {MODE_LABEL[m]} <Kbd>{i + 1}</Kbd>
            </button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
        <button type="button" className={hudBtn} aria-keyshortcuts="R" onClick={onReset} title="Reset view (R resets everything)">
          Reset view
        </button>
        <button type="button" className={hudBtn} onClick={onBack}>
          Back to globe
        </button>
        <button type="button" className={hudBtn} onClick={share}>
          Share link
        </button>
        <button type="button" className={hudBtn} aria-pressed={panelsHidden} aria-keyshortcuts="H" onClick={() => useAppStore.setState({ panelsHidden: !panelsHidden })}>
          {panelsHidden ? "Show panels" : "Hide panels"} <Kbd>H</Kbd>
        </button>
        <span aria-live="polite" className={msg ? "px-1.5 text-xs text-accent" : "sr-only"}>
          {msg}
        </span>
      </nav>
    </>
  );
}

function LeftBody({ fields, crops }: { fields: FarmField[]; crops: Record<string, CropLook> | undefined }) {
  const { twinFieldId: fieldId, twinSurface: surface, exaggeration, look } = useAppStore();
  const h = "mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase";
  return (
    <div className="grid gap-4 text-sm">
      <section aria-labelledby="fl-fields">
        <h3 id="fl-fields" className={h}>
          Fields
        </h3>
        <ul className="grid gap-0.5">
          {fields.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={f.id === fieldId}
                onClick={() => useAppStore.setState({ twinFieldId: f.id === fieldId ? null : f.id, rightOpen: true })}
                className={`flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left ${f.id === fieldId ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-white/10"}`}
              >
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-ink-muted">
                  <CropSwatch crop={crops?.[f.id] ?? f.crop} /> · {f.areaHa.toLocaleString("en-US", { maximumFractionDigits: 1 })} ha
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[0.7rem] text-ink-muted">
          Area <BasisChip basis="derived" /> from the mapped outline; crops <BasisChip basis="assumed" /> illustrative.
        </p>
      </section>

      <section aria-labelledby="fl-map" className="grid gap-2">
        <h3 id="fl-map" className={h}>
          Map
        </h3>
        <fieldset className="flex gap-1">
          <legend className="sr-only">Map surface</legend>
          {SURFACES.map((s) => (
            <label key={s.id} className={`${surface === s.id ? hudBtnOn : hudBtn} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent`}>
              <input type="radio" name="twin-surface" className="sr-only" checked={surface === s.id} onChange={() => useAppStore.setState({ twinSurface: s.id })} />
              {s.label}
            </label>
          ))}
        </fieldset>
        <label className="grid grid-cols-[1fr_6rem_2rem] items-center gap-2 text-xs">
          Height exaggeration
          <input type="range" min={1} max={3} step={0.5} value={exaggeration} onChange={(e) => useAppStore.setState({ exaggeration: Number(e.target.value) })} className="accent-accent" />
          <output className="text-right tabular-nums">{exaggeration}×</output>
        </label>
        <p className="-mt-1 text-[0.7rem] text-ink-muted">1× = true scale.</p>
        <label className="grid gap-1 text-xs">
          Look
          <select className={hudSelect} value={look} onChange={(e) => useAppStore.setState({ look: e.target.value as LookFilter })} aria-describedby="look-note">
            {LOOKS.map((l) => (
              <option key={l} value={l}>
                {LOOK_LABEL[l]}
              </option>
            ))}
          </select>
          <span id="look-note" className="text-[0.7rem] text-ink-muted">
            Illustrative styling, not sensor data.
          </span>
        </label>
      </section>

      <fieldset disabled aria-describedby="nasa-note" className="grid gap-1 rounded-md border border-dashed border-white/15 p-2 opacity-70">
        <legend className={`${h} px-1`}>NASA layers</legend>
        <p id="nasa-note" className="text-xs">
          NASA regional context — coming soon
        </p>
      </fieldset>
    </div>
  );
}
