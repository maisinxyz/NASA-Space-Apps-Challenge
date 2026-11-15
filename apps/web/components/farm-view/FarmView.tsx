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
import { FutureLayer, FUTURE_CSS } from "@/components/farm-future/FutureLayer";
import { FuturePills, LensControl, ModeSwitch } from "@/components/farm-future/Controls";
import { FutureTimeline } from "@/components/farm-future/FutureTimeline";
import { MapEffects } from "@/components/farm-future/MapEffects";
import { StrategyBar } from "@/components/farm-future/SoilHealth";
import { useFutureStore } from "@/lib/farm-future/store";
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
  initialSim?: SimState;
  initialPanelsHidden?: boolean;
};
const WORKSPACE_CSS = `
.fv-root.fv-workspace{position:absolute;inset:0;z-index:20;padding:16px;pointer-events:none;color:#f2ebdd;font-size:14px;}
.fv-workspace .fv-panels,.fv-workspace .fv-mode-content{display:contents}.fv-workspace .fv-mode-content[hidden]{display:none}.fv-workspace .fv-panels[hidden],.fv-workspace .fv-toolbar[hidden]{display:none}
.fv-workspace .fv-toolbar-shell{min-width:0;width:100%;max-width:360px;justify-self:end;pointer-events:auto;display:flex;flex-direction:column;gap:8px;}
.fv-workspace .fv-control-content{min-width:0;width:100%;display:flex;flex-direction:column;gap:8px;}
.fv-workspace .fv-control-content[hidden]{display:none}
.fv-workspace .fv-heading[hidden]{display:none}.fv-workspace .fv-heading{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,360px);gap:20px;align-items:start;}
.fv-workspace .fv-title-block{min-width:0;max-width:720px;background:rgba(16,20,18,.86);padding:14px 18px;border-radius:16px;pointer-events:auto;box-shadow:0 8px 32px rgba(0,0,0,0.36);}
.fv-workspace .fv-title{font-size:clamp(24px,2.4vw,36px);line-height:1.15;overflow-wrap:anywhere;}
.fv-workspace .fv-toolbar{display:flex;flex-direction:column;gap:10px;align-items:stretch;width:100%;pointer-events:auto;max-height:calc(100dvh - 200px);overflow-y:auto;padding:2px;}

/* Polished Dock Cards */
.fv-workspace .fv-dock-card{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:14px;background:rgba(22,18,15,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(242,235,221,0.12);box-shadow:0 8px 24px rgba(0,0,0,0.28);}
.fv-workspace .fv-bar{height:auto;min-height:38px;display:flex;align-items:center;justify-content:space-between;border-radius:10px;padding:3px;background:rgba(12,10,8,0.6);border:1px solid rgba(242,235,221,0.08);}
.fv-workspace .fv-bar .fv-seg{flex:1;justify-content:center;text-align:center;padding:0 8px;height:30px;font-size:12.5px;}
.fv-workspace .fv-util-row{display:flex;gap:6px;align-items:center;}
.fv-workspace .fv-util-row .fv-seg{flex:1;justify-content:center;height:32px;font-size:12px;border-radius:8px;}
.fv-workspace .fv-status-badge{font-size:11.5px;line-height:1.4;color:#c9bfae;padding:6px 10px;border-radius:8px;background:rgba(242,235,221,0.05);border:1px solid rgba(242,235,221,0.08);display:flex;align-items:center;gap:6px;}

/* Condition Stack (Rainfall, Soil moisture, Crop vigor, Heat) aligned on side of screen */
.fv-workspace .fv-preview{width:100%;position:relative;display:flex;flex-direction:column;gap:8px;}
.fv-workspace .fv-preview-header{display:flex;align-items:center;justify-content:space-between;padding:0 4px;}
.fv-workspace .fv-preview-label{font-size:11.5px;color:#c9bfae;letter-spacing:0.02em;}
.fv-workspace .fv-condition-col{display:flex;flex-direction:column;gap:6px;width:100%;}
.fv-workspace .fv-condition-bar{display:flex !important;align-items:center;justify-content:space-between;width:100%;height:38px;padding:0 14px !important;border-radius:10px;background:rgba(27,22,18,0.75);transition:all 120ms ease;cursor:pointer;}
.fv-workspace .fv-condition-bar:hover{background:rgba(242,235,221,0.12);border-color:rgba(242,235,221,0.24);}
.fv-workspace .fv-condition-bar[aria-expanded="true"]{background:rgba(242,235,221,0.16);border-color:rgba(242,235,221,0.32);}
.fv-workspace .fv-condition-bar-left{display:flex;align-items:center;gap:10px;}
.fv-workspace .fv-condition-bar-left .l{font-size:13px;font-weight:500;color:#f2ebdd;}
.fv-workspace .fv-condition-badge{font-size:10.5px;color:#c9bfae;padding:2px 7px;border-radius:6px;background:rgba(242,235,221,0.08);border:1px solid rgba(242,235,221,0.08);text-transform:uppercase;letter-spacing:0.04em;}
.fv-workspace .fv-preview .fv-legend{position:relative !important;right:auto !important;bottom:auto !important;width:100%;margin-top:6px;}
.fv-workspace .fv-preview .fv-card{position:relative !important;top:auto !important;right:auto !important;width:100%;max-height:35vh;overflow:auto;margin-top:6px;}

/* Observations Accordion */
.fv-workspace .fv-observations{width:100%;border-radius:12px;padding:10px 14px;font-size:13px;background:rgba(22,18,15,0.75);border:1px solid rgba(242,235,221,0.1);}
.fv-workspace .fv-observations summary{cursor:pointer;font-weight:500;color:#f2ebdd;outline:none;}
.fv-workspace .fv-observations dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:10px 0 6px;}
.fv-workspace .fv-observations dt{color:#c9bfae;font-size:12px;}
.fv-workspace .fv-observations dd{margin:0;font-size:12px;font-weight:500;}
.fv-workspace .fv-observations p{margin:6px 0 0;font-size:11.5px;color:#c9bfae;line-height:1.4;}

.fv-workspace .fv-title-block{animation:fv-title-enter .4s ease-out both;}
@keyframes fv-title-enter{from{opacity:0}to{opacity:1}}
@keyframes fv-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.fv-workspace .fv-title-block{animation:none}}
.fv-workspace .fv-zone{width:100%;font-size:12px;}
.fv-workspace .fv-report{position:absolute;left:16px;bottom:70px;max-height:calc(100% - 280px);overflow:auto;width:min(380px,calc(100% - 32px));}
.fv-workspace .fv-field-button{padding:6px 0;text-decoration:underline;text-underline-offset:3px;text-align:left;min-height:36px;}
.fv-workspace .fv-bottom-tools{position:absolute;bottom:24px;right:16px;max-width:min(360px,calc(100% - 32px));pointer-events:auto;display:grid;gap:6px;}
.fv-workspace .fv-restore{position:absolute;left:16px;top:16px;pointer-events:auto;padding:10px 16px;border-radius:12px;}
.fv-workspace button:disabled{opacity:.5;cursor:not-allowed;}.fv-workspace button{min-height:32px;}
.fv-workspace .fv-twinpill,.fv-workspace .fv-answer{max-width:calc(100vw - 32px);}
@media(max-width:700px){.fv-workspace .fv-heading{grid-template-columns:minmax(0,1fr);gap:8px;}.fv-workspace .fv-title-block{max-height:25vh;overflow:auto;}.fv-workspace .fv-toolbar{max-height:40vh;overflow:auto;}}
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
  initialSim,
  initialPanelsHidden,
}: FarmViewProps) {
  const reduced = !!useReducedMotion();
  const [reportOpen, setReportOpen] = useState(initialReportOpen);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [sim, setSimState] = useState<SimState>(() => {
    if (initialSim) return initialSim;
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    return decodeShare(hash)?.farm === useAppStore.getState().farmId
      ? sharePanelState(hash)
      : { open: false, section: "scenarios" };
  });
  const reportBefore = useRef(false);
  const storePanelsHidden = useAppStore((s) => s.panelsHidden);
  const panelsHidden = initialPanelsHidden ?? storePanelsHidden;
  const restorePanels = useRef<HTMLButtonElement>(null);
  const hidePanels = useRef<HTMLButtonElement>(null);
  const previousPanelsHidden = useRef(panelsHidden);
  useEffect(() => {
    if (previousPanelsHidden.current !== panelsHidden) {
      (panelsHidden ? restorePanels : hidePanels).current?.focus();
      previousPanelsHidden.current = panelsHidden;
    }
  }, [panelsHidden]);
  const futureMode = useFutureStore((s) => s.mode);
  const reviewFor = useFutureStore((s) => s.reviewFor);
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
  useSimKeys(sim, setSim, !!simProps && futureMode === "now");
  useEffect(() => sound.installUnlock(), []);
  useEffect(() => {
    if (simProps && futureMode === "now") return;
    const togglePanels = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open]')) return;
      if (event.key.toLowerCase() === 'h') useAppStore.setState(state => ({panelsHidden: !state.panelsHidden}));
    };
    window.addEventListener('keydown', togglePanels);
    return () => window.removeEventListener('keydown', togglePanels);
  }, [simProps, futureMode]);
  const selectField = (id: string) => {
    useAppStore.setState({ twinFieldId: id });
    setSim({ open: true, section: "field" });
  };
  return (
    <div className="fv-root fv-workspace" data-testid="farm-view">
      <style>{FV_CSS + FUTURE_CSS + WORKSPACE_CSS}</style>
      <MapEffects />
      {panelsHidden && (
        <FvButton
          ref={restorePanels}
          data-testid="show-panels"
          aria-keyshortcuts="H"
          className="fv-glass fv-restore"
          onClick={() => useAppStore.setState({ panelsHidden: false })}
        >
          Show panels
        </FvButton>
      )}
      <div className="fv-panels" hidden={panelsHidden}>
          {futureMode === "compare" && <FvButton ref={futureMode === "compare" ? undefined : hidePanels} className="fv-glass fv-seg" style={{ position: "absolute", right: 16, top: 16, pointerEvents: "auto" }} onClick={() => useAppStore.setState({ panelsHidden: true })}>Hide panels</FvButton>}
          <div className="fv-heading" hidden={futureMode === "compare"}>
            <div className="fv-title-block">
              <FvButton
                className="fv-back"
                aria-label="Back to the globe"
                data-testid="back-to-globe"
                onClick={onBack}
              >
                ← Globe
              </FvButton>
              <FvButton ref={futureMode === "compare" ? undefined : hidePanels} className="fv-glass fv-seg" onClick={() => useAppStore.setState({ panelsHidden: true })}>Hide panels</FvButton>
              <h1 className="fv-title">{farmName}</h1>
              <p className="fv-sub">
                {place}
                {place ? " · " : ""}
                {simProps ? "Simulation available" : EXPLORE_SUBTITLE}
              </p>
              <ModeSwitch />
              {futureMode === "future" && <StrategyBar />}
              {simProps && twin && (
                <details className="fv-cap" style={{ marginTop: 8 }}>
                  <summary>Approximate outlines · illustrative crops</summary>
                  <p>{[...twin.labels, ...twin.attribution].join(" · ")}</p>
                </details>
              )}
              {simProps && <div hidden={futureMode !== "now"}><SimulationTab props={simProps} sim={sim} setSim={setSim} /></div>}
            </div>
            <div className="fv-toolbar-shell">
              <FvButton className="fv-glass fv-seg" aria-expanded={toolbarOpen} aria-controls="farm-controls" onClick={() => setToolbarOpen(!toolbarOpen)}>{toolbarOpen ? "Hide farm controls" : "Show farm controls"}</FvButton>
            <div id="farm-controls" className="fv-control-content" hidden={!toolbarOpen}>
              {futureMode === "future" && <LensControl />}
            <div className="fv-toolbar">
              {futureMode === "future" && <FuturePills />}
              <div className="fv-mode-content" hidden={futureMode !== "now"}>

              {/* ── Polished Map Layer & Control Dock ── */}
              <div className="fv-dock-card">
                <div
                  className="fv-bar"
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
                  className="fv-status-badge"
                >
                  <span className="fv-dot" aria-hidden />
                  Analytical layers unavailable: no observations connected.
                </span>
                <div className="fv-util-row">
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
                </div>
              </div>

              {/* ── Environmental Condition Bars (Rainfall, Soil moisture, Crop vigor, Heat) ── */}
              <div className="fv-preview" aria-label="Synthetic condition preview">
                <div className="fv-preview-header">
                  <span className="fv-cap fv-preview-label">Synthetic preview · not this farm’s measurements</span>
                </div>
                <div className="fv-condition-col">
                  {CONDITIONS.map((c) => {
                    const Icon = PILL_ICON[c.id];
                    return (
                      <FvButton
                        key={c.id}
                        className="fv-glass fv-pill fv-condition-bar"
                        data-testid={`condition-pill-${c.id}`}
                        aria-expanded={card === c.id}
                        aria-controls={`condition-card-${c.id}`}
                        onClick={() => setCard(card === c.id ? null : c.id)}
                      >
                        <div className="fv-condition-bar-left">
                          <Icon size={16} />
                          <span className="l">{c.label}</span>
                        </div>
                        <span className="fv-condition-badge">Preview</span>
                      </FvButton>
                    );
                  })}
                </div>
                <AnimatePresence>{card && <ConditionCard key={card} id={card} onClose={() => setCard(null)} />}</AnimatePresence>
                <AnimatePresence>{(card === "vigor" || card === "moisture") && <LayerLegend key={card} layer={card} />}</AnimatePresence>
              </div>

              {/* ── Farm Observations Accordion ── */}
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

              {/* ── Vulnerability Zone Control ── */}
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
            </div>
          </div>
          <div className="fv-mode-content" hidden={futureMode !== "now"}>
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
          {futureMode !== "now" && <FutureTimeline reduced={reduced} right={futureMode === "compare" && reviewFor ? 400 : 40} />}
          <FutureLayer />
      </div>
      <p className="sr-only">
        {reduced ? "Reduced motion enabled." : ""}This tool supports, and does
        not replace, local agronomic expertise.
      </p>
    </div>
  );
}
