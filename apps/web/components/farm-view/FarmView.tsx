"use client";
// Shared farm chrome. Twin-only content remains guarded by simProps/twinConfig.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { CONDITIONS, LAYERS, EXPLORE_SUBTITLE } from "@/lib/farm-view/sample";
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

export type FarmViewProps = {
  farmName: string;
  place?: string;
  onBack(): void;
  onReset(): void;
  sim?: SimProps;
  zoneControl?: ReactNode;
  onCamera?(action: CameraAction): void;
};
const WORKSPACE_CSS = `
.fv-root.fv-workspace{position:absolute;inset:0;z-index:20;padding:16px;pointer-events:none;color:#f2ebdd;font-size:14px;}
.fv-workspace .fv-heading{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:20px;align-items:start;}
.fv-workspace .fv-title-block{min-width:0;max-width:720px;background:rgba(16,20,18,.86);padding:12px 16px;border-radius:14px;pointer-events:auto;}
.fv-workspace .fv-title{font-size:clamp(24px,2.4vw,36px);line-height:1.15;overflow-wrap:anywhere;}
.fv-workspace .fv-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;pointer-events:auto;}
.fv-workspace .fv-bar{height:auto;min-height:40px;flex-wrap:wrap;border-radius:12px;}
.fv-workspace .fv-observations{width:100%;padding:10px 12px;border-radius:12px;font-size:13px;}
.fv-workspace .fv-observations dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
.fv-workspace .fv-observations dt{color:#c9bfae;}.fv-workspace .fv-observations dd{margin:0;}
.fv-workspace .fv-zone{width:100%;font-size:12px;}
.fv-workspace .fv-report{position:absolute;left:16px;bottom:70px;max-height:calc(100% - 280px);overflow:auto;width:min(380px,calc(100% - 32px));}
.fv-workspace .fv-field-button{padding:6px 0;text-decoration:underline;text-underline-offset:3px;text-align:left;min-height:36px;}
.fv-workspace .fv-bottom-tools{position:absolute;bottom:24px;right:16px;max-width:min(360px,calc(100% - 32px));pointer-events:auto;display:grid;gap:6px;}
.fv-workspace .fv-restore{position:absolute;left:16px;top:16px;pointer-events:auto;padding:10px 16px;border-radius:12px;}
.fv-workspace button:disabled{opacity:.5;cursor:not-allowed;}.fv-workspace button{min-height:32px;}
@media(max-width:1000px){.fv-workspace .fv-heading{grid-template-columns:minmax(0,1fr) 300px;gap:10px;}.fv-workspace .fv-title-block{padding:10px;}.fv-workspace .fv-title{font-size:24px;}.fv-workspace .fv-bar{font-size:12px;}.fv-workspace .fv-seg{padding-inline:8px;}}
`;

export function FarmView({
  farmName,
  place,
  onBack,
  onReset,
  sim: simProps,
  zoneControl,
  onCamera,
}: FarmViewProps) {
  const reduced = !!useReducedMotion();
  const [reportOpen, setReportOpen] = useState(false);
  const [sim, setSimState] = useState<SimState>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    return decodeShare(hash)?.farm === useAppStore.getState().farmId
      ? sharePanelState(hash)
      : { open: false, section: "scenarios" };
  });
  const reportBefore = useRef(false);
  const panelsHidden = useAppStore((s) => s.panelsHidden);
  const comparing = useAppStore((s) => s.twinMode === "compare");
  const farmId = useAppStore((s) => s.farmId);
  // Preserve upstream explore-only entry fix: absence of a twin is supported here.
  const twin = twinConfig(farmId);
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
      {panelsHidden ? (
        <FvButton
          className="fv-glass fv-restore"
          onClick={() => useAppStore.setState({ panelsHidden: false })}
        >
          Show panels
        </FvButton>
      ) : (
        <>
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
            <div className="fv-toolbar">
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
          {reportOpen && !sim.open && (
            <section
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
            </section>
          )}
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
        </>
      )}
      <p className="sr-only">
        {reduced ? "Reduced motion enabled." : ""}This tool supports, and does
        not replace, local agronomic expertise.
      </p>
    </div>
  );
}
