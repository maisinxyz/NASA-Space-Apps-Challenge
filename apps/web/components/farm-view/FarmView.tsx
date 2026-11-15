"use client";
// Shared farm chrome. Twin-only content remains guarded by simProps/twinConfig.
// Layout: the map stays clear. A bare title (top-left), one rail of pop-out tabs on the right edge, and the
// Twin button (bottom-centre) are the only things on screen until a tab is opened.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
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
import { Droplet, Leaf, Thermometer, X } from "./icons";

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
.fv-workspace .fv-panels,.fv-workspace .fv-mode-content{display:contents}.fv-workspace .fv-mode-content[hidden]{display:none}.fv-workspace .fv-panels[hidden]{display:none}
.fv-workspace .fv-heading[hidden]{display:none}.fv-workspace .fv-heading{position:relative;}
/* Title sits straight on the map: no backing block, a soft dark halo keeps the letters readable. */
.fv-workspace .fv-title-block{min-width:0;width:fit-content;max-width:min(620px,calc(100% - 60px));pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.75),0 0 12px rgba(0,0,0,.6),0 0 30px rgba(0,0,0,.45);}
.fv-workspace .fv-title-block :is(button,a,summary,details,[role="listbox"],[role="radiogroup"]){pointer-events:auto;}
.fv-workspace .fv-title-block :is(.fv-glass,.ff-seg,.ff-menu){text-shadow:none;}
.fv-workspace .fv-title{font-size:clamp(24px,2.4vw,36px);line-height:1.15;overflow-wrap:anywhere;}
.fv-workspace .fv-bar{height:auto;min-height:40px;flex-wrap:wrap;border-radius:12px;width:fit-content;}
/* Side rail: every secondary panel is one tab on the right edge; one drawer pops out at a time. */
.fv-workspace .fv-rail{position:absolute;right:0;top:50%;transform:translateY(-50%);display:grid;gap:6px;pointer-events:auto;z-index:31;}
.fv-workspace .fv-rail[hidden]{display:none;}
.fv-workspace .fv-rail-tab{width:34px;padding:14px 0;border-radius:12px 0 0 12px;border-right:0;display:grid;place-items:center;transition:background-color 120ms;}
.fv-workspace .fv-rail-tab .t{writing-mode:vertical-rl;font-size:12.5px;line-height:1;letter-spacing:.02em;color:#f2ebdd;}
.fv-workspace .fv-rail-tab:hover{background:rgba(52,44,36,.92);}
.fv-workspace .fv-rail-tab[aria-expanded="true"]{background:rgba(52,44,36,.96);box-shadow:inset 2px 0 0 #E2B866;}
.fv-workspace .fv-drawer{position:absolute;right:46px;top:16px;width:min(340px,calc(100% - 62px));max-height:calc(100% - 136px);overflow:auto;overscroll-behavior:contain;padding:14px 16px 16px;border-radius:16px;pointer-events:auto;display:grid;gap:12px;align-content:start;z-index:30;font-size:13px;}
.fv-workspace .fv-drawer[data-future="true"]{top:64px;max-height:calc(100% - 260px);}
.fv-workspace .fv-drawer[hidden],.fv-workspace .fv-drawer [hidden]{display:none;}
.fv-workspace .fv-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.fv-workspace .fv-drawer-body{display:grid;gap:12px;}
.fv-workspace .fv-drawer h3{font-size:11px;line-height:14px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:#c9bfae;margin:0 0 6px;}
.fv-workspace .fv-drawer hr{border:0;border-top:1px solid rgba(242,235,221,.12);margin:0;}
.fv-workspace .fv-drawer p{margin:0;}
.fv-workspace .fv-observations dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px;}
.fv-workspace .fv-observations dt{color:#c9bfae;font-size:12px;}.fv-workspace .fv-observations dd{margin:0;}
.fv-workspace .fv-preview{width:100%;position:relative;display:flex;flex-wrap:wrap;gap:6px;}
.fv-workspace .fv-preview .fv-pill{background:rgba(255,255,255,.06);box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;}
.fv-workspace .fv-preview .fv-pill[aria-expanded="true"]{background:rgba(255,255,255,.16);}
.fv-workspace .fv-preview .fv-legend{position:relative !important;right:auto !important;bottom:auto !important;width:100%;}
.fv-workspace .fv-preview .fv-card{position:relative !important;top:auto !important;right:auto !important;width:100%;max-height:35vh;overflow:auto;background:rgba(255,255,255,.05);box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;}
.fv-workspace .fv-drawer .fv-stats{background:none;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;padding:0;}
.fv-workspace .fv-drawer .fv-stats .cells{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
.fv-workspace .fv-drawer .fv-stat{background:rgba(255,255,255,.05);box-shadow:none;}
.fv-workspace .fv-drawer .fv-stat:hover{background:rgba(255,255,255,.12);}
.fv-workspace .fv-drawer .fv-stats .foot{border-top:0;padding:6px 0 0;}
.fv-workspace .fv-zone{width:100%;font-size:12px;}
.fv-workspace .fv-drawer .fv-zone>div{max-width:none;background:none;border:0;padding:0;backdrop-filter:none;-webkit-backdrop-filter:none;}
.fv-workspace .fv-menu-list{display:grid;gap:2px;}
.fv-workspace .fv-menu-list button,.fv-workspace .fv-more>.fv-glass>div>button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:36px;padding:0 10px;border-radius:10px;text-align:left;transition:background-color 120ms;}
.fv-workspace .fv-menu-list button:hover,.fv-workspace .fv-more>.fv-glass>div>button:hover{background:rgba(255,255,255,.1);}
.fv-workspace .fv-menu-list kbd{font:inherit;font-size:11px;color:#c9bfae;border:1px solid rgba(242,235,221,.2);border-radius:5px;padding:0 5px;}
.fv-workspace .fv-more>.fv-glass{background:none;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;padding:0 !important;}
.fv-workspace .fv-more>.fv-glass>div{flex-direction:column;gap:2px !important;}
.fv-workspace .fv-more>.fv-glass>p{padding:6px 10px 0;color:#c9bfae;font-size:12px;}
.fv-workspace .fv-camera summary{cursor:pointer;}
.fv-workspace .fv-camera .fv-seg{background:rgba(255,255,255,.06);text-transform:capitalize;}
.fv-workspace .fv-lens-slot{position:absolute;right:46px;top:16px;pointer-events:auto;z-index:32;}
/* What-if opens from the side rail; its floating pill would duplicate the tab. */
.fv-workspace [data-testid="whatif-pill"]{display:none;}
.fv-workspace .fv-title-block{animation:fv-title-enter .4s ease-out both;}
@keyframes fv-title-enter{from{opacity:0}to{opacity:1}}
@keyframes fv-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.fv-workspace .fv-title-block{animation:none}}
.fv-workspace .fv-field-button{padding:6px 0;text-decoration:underline;text-underline-offset:3px;text-align:left;min-height:36px;}
.fv-workspace .fv-restore{position:absolute;left:16px;top:16px;pointer-events:auto;padding:10px 16px;border-radius:12px;}
.fv-workspace button:disabled{opacity:.5;cursor:not-allowed;}.fv-workspace button{min-height:32px;}
.fv-workspace .fv-twinpill,.fv-workspace .fv-answer{max-width:calc(100vw - 32px);}
@media(max-width:700px){.fv-workspace .fv-title{font-size:22px;}.fv-workspace .fv-drawer,.fv-workspace .fv-drawer[data-future="true"]{top:auto;bottom:88px;max-height:55vh;}}
`;

type Drawer = "conditions" | "view" | "report" | "more";
const DRAWER_TITLE: Record<Drawer, string> = { conditions: "Conditions", view: "Map", report: "Field report", more: "More" };

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
  const [drawer, setDrawer] = useState<Drawer | null>(initialReportOpen ? "report" : null);
  const [sim, setSim] = useState<SimState>(() => {
    if (initialSim) return initialSim;
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    return decodeShare(hash)?.farm === useAppStore.getState().farmId
      ? sharePanelState(hash)
      : { open: false, section: "scenarios" };
  });
  const storePanelsHidden = useAppStore((s) => s.panelsHidden);
  const panelsHidden = initialPanelsHidden ?? storePanelsHidden;
  const restorePanels = useRef<HTMLButtonElement>(null);
  const moreTab = useRef<HTMLButtonElement>(null);
  const previousPanelsHidden = useRef(panelsHidden);
  useEffect(() => {
    if (previousPanelsHidden.current !== panelsHidden) {
      (panelsHidden ? restorePanels : moreTab).current?.focus();
      previousPanelsHidden.current = panelsHidden;
    }
  }, [panelsHidden]);
  const futureMode = useFutureStore((s) => s.mode);
  const futurePanel = useFutureStore((s) => s.panel);
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
  // Future mode has no map-layer or field-report content, so those drawers stay shut there.
  const active = futureMode === "now" || drawer === "conditions" || drawer === "more" ? drawer : null;
  const toggle = (id: Drawer) => {
    const next = active === id ? null : id;
    if (next) {
      sound.pop();
      useFutureStore.getState().openPanel(null);
    } else sound.close();
    if (next !== "conditions") setCard(null);
    setDrawer(next);
  };
  useEffect(() => {
    if (!active || card) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, card]);
  // A future pop-up card (What-if, soil health, forecast) and the drawer share the right side: one at a time.
  useEffect(() => {
    if (futurePanel) setDrawer(null);
  }, [futurePanel]);
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
          {futureMode === "compare" && <FvButton className="fv-glass fv-seg" style={{ position: "absolute", right: 16, top: 16, pointerEvents: "auto" }} onClick={() => useAppStore.setState({ panelsHidden: true })}>Hide panels</FvButton>}
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
              <h1 className="fv-title">{farmName}</h1>
              <p className="fv-sub">
                {place}
                {place ? " · " : ""}
                {simProps ? "Simulation available" : EXPLORE_SUBTITLE}
              </p>
              <ModeSwitch />
              {futureMode === "future" && <StrategyBar />}
              {simProps && <div hidden={futureMode !== "now"}><SimulationTab props={simProps} sim={sim} setSim={setSim} /></div>}
              {simProps && twin && (
                <details className="fv-cap" style={{ marginTop: 8 }}>
                  <summary>Approximate outlines · illustrative crops</summary>
                  <p>{[...twin.labels, ...twin.attribution].join(" · ")}</p>
                </details>
              )}
            </div>
          </div>
          {futureMode === "future" && <div className="fv-lens-slot"><LensControl /></div>}
          <nav className="fv-rail" aria-label="Farm panels" hidden={futureMode === "compare"}>
            <RailTab id="conditions" active={active} onToggle={toggle} />
            {futureMode === "now" && <RailTab id="view" active={active} onToggle={toggle} />}
            {futureMode === "now" && (
              <RailTab
                id="report"
                active={active}
                onToggle={toggle}
                data-testid="field-report-toggle"
                aria-label={active === "report" ? "Collapse field report" : "Expand field report"}
              />
            )}
            {futureMode === "future" && (
              <FvButton
                className="fv-glass fv-rail-tab"
                aria-expanded={futurePanel === "whatif"}
                data-testid="rail-whatif"
                onClick={() => useFutureStore.getState().openPanel("whatif")}
              >
                <span className="t">What-if</span>
              </FvButton>
            )}
            <RailTab ref={moreTab} id="more" active={active} onToggle={toggle} aria-label="More options" />
          </nav>
          <aside
            id="farm-drawer"
            className="fv-glass fv-drawer"
            aria-label={active ? DRAWER_TITLE[active] : "Farm panel"}
            data-future={futureMode === "future"}
            hidden={!active || futureMode === "compare"}
          >
            <div className="fv-drawer-head">
              <h2 className="fv-rtitle">{active ? DRAWER_TITLE[active] : ""}</h2>
              <FvButton className="fv-icon" style={{ width: 28, height: 28 }} aria-label="Close panel" data-testid="drawer-close" tapSound="none" onClick={() => active && toggle(active)}>
                <X size={16} />
              </FvButton>
            </div>

            <div className="fv-drawer-body" hidden={active !== "conditions"}>
              {futureMode === "future" ? (
                <FuturePills />
              ) : (
                <>
                  <div className="fv-observations">
                    <h3>Farm observations: Not available</h3>
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
                    <p className="fv-cap">
                      No dated farm observations are connected. Simulation inputs
                      are synthetic.
                    </p>
                  </div>
                  <hr />
                  <div>
                    <h3>Synthetic preview · not this farm’s measurements</h3>
                    <div className="fv-preview" aria-label="Synthetic condition preview">
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
                  </div>
                </>
              )}
            </div>

            <div className="fv-drawer-body" hidden={active !== "view"}>
              <div>
                <h3>Map layer</h3>
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
                <p id="layer-unavailable" className="fv-cap" style={{ marginTop: 6 }}>
                  Analytical layers unavailable: no observations connected.
                </p>
              </div>
              {zoneControl && (
                <>
                  <hr />
                  <div className="fv-zone">{zoneControl}</div>
                </>
              )}
              {onCamera && (
                <>
                  <hr />
                  <details className="fv-camera">
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
                      <p className="fv-cap" style={{ margin: "6px 0" }}>
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
                </>
              )}
            </div>

            {active === "report" && (
              <section className="fv-drawer-body" data-testid="field-report" aria-label="Field report">
                <p>No field measurements for this farm yet.</p>
                {simProps ? (
                  <table className="fv-table" style={{ marginTop: 0 }}>
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

            <div className="fv-drawer-body fv-more" hidden={active !== "more"}>
              <div className="fv-menu-list">
                <FvButton aria-label="Reset camera" data-testid="reset-view" onClick={onReset}>
                  Reset camera
                </FvButton>
                <FvButton
                  data-testid="mute-toggle"
                  onClick={() => {
                    sound.setMuted(!muted);
                    setMuted(!muted);
                  }}
                >
                  {muted ? "Unmute sounds" : "Mute sounds"}
                </FvButton>
                <FvButton aria-label="Hide panels" aria-keyshortcuts="H" onClick={() => useAppStore.setState({ panelsHidden: true })}>
                  Hide panels<kbd aria-hidden>H</kbd>
                </FvButton>
              </div>
              <hr />
              <InvestigationControls simulationAvailable={!!simProps} />
            </div>
          </aside>
          <div className="fv-mode-content" hidden={futureMode !== "now"}>
          <Twin bottom={comparing ? 110 : undefined} />
          {simProps && comparing && (
            <>
              <DividerHandle />
              <ComparisonTimeline />
            </>
          )}
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

/** One edge tab of the side rail; opens (or closes) its drawer. */
function RailTab({
  id,
  active,
  onToggle,
  ref,
  ...rest
}: {
  id: Drawer;
  active: Drawer | null;
  onToggle(id: Drawer): void;
  ref?: React.Ref<HTMLButtonElement>;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  return (
    <FvButton
      ref={ref}
      className="fv-glass fv-rail-tab"
      aria-expanded={active === id}
      aria-controls="farm-drawer"
      data-testid={`rail-${id}`}
      tapSound="none"
      onClick={() => onToggle(id)}
      {...rest}
    >
      <span className="t">{DRAWER_TITLE[id]}</span>
    </FvButton>
  );
}
