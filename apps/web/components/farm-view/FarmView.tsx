"use client";
// Shared farm chrome. Twin-only content remains guarded by simProps/twinConfig.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CONDITIONS, LAYERS, EXPLORE_SUBTITLE, type ConditionId } from "@/lib/farm-view/sample";
import { twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";
import { decodeShare, sharePanelState } from "@/lib/share";
import { sound } from "@/lib/ui/sound";
import { DividerHandle } from "@/components/farm/CompareTray";
import {
  cameraActionForKey,
  type CameraAction,
} from "@/lib/farm-view/camera-controls";
import { InvestigationControls } from "./InvestigationControls";
import { FvButton } from "./FvButton";
import {
  SimulationTab,
  useSimKeys,
  type SimProps,
  type SimState,
} from "./SimulationTab";
import { FV_CSS } from "./styles";
import { ComparisonTimeline } from "./Timeline";
import { ConditionCard, LayerLegend } from "./Cards";
import { Twin } from "./Twin";
import { Droplet, Leaf, Thermometer } from "./icons";

const PILL_ICON: Record<ConditionId, typeof Droplet> = { rainfall: Droplet, moisture: Droplet, vigor: Leaf, heat: Thermometer };

export type FarmViewProps = {
  farmName: string;
  place?: string;
  onBack(): void;
  onReset(): void;
  sim?: SimProps;
  zoneControl?: ReactNode;
  onCamera?(action: CameraAction): void;
  initialReportOpen?: boolean;
};
const WORKSPACE_CSS = `
.fv-root.fv-workspace{position:absolute;inset:0;z-index:20;padding:16px;pointer-events:none;color:#f2ebdd;font-size:14px;}
.fv-workspace .fv-panels{display:contents}.fv-workspace .fv-panels[hidden],.fv-workspace .fv-toolbar[hidden]{display:none}
.fv-workspace .fv-toolbar-shell{min-width:0;pointer-events:auto;display:grid;gap:6px;justify-items:start;}
.fv-workspace .fv-heading{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:20px;align-items:start;}
.fv-workspace .fv-title-block{min-width:0;max-width:720px;background:rgba(16,20,18,.86);padding:12px 16px;border-radius:14px;pointer-events:auto;}
.fv-workspace .fv-title{font-size:clamp(24px,2.4vw,36px);line-height:1.15;overflow-wrap:anywhere;}
.fv-workspace .fv-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;align-content:start;pointer-events:auto;max-height:calc(100dvh - 280px);overflow:auto;padding:2px;}
.fv-workspace .fv-bar{height:auto;min-height:40px;flex-wrap:wrap;border-radius:12px;}
.fv-workspace .fv-observations{width:100%;padding:10px 12px;border-radius:12px;font-size:13px;}
.fv-workspace .fv-observations dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
.fv-workspace .fv-observations dt{color:#c9bfae;}.fv-workspace .fv-observations dd{margin:0;}
.fv-workspace .fv-preview{width:100%;position:relative;display:flex;flex-wrap:wrap;gap:6px;}
.fv-workspace .fv-preview .fv-legend{position:relative !important;right:auto !important;bottom:auto !important;width:100%;}
.fv-workspace .fv-preview .fv-card{position:relative !important;top:auto !important;right:auto !important;width:100%;max-height:35vh;overflow:auto;}
.fv-workspace .fv-title-block{animation:fv-title-enter .4s ease-out both;}
@keyframes fv-title-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fv-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.fv-workspace .fv-title-block{animation:none}}
.fv-workspace .fv-zone{width:100%;font-size:12px;}
.fv-workspace .fv-report{position:absolute;left:16px;bottom:70px;max-height:calc(100% - 280px);overflow:auto;width:min(380px,calc(100% - 32px));}
.fv-workspace .fv-field-button{padding:6px 0;text-decoration:underline;text-underline-offset:3px;text-align:left;min-height:36px;}
.fv-workspace .fv-bottom-tools{position:absolute;bottom:24px;right:16px;max-width:min(360px,calc(100% - 32px));pointer-events:auto;display:grid;gap:6px;}
.fv-workspace .fv-restore{position:absolute;left:16px;top:16px;pointer-events:auto;padding:10px 16px;border-radius:12px;}
.fv-workspace button:disabled{opacity:.5;cursor:not-allowed;}.fv-workspace button{min-height:32px;}
.fv-workspace .fv-twinpill,.fv-workspace .fv-answer{max-width:calc(100vw - 32px);}
@media(max-width:700px){.fv-workspace .fv-heading{grid-template-columns:minmax(0,1fr);gap:8px;}.fv-workspace .fv-title-block{max-height:25vh;overflow:auto;}.fv-workspace .fv-toolbar{max-height:40vh;overflow:auto;align-content:start;}}
@media(min-width:701px) and (max-width:1000px){.fv-workspace .fv-heading{grid-template-columns:minmax(0,1fr) 300px;gap:10px;}.fv-workspace .fv-title-block{padding:10px;}.fv-workspace .fv-title{font-size:24px;}.fv-workspace .fv-bar{font-size:12px;}.fv-workspace .fv-seg{padding-inline:8px;}}
`;

export function FarmView({
  farmName,
  place,
  onBack,
  onReset,
  sim: simProps,
  zoneControl,
  onCamera,
  initialReportOpen = false,
}: FarmViewProps) {
  const reduced = !!useReducedMotion();
  const [reportOpen, setReportOpen] = useState(initialReportOpen);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [sim, setSimState] = useState<SimState>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    return decodeShare(hash)?.farm === useAppStore.getState().farmId
      ? sharePanelState(hash)
      : { open: false, section: "scenarios" };
  });
  const reportBefore = useRef(false);
  const panelsHidden = useAppStore((s) => s.panelsHidden);
  const restorePanels = useRef<HTMLButtonElement>(null);
  const hidePanels = useRef<HTMLButtonElement>(null);
  const previousPanelsHidden = useRef(panelsHidden);
  useEffect(() => {
    if (previousPanelsHidden.current !== panelsHidden) {
      (panelsHidden ? restorePanels : hidePanels).current?.focus();
      previousPanelsHidden.current = panelsHidden;
    }
  }, [panelsHidden]);
  const comparing = useAppStore((s) => s.twinMode === "compare");
  const farmId = useAppStore((s) => s.farmId);
  // Preserve upstream explore-only entry fix: absence of a twin is supported here.
  const twin = twinConfig(farmId);
  const [card, setCard] = useState<ConditionId | null>(null);
  useEffect(() => {
    if (!card) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setCard(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card]);
  const [muted, setMuted] = useState(() => sound.isMuted());
  const setSim = (next: SimState) => {
    if (next.open && !sim.open) {
      reportBefore.current = reportOpen;
      setReportOpen(false);
    }
    if (!next.open && sim.open) setReportOpen(reportBefore.current);
    setSimState(next);
  };
  useSimKeys(sim, setSim, !!simProps);
  useEffect(() => sound.installUnlock(), []);
  useEffect(() => {
    if (simProps) return;
    const togglePanels = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open]')) return;
      if (event.key.toLowerCase() === 'h') useAppStore.setState(state => ({panelsHidden: !state.panelsHidden}));
    };
    window.addEventListener('keydown', togglePanels);
    return () => window.removeEventListener('keydown', togglePanels);
  }, [simProps]);
  const selectField = (id: string) => {
    useAppStore.setState({ twinFieldId: id });
    setSim({ open: true, section: "field" });
  };
  return (
    <div className="fv-root fv-workspace" data-testid="farm-view">
      <style>{FV_CSS + WORKSPACE_CSS}</style>
      {panelsHidden && (
        <FvButton
          ref={restorePanels}
          className="fv-glass fv-restore"
          onClick={() => useAppStore.setState({ panelsHidden: false })}
        >
          Show panels
        </FvButton>
      )}
      <div className="fv-panels" hidden={panelsHidden}>
          <div className="fv-heading">
            <div className="fv-title-block">
              <FvButton
                className="fv-back"
                aria-label="Back to the globe"
                data-testid="back-to-globe"
                onClick={onBack}
              >
                ← Globe
              </FvButton>
              <FvButton ref={hidePanels} className="fv-glass fv-seg" onClick={() => useAppStore.setState({ panelsHidden: true })}>Hide panels</FvButton>
              <h1 className="fv-title">{farmName}</h1>
              <p className="fv-sub">
                {place}
                {place ? " · " : ""}
                {simProps ? "Simulation available" : EXPLORE_SUBTITLE}
              </p>
              {simProps && twin && (
                <details className="fv-cap" style={{ marginTop: 8 }}>
                  <summary>Approximate outlines · illustrative crops</summary>
                  <p>{[...twin.labels, ...twin.attribution].join(" · ")}</p>
                </details>
              )}
              {simProps && (
                <SimulationTab props={simProps} sim={sim} setSim={setSim} />
              )}
            </div>
            <div className="fv-toolbar-shell">
              <FvButton className="fv-glass fv-seg" aria-expanded={toolbarOpen} aria-controls="farm-controls" onClick={() => setToolbarOpen(!toolbarOpen)}>{toolbarOpen ? "Hide farm controls" : "Show farm controls"}</FvButton>
            <div id="farm-controls" className="fv-toolbar" hidden={!toolbarOpen}>
              <div
                className="fv-glass fv-bar"
                role="radiogroup"
                aria-label="Map layer"
                aria-describedby="layer-unavailable"
              >
                {LAYERS.map((l) => (
                  <FvButton
                    key={l.id}
                    disabled={l.id !== "satellite"}
                    className="fv-seg"
                    role="radio"
                    aria-checked={l.id === "satellite"}
                    data-testid={`layer-${l.id}`}
                    title={
                      l.id === "satellite"
                        ? "Surface imagery"
                        : "Unavailable: no observations connected"
                    }
                  >
                    {l.label}
                  </FvButton>
                ))}
              </div>
              <span
                id="layer-unavailable"
                className="fv-glass"
                style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12 }}
              >
                Analytical layers unavailable: no observations connected.
              </span>
              <FvButton
                className="fv-glass fv-seg"
                aria-label="Reset camera"
                data-testid="reset-view"
                onClick={onReset}
              >
                Reset camera
              </FvButton>
              <FvButton
                className="fv-glass fv-seg"
                data-testid="mute-toggle"
                onClick={() => {
                  sound.setMuted(!muted);
                  setMuted(!muted);
                }}
              >
                {muted ? "Unmute sounds" : "Mute sounds"}
              </FvButton>
              <details className="fv-glass fv-observations">
                <summary>Farm observations: Not available</summary>
                <dl>
                  {CONDITIONS.map((c) => (
                    <div key={c.id}>
                      <dt>{c.label}</dt>
                      <dd data-testid={`condition-value-${c.id}`}>
                        Not available
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  No dated farm observations are connected. Simulation inputs
                  are synthetic.
                </p>
              </details>
              <div className="fv-preview" aria-label="Synthetic condition preview">
                <span className="fv-cap" style={{ width: "100%" }}>Synthetic preview · not this farm’s measurements</span>
                {CONDITIONS.map((c) => {
                  const Icon = PILL_ICON[c.id];
                  return <FvButton key={c.id} className="fv-glass fv-pill" data-testid={`condition-pill-${c.id}`}
                    aria-expanded={card === c.id} aria-controls={`condition-card-${c.id}`}
                    onClick={() => setCard(card === c.id ? null : c.id)}>
                    <Icon size={16} /><span className="l">{c.label}</span>
                  </FvButton>;
                })}
                <AnimatePresence>{card && <ConditionCard key={card} id={card} onClose={() => setCard(null)} />}</AnimatePresence>
                <AnimatePresence>{(card === "vigor" || card === "moisture") && <LayerLegend key={card} layer={card} />}</AnimatePresence>
              </div>
              {zoneControl && (
                <div
                  className="fv-zone fv-glass"
                  style={{ padding: 8, borderRadius: 12 }}
                >
                  {zoneControl}
                </div>
              )}
            </div>
            </div>
          </div>
          {!sim.open && (
            <FvButton
              className="fv-glass fv-seg fv-auto"
              style={{
                position: "absolute",
                left: 16,
                bottom: comparing ? 104 : 32,
              }}
              aria-expanded={reportOpen}
              aria-label={
                reportOpen ? "Collapse field report" : "Expand field report"
              }
              data-testid="field-report-toggle"
              onClick={() => setReportOpen(!reportOpen)}
            >
              Field report {reportOpen ? "−" : "+"}
            </FvButton>
          )}
          <AnimatePresence>{reportOpen && !sim.open && (
            <motion.section
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fv-glass fv-report fv-auto"
              style={comparing ? { bottom: 150 } : undefined}
              data-testid="field-report"
              aria-label="Field report"
            >
              <h2 className="fv-rtitle">Field report</h2>
              <p>No field measurements for this farm yet.</p>
              {simProps ? (
                <table className="fv-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simProps.fields.map((f) => (
                      <tr key={f.id} data-testid={`field-report-row-${f.id}`}>
                        <td>
                          <button
                            type="button"
                            className="fv-field-button"
                            onClick={() => selectField(f.id)}
                          >
                            {f.name}
                          </button>
                        </td>
                        <td>Not available</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>
                  Field-level data is not available for this explore-only farm.
                </p>
              )}
            </motion.section>
          )}</AnimatePresence>
          <Twin bottom={comparing ? 110 : undefined} />
          {simProps && comparing && (
            <>
              <DividerHandle />
              <ComparisonTimeline />
            </>
          )}
          <div
            className="fv-bottom-tools"
            style={comparing ? { bottom: 104 } : undefined}
          >
            {onCamera && (
              <details
                className="fv-glass"
                style={{ padding: 10, borderRadius: 12 }}
              >
                <summary>Camera controls</summary>
                <div
                  role="group"
                  aria-label="Camera controls"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const action = cameraActionForKey(e.key, e.shiftKey);
                    if (action) {
                      e.preventDefault();
                      onCamera(action);
                    }
                  }}
                >
                  <p style={{ fontSize: 12 }}>
                    Focus this group: arrows pan, Shift + arrows orbit, + / −
                    zoom.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(
                      [
                        "pan-left",
                        "pan-right",
                        "pan-up",
                        "pan-down",
                        "orbit-left",
                        "orbit-right",
                        "zoom-in",
                        "zoom-out",
                      ] as CameraAction[]
                    ).map((a) => (
                      <button
                        className="fv-seg"
                        type="button"
                        key={a}
                        onClick={() => onCamera(a)}
                      >
                        {a.replace("-", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </details>
            )}
            <InvestigationControls simulationAvailable={!!simProps} />
          </div>
      </div>
      <p className="sr-only">
        {reduced ? "Reduced motion enabled." : ""}This tool supports, and does
        not replace, local agronomic expertise.
      </p>
    </div>
  );
}
