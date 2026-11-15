"use client";
// "Simulation" tab for full-twin farms (docs/farm-view/sim-gap.md). Collapsed pill under the title; opens a glass
// card on the left with Scenarios / Compare / Evidence / Map (+ Field when a field is picked). It reuses the old
// twin components and the store; nothing is re-implemented here.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ComparePanel } from "@/components/farm/ComparePanel";
import { CompareTray } from "@/components/farm/CompareTray";
import { EvidenceBody, FieldCard } from "@/components/farm/Inspector";
import { ScenarioClock, SimulateBody } from "@/components/farm/ScenarioPanel";
import { setMode, MapSettings } from "@/components/farm/TwinPanel";
import { twinConfig } from "@/lib/farms";
import type { CameraState, CropLook, Farm, FarmField } from "@/components/globe/types";
import { hasModifier, isTextEntry } from "@/lib/keys";
import { encodeShare } from "@/lib/share";
import { modeForSimulationSection, nextSimulationTab } from "@/lib/simulation-tabs";
import { useAppStore } from "@/lib/store";
import { zIndex } from "@/lib/farm-view/tokens";
import { scenarioById } from "@/lib/twin/scenarios/registry";
import type { RunSource } from "@/lib/twin/scenarios/runSource";
import type { ScenarioFrame } from "@/lib/twin/scenario";
import { SYNTHETIC_BADGE, SYNTHETIC_NOTE } from "@/lib/twin/scenarios/runSource";

import { FvButton } from "./FvButton";
import { ChevronLeft, ChevronRight } from "./icons";
import { sound } from "@/lib/ui/sound";

export type SimSection = "scenarios" | "compare" | "evidence" | "map" | "field";
const SECTIONS: { id: Exclude<SimSection, "field">; label: string }[] = [
  { id: "scenarios", label: "Scenarios" },
  { id: "compare", label: "Compare" },
  { id: "evidence", label: "Evidence" },
  { id: "map", label: "Map" },
];
const MODE_OF: Record<string, "simulate" | "compare" | "evidence"> = { scenarios: "simulate", compare: "compare", evidence: "evidence" };

export type SimProps = {
  farm: Farm;
  fields: FarmField[];
  cropA: Record<string, CropLook> | undefined;
  cropB: Record<string, CropLook> | undefined;
  runSource: RunSource;
  frame: ScenarioFrame | null;
  getCamera(): CameraState | null;
  /** 3D tiles still loading (shown as a status line). */
  pending: number;
};

export type SimState = { open: boolean; section: SimSection };

/** Keys: 1 closes the tab (Explore), 2/3/4 open it on Scenarios/Compare/Evidence, H hides panels, Esc closes. */
export function useSimKeys(sim: SimState, setSim: (s: SimState) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTextEntry(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "1") { setMode("explore"); setSim({ ...sim, open: false }); }
      else if (e.key === "2" || e.key === "3" || e.key === "4") {
        const section = e.key === "2" ? "scenarios" : e.key === "3" ? "compare" : "evidence";
        setMode(MODE_OF[section]);
        setSim({ open: true, section });
      } else if (e.key === "h" || e.key === "H") useAppStore.setState((s) => ({ panelsHidden: !s.panelsHidden }));
      else if (e.key === "Escape" && sim.open && !e.defaultPrevented) {
        e.preventDefault();
        setSim({ ...sim, open: false });
        document.querySelector<HTMLButtonElement>('[data-testid="sim-tab"]')?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, sim, setSim]);
}

export function SimulationTab({ props, sim, setSim, embedded = false }: { props: SimProps; sim: SimState; setSim: (s: SimState) => void; embedded?: boolean }) {
  const { farm, fields, cropA, cropB, runSource, frame, getCamera } = props;
  const mode = useAppStore((s) => s.twinMode);
  const scenarioId = useAppStore((s) => s.scenarioId);
  const playing = useAppStore((s) => s.scenarioPlaying);
  const fieldId = useAppStore((s) => s.twinFieldId);
  const twin = twinConfig(farm?.id ?? null);
  const def = scenarioById(scenarioId);
  const pill = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [top, setTop] = useState(132);
  const [msg, setMsg] = useState("");

  useLayoutEffect(() => {
    const element = pill.current;
    if (!element) return;
    const measure = () => setTop(Math.round(element.getBoundingClientRect().bottom + 8));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const comparing = mode === "compare";
  const fixture = runSource === "fixture";
  const label = comparing ? "Comparing A / B" : def ? def.label : "Simulation";
  const canPlay = !!def && runSource !== "none" && mode === "simulate";

  const choose = (id: SimSection) => {
    const mode = modeForSimulationSection(id);
    if (mode) setMode(mode);
    setSim({ open: true, section: id });
  };
  const close = () => { sound.close(); setSim({ ...sim, open: false }); trigger.current?.focus(); };

  async function share() {
    const s = useAppStore.getState();
    const hash = encodeShare({ farm: farm.id, mode: s.twinMode, field: s.twinFieldId, a: s.compareA, b: s.compareB, divider: s.divider, surface: s.twinSurface, look: s.look, camera: getCamera(), scenario: s.scenarioId, inputs: s.scenarioId ? s.scenarioInputs[s.scenarioId] : undefined, detail: s.detail, scenarioRotation: s.scenarioRotation, scenarioProgress: s.scenarioProgress, twinYear: s.twinYear, twinMonth: s.twinMonth, showCropFills: s.showCropFills, panelsHidden: s.panelsHidden, leftOpen: s.leftOpen, rightOpen: s.rightOpen, panelOpen: sim.open, panelSection: sim.section });
    history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(location.href);
      setMsg("Link copied");
      sound.success();
    } catch {
      setMsg("Link is in the address bar");
    }
  }

  const field = fields.find((f) => f.id === fieldId);
  const section: SimSection = sim.section === "field" && !field ? "scenarios" : sim.section;

  const sections = field ? [...SECTIONS, { id: "field" as const, label: "Field" }] : SECTIONS;

  return (
    <>
      <div ref={pill} className="fv-auto" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, pointerEvents: "none" }}>
        <FvButton
          ref={trigger}
          className="fv-glass fv-pill fv-auto"
          aria-label={sim.open ? "Close simulation" : "Open simulation"}
          aria-expanded={sim.open}
          data-testid="sim-tab"
          onClick={() => (sim.open ? close() : (sound.pop(), choose(section)))}
          style={{ pointerEvents: "auto" }}
        >
          <span className="l" style={{ color: "inherit" }}>{label}</span>
          {sim.open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </FvButton>
        {canPlay && !sim.open && (
          <FvButton className="fv-glass fv-icon" aria-label={playing ? "Pause scenario" : "Play scenario"} data-testid="sim-play" onClick={() => useAppStore.setState({ scenarioPlaying: !playing })} style={{ pointerEvents: "auto", width: 28, height: 28 }}>
            {playing ? "❚❚" : "▶"}
          </FvButton>
        )}
        {fixture && def && (
          <span className="fv-cap" style={{ border: "1px solid #BE8426", borderRadius: 9999, padding: "1px 8px", color: "#F2EBDD", pointerEvents: "auto" }} title={SYNTHETIC_NOTE}>
            {SYNTHETIC_BADGE}
          </span>
        )}
      </div>

      {sim.open && (
        <section
          data-testid="sim-panel"
          aria-label="Simulation"
          className="fv-glass fv-sim fv-auto"
          style={{ position: embedded ? "relative" : "fixed", left: embedded ? undefined : 16, top: embedded ? undefined : top, bottom: embedded ? undefined : 72, width: embedded ? "100%" : Math.min(420, typeof window === "undefined" ? 420 : window.innerWidth - 32), borderRadius: 16, padding: 16, overflowY: "auto", overscrollBehavior: "contain", zIndex: zIndex.report + 5, pointerEvents: "auto" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: -16, background: "rgba(27,22,18,0.96)", margin: "-16px -16px 8px", padding: "16px 16px 8px", zIndex: 2 }}>
            <h2 className="fv-rtitle">Simulation</h2>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span aria-live="polite" className={msg ? "fv-cap" : "sr-only"}>{msg}</span>
              <FvButton className="fv-icon" style={{ width: 28, height: 28 }} aria-label="Copy share link" data-testid="sim-share" onClick={share}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
              </FvButton>
              <FvButton className="fv-icon" style={{ width: 28, height: 28 }} aria-label="Close simulation" data-testid="sim-close" onClick={close}>
                <ChevronLeft size={18} />
              </FvButton>
            </div>
          </div>

          {fixture && section !== "scenarios" && (
            <p className="fv-cap" style={{ margin: "0 0 8px" }}>
              <span style={{ border: "1px solid #BE8426", borderRadius: 9999, padding: "1px 8px", marginRight: 6 }}>{SYNTHETIC_BADGE}</span>
              {SYNTHETIC_NOTE}
            </p>
          )}

          <div role="tablist" aria-label="Simulation section" style={{ display: "flex", gap: 2, marginBottom: 12, flexWrap: "wrap" }}>
            {sections.map((s) => (
              <FvButton key={s.id} id={`sim-tab-${s.id}`} role="tab" aria-selected={section === s.id} aria-controls={`sim-panel-${s.id}`} tabIndex={section === s.id ? 0 : -1} className="fv-seg" data-testid={`sim-section-${s.id}`} onClick={() => choose(s.id)} onKeyDown={(e) => {
                const next = nextSimulationTab(sections.map((item) => item.id), s.id, e.key);
                if (next) { e.preventDefault(); choose(next); document.getElementById(`sim-tab-${next}`)?.focus(); }
              }} style={{ height: 28, padding: "0 12px", ...(section === s.id && { color: "#fff", background: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.35)" }) }}>
                {s.label}
              </FvButton>
            ))}
          </div>

          <div id={`sim-panel-${section}`} role="tabpanel" aria-labelledby={`sim-tab-${section}`} tabIndex={0} className="text-sm">
            {section === "scenarios" && (
              <>
                <SimulateBody runSource={runSource} frame={frame} />
                <ScenarioClock runSource={runSource} className="mt-3" />
              </>
            )}
            {section === "compare" && (
              <div className="grid gap-3">
                <CompareTray mapAvailable={!embedded} />
                <details>
                  <summary className="cursor-pointer text-xs">Rank rotations</summary>
                  <ComparePanel />
                </details>
              </div>
            )}
            {section === "evidence" && <EvidenceBody />}
            {section === "map" && (
              <div className="grid gap-4">
                {embedded ? <p>The interactive map is unavailable in this workspace. Scenario readouts and crop comparisons still work below.</p> : <MapSettings />}
                <FvButton className="fv-seg fv-glass" data-testid="sim-hide-panels" onClick={() => useAppStore.setState((s) => ({ panelsHidden: !s.panelsHidden }))} style={{ justifySelf: "start" }}>
                  Hide panels (H)
                </FvButton>
                <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-ink-muted">About this twin</dt>
                  <dd>{farm.name}, {farm.owner}</dd>
                  <dt className="text-ink-muted">Fields</dt>
                  <dd>{fields.length} shown</dd>
                  <dt className="text-ink-muted">Model area</dt>
                  <dd>{twin?.simAreaLabel ?? "Model area"}; the thin outline on the map marks where simulation layers apply.</dd>
                </dl>
              </div>
            )}
            {section === "field" && field && (
              <div className="grid gap-2">
                <FvButton className="fv-cap" style={{ justifySelf: "start", textDecoration: "underline" }} onClick={() => { useAppStore.setState({ twinFieldId: null }); choose("scenarios"); }}>
                  ‹ Back
                </FvButton>
                <FieldCard field={field} cropA={cropA?.[field.id] ?? field.crop} cropB={comparing ? (cropB?.[field.id] ?? field.crop) : undefined} />
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
