"use client";
// Shared farm chrome. Twin-only content remains guarded by simProps/twinConfig.
// Layout: the map stays clear. A bare title (top-left), one rail of pop-out tabs on the right edge, and the
// Twin button (bottom-centre) are the only things on screen until a tab is opened.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  SimulationTrigger,
  useSimKeys,
  type SimProps,
  type SimState,
} from "./SimulationTab";
import { FV_CSS } from "./styles";
import { ComparisonTimeline } from "./Timeline";
import { ConditionCard, LayerLegend } from "./Cards";
import { RotationComparison } from "@/components/farm-future/RotationComparison";
import { FutureLayer, FUTURE_CSS } from "@/components/farm-future/FutureLayer";
import { FuturePills, LensControl, ModeSwitch } from "@/components/farm-future/Controls";
import { FutureTimeline } from "@/components/farm-future/FutureTimeline";
import { EventSky, MapEffects } from "@/components/farm-future/MapEffects";
import { StrategyBar } from "@/components/farm-future/SoilHealth";
import { useFutureStore } from "@/lib/farm-future/store";
import { Droplet, Leaf, Thermometer, X } from "./icons";
import dynamic from "next/dynamic";
import { imageryFor } from "@/lib/map2d/imagery";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import type { PlaceNavigation } from "@/components/copilot/CopilotComposer";
import { RotationPlanner } from "@/components/rotation-planner/RotationPlanner";
import { usePlannerStore } from "@/lib/rotation-planner/store";
import { siteForFarm } from "@/lib/forecast/sites";
import { useCopilot, bindCopilotFarm } from "@/lib/copilot/copilot";
import { closeWorkspaceTools, coordinateWorkspace } from "@/lib/farm-view/workspace";
import { FarmOverview } from "./FarmOverview";
import { ConditionLegend } from "@/components/conditions/ConditionLegend";
import { DESKTOP_WORKSPACE_CSS } from "./desktop-workspace";
import { HorizonTabs, MonthlyOutlook } from "@/components/farm-future/MonthlyOutlook";
import { useWindowManager } from "@/lib/window/store";
import { useWindowHost, Window } from "@/components/window/Window";
import { WINDOW_CSS } from "@/components/window/window-css";
import { Dock, DOCK_CSS } from "@/components/window/Dock";

// MapLibre is large and needs the browser: load the 2D map only when it is opened.
const Map2D = dynamic(() => import("@/components/map2d/Map2D").then((m) => m.Map2D), { ssr: false });

const PILL_ICON: Record<ConditionId, typeof Droplet> = { rainfall: Droplet, moisture: Droplet, vigor: Leaf, heat: Thermometer };

export type FarmViewProps = {
  farmName: string;
  farmId?: string;
  place?: string;
  navigation?: PlaceNavigation;
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
.fv-workspace .fv-title{font-size:clamp(19px,2vw,27px);line-height:1.15;overflow-wrap:anywhere;}
.fv-workspace .fv-bar{height:auto;min-height:40px;flex-wrap:wrap;border-radius:12px;width:fit-content;}
/* Put farm actions and the active drawer on the same side as the assistant. */
.fv-workspace .fv-menu{pointer-events:auto;position:relative;width:fit-content;font-size:14px;text-shadow:none;}
.fv-workspace .fv-menu>summary{padding:8px 14px;border-radius:999px;cursor:pointer;list-style:none;}
.fv-workspace .fv-menu-body{position:absolute;top:calc(100% + 8px);left:0;width:min(360px,calc(100vw - 32px));max-height:58dvh;overflow:auto;background:#172129;padding:12px;border-radius:14px;z-index:55;display:grid;gap:8px;}
.fv-workspace .fv-rail{display:flex;flex-wrap:wrap;gap:6px;}
.fv-workspace .fv-rail[hidden]{display:none;}
.fv-workspace .fv-rail-tab{padding:0 12px;border-radius:999px;}
.fv-workspace .fv-rail-tab[aria-expanded="true"]{background:rgba(52,44,36,.96);box-shadow:inset 2px 0 0 #E2B866;}
.fv-workspace .fv-drawer{position:absolute;left:16px;top:112px;width:min(390px,calc(100% - 32px));max-height:calc(100% - 220px);overflow:auto;overscroll-behavior:contain;padding:14px 16px 16px;border-radius:16px;pointer-events:auto;display:grid;gap:12px;align-content:start;z-index:30;font-size:13px;}
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
/* The farm menu opens What-if. */
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

type Drawer = "conditions" | "view" | "report" | "more" | "rotations" | "campus";
const DRAWER_TITLE: Record<Drawer, string> = { conditions: "Conditions", view: "Map", report: "Field report", more: "More", rotations: "Crop Rotations", campus: "Campus Info" };

export function FarmView({
  farmName,
  farmId: propFarmId,
  place,
  navigation,
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
  const rootRef = useRef<HTMLDivElement>(null);
  useWindowHost(rootRef);
  const [drawer, setDrawer] = useState<Drawer | null>(initialReportOpen ? "report" : null);
  const [sim, setSimState] = useState<SimState>(() => {
    if (initialSim) return initialSim;
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    return decodeShare(hash)?.farm === useAppStore.getState().farmId
      ? sharePanelState(hash)
      : { open: false, section: "scenarios" };
  });
  const closeSimulation = useCallback(() => setSimState((s) => s.open ? { ...s, open: false } : s), []);
  const setSim = useCallback((next: SimState) => {
    if (next.open) {
      closeWorkspaceTools();
      setDrawer(null);
      useWindowManager.getState().restore("simulation");
    }
    setSimState(next);
  }, []);
  // Shared links can open Simulation before any trigger is used.
  useEffect(() => {
    if (sim.open) { closeWorkspaceTools(); setDrawer(null); }
  }, [sim.open]);
  const storePanelsHidden = useAppStore((s) => s.panelsHidden);
  const panelsHidden = initialPanelsHidden ?? storePanelsHidden;
  const restorePanels = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuTrigger = useRef<HTMLElement>(null);
  const previousPanelsHidden = useRef(panelsHidden);
  useEffect(() => {
    if (previousPanelsHidden.current !== panelsHidden) {
      (panelsHidden ? restorePanels : menuTrigger).current?.focus();
      previousPanelsHidden.current = panelsHidden;
    }
  }, [panelsHidden]);
  const futureMode = useFutureStore((s) => s.mode);
  const futurePanel = useFutureStore((s) => s.panel);
  const reviewFor = useFutureStore((s) => s.reviewFor);
  const horizon = useFutureStore((s) => s.horizon);
  const comparing = useAppStore((s) => s.twinMode === "compare");
  const storeFarmId = useAppStore((s) => s.farmId);
  const farmId = propFarmId ?? storeFarmId;
  const isUbc = farmId === "ubc-farm" || farmName.toLowerCase().includes("ubc");
  const isKpu = farmId === "kpu-langley" || farmName.toLowerCase().includes("kpu");
  // Preserve upstream explore-only entry fix: absence of a twin is supported here.
  const twin = twinConfig(farmId);
  const map2d = useAppStore((s) => s.map2d) && !!imageryFor(farmId ?? null);
  const plannerOpen = usePlannerStore((s) => s.open);
  const gusOpen = useCopilot((s) => s.open);
  const simMinimized = useWindowManager((s) => s.wins.simulation.minimized);
  useEffect(() => coordinateWorkspace(() => setDrawer(null), closeSimulation), [closeSimulation]);
  useEffect(() => {
    bindCopilotFarm(farmId ?? null);
    usePlannerStore.setState({ open: false });
    setDrawer(null);
  }, [farmId]);
  // Return keyboard focus when a workspace surface closes.
  const lastTrigger = useRef<HTMLElement | null>(null);
  const previousSurface = useRef<string | null>(null);
  const surface = sim.open ? "simulation" : drawer ?? futurePanel ?? (plannerOpen ? "planner" : gusOpen ? "gus" : null);
  useEffect(() => {
    if (surface && surface !== previousSurface.current && document.activeElement instanceof HTMLElement) {
      const target = document.activeElement;
      // Remember persistent launchers, not controls inside a surface being replaced.
      if (target.closest('[data-testid="farm-sidebar"]')) lastTrigger.current = target;
    }
    if (!surface && previousSurface.current) {
      const target = lastTrigger.current;
      if (target?.isConnected && !target.closest('[hidden]')) target.focus();
      else {
        const fallback = document.querySelector<HTMLButtonElement>(previousSurface.current === "simulation" ? '[data-testid="sim-tab"]' : '[data-testid="action-map-tools"]');
        if (fallback && !fallback.closest('[hidden]')) fallback.focus();
        else document.getElementById('fw-dock-launch')?.focus();
      }
    }
    previousSurface.current = surface;
  }, [surface]);
  const [card, setCard] = useState<ConditionId | null>(null);
  useEffect(() => {
    if (!card) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setCard(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card]);
  const [muted, setMuted] = useState(() => sound.isMuted());
  useSimKeys(sim, setSim, !!simProps && futureMode === "now");
  useEffect(() => { if (futureMode !== "now") closeSimulation(); }, [futureMode, closeSimulation]);
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
  const active = drawer;
  const toggle = (id: Drawer) => {
    const next = active === id && !useWindowManager.getState().wins.inspector.minimized ? null : id;
    if (next) {
      if (menu.current) menu.current.open = false;
      useCopilot.getState().close();
      sound.pop();
      closeSimulation();
      closeWorkspaceTools();
      useWindowManager.getState().restore("inspector");
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
    <div ref={rootRef} className="fv-root fv-workspace" data-testid="farm-view" data-surface={sim.open ? "simulation" : gusOpen ? "gus" : plannerOpen ? "planner" : active ? "drawer" : futurePanel ? "future" : "overview"} data-horizon={futureMode === "now" ? "none" : horizon} data-wide={active === "rotations" || plannerOpen || futureMode === "compare"}>
      <style>{FV_CSS + FUTURE_CSS + WORKSPACE_CSS + DESKTOP_WORKSPACE_CSS + WINDOW_CSS + DOCK_CSS}</style>
      {map2d && <Map2D toolsOpen={active === "view" && !panelsHidden} onExit={() => useAppStore.setState({ map2d: false })} />}
      {!map2d && <MapEffects />}
      {map2d && <EventSky />}
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
          <Dock />
          <Window id="nav" title={farmName}>
          <div className="fv-heading" data-testid="farm-sidebar">
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
              <nav className="fv-action-row" aria-label="Farm actions">
                {(isUbc || isKpu) && (
                  <FvButton
                    className="fv-glass fv-seg fv-accent-btn"
                    data-testid="action-compare-rotations"
                    style={{ background: "linear-gradient(180deg, #c3d6f4 0%, #a3bfe9 100%)", color: "#05070c", fontWeight: 600, padding: "0 14px" }}
                    onClick={() => toggle("rotations")}
                  >
                    {active === "rotations" ? "Close comparison" : "Compare rotations"}
                  </FvButton>
                )}
                {isKpu && (
                  <FvButton
                    className="fv-glass fv-seg fv-accent-btn"
                    data-testid="action-explore-campus"
                    style={{ background: "linear-gradient(180deg, #c3d6f4 0%, #a3bfe9 100%)", color: "#05070c", fontWeight: 600, padding: "0 14px" }}
                    onClick={() => toggle("campus")}
                  >
                    {active === "campus" ? "Close campus info" : "Explore campus"}
                  </FvButton>
                )}
                {siteForFarm(farmId ?? null) && (
                  <FvButton className="fv-glass fv-seg" data-testid="action-plan-rotations" onClick={() => {
                    if (menu.current) menu.current.open = false;
                    useCopilot.getState().close();
                    const manager = useWindowManager.getState();
                    const open = !usePlannerStore.getState().open || manager.wins.planner.minimized;
                    if (open) manager.restore("planner");
                    usePlannerStore.setState({ open });
                  }}>
                    Plan rotations
                  </FvButton>
                )}
                {siteForFarm(farmId ?? null) && (
                  <FvButton className="fv-glass fv-seg" data-testid="copilot-open" aria-expanded={gusOpen} onClick={() => {
                    useWindowManager.getState().restore("copilot");
                    useCopilot.setState({ open: true, selected: null, strategyId: null, fieldId: null });
                  }}>
                    Ask Gus
                  </FvButton>
                )}
                {imageryFor(farmId ?? null) && (
                  <FvButton
                    className="fv-glass fv-seg"
                    data-testid="action-map2d"
                    aria-pressed={map2d}
                    onClick={() => {
                      if (menu.current) menu.current.open = false;
                      useAppStore.setState({ map2d: !map2d });
                    }}
                  >
                    {map2d ? "3D Explore" : "2D Map"}
                  </FvButton>
                )}
                <FvButton
                  className="fv-glass fv-seg"
                  data-testid="action-map-tools"
                  aria-expanded={active === "view"}
                  aria-controls="farm-drawer"
                  onClick={() => toggle("view")}
                >
                  {active === "view" ? "Close map tools" : "Map tools"}
                </FvButton>
              </nav>
              <FarmOverview />
              <ModeSwitch />
              {futureMode === "future" && <details className="fv-analysis-options"><summary>Rotation and forecast tools</summary><StrategyBar /></details>}
              {simProps && <div hidden={futureMode !== "now"}><SimulationTrigger props={simProps} sim={sim} setSim={setSim} minimized={simMinimized} /></div>}
          <nav className="fv-rail" aria-label="Farm panels">
            <RailTab id="conditions" active={active} onToggle={toggle} />
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
            <RailTab id="more" active={active} onToggle={toggle} aria-label="More options" />
          </nav>
              {simProps && twin && (
                <details className="fv-cap" style={{ marginTop: 8 }}>
                  <summary>Approximate outlines</summary>
                  <p>{[...twin.labels, ...twin.attribution].join(" · ")}</p>
                </details>
              )}
            </div>
          </div>
          </Window>

          {simProps && <Window id="simulation" present={futureMode === "now" && sim.open} onClose={() => setSim({ ...sim, open: false })} activationKey={sim.section}>
            <SimulationTab props={simProps} sim={sim} setSim={setSim} contentOnly />
          </Window>}
          <Window id="inspector" activationKey={active ?? undefined} present={!!active} title={active ? DRAWER_TITLE[active] : undefined} onClose={() => active && toggle(active)}>
          <aside
            id="farm-drawer"
            className="fv-glass fv-drawer"
            aria-label={active ? DRAWER_TITLE[active] : "Farm panel"}
            data-future={futureMode === "future"}
            hidden={!active}
          >
            <div className="fv-drawer-head">
              <h2 className="fv-rtitle">{active ? DRAWER_TITLE[active] : ""}</h2>
              <FvButton className="fv-icon" style={{ width: 28, height: 28 }} aria-label="Close panel" data-testid="drawer-close" tapSound="none" onClick={() => active && toggle(active)}>
                <X size={16} />
              </FvButton>
            </div>

            {active === "rotations" && (
              <div className="fv-drawer-body" data-testid="ubc-comparison-panel">
                <RotationComparison layout="columns" />
              </div>
            )}

            {active === "campus" && (
              <div className="fv-drawer-body" data-testid="kpu-explore-panel">
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f2ebdd", margin: "0 0 6px 0" }}>KPU School of Horticulture</h3>
                  <p style={{ color: "#c9bfae", lineHeight: 1.5, margin: "0 0 10px 0" }}>
                    Teaching greenhouse, nursery production, turfgrass field laboratory, and display gardens at the Langley campus in the Fraser Valley.
                  </p>
                  <div style={{ fontSize: 12, color: "#a3bfe9", display: "flex", flexDirection: "column", gap: 4, margin: "0 0 12px 0" }}>
                    <span><strong>Location:</strong> 49°07′N 122°38′W (Langley, BC)</span>
                    <span><strong>Facilities:</strong> High-tech greenhouses, field lab, apiary</span>
                    <span><strong>Status:</strong> No field sensors connected</span>
                  </div>
                  <a href="https://www.kpu.ca/langley/campus-highlights" target="_blank" rel="noreferrer" className="fv-glass fv-seg" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "#f2ebdd", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
                    Visit KPU Campus Highlights ↗
                  </a>
                </div>
              </div>
            )}

            <div className="fv-drawer-body" hidden={active !== "conditions"}>
              {futureMode === "future" ? (
                <><FuturePills /><ConditionLegend embedded /></>
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
                      No dated farm observations are connected.
                    </p>
                  </div>
                  <hr />
                  <div>
                    <h3>Conditions</h3>
                    <div className="fv-preview" aria-label="Condition preview">
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
              {futureMode === "future" && <LensControl />}
              {map2d && <p className="fv-cap">2D map controls appear below. Draw a field to analyse a new area.</p>}
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
          </Window>
          <div className="fv-mode-content" hidden={futureMode !== "now"}>
          {simProps && comparing && (
            <>
              <DividerHandle />
              <ComparisonTimeline />
            </>
          )}
          </div>
          <Window id="time" present={futureMode !== "now" && !plannerOpen}>
            {futureMode === "future" && <HorizonTabs bottom={horizon === "months" ? 228 : 236} />}
            {futureMode !== "now" && (futureMode === "future" && horizon === "months"
              ? <MonthlyOutlook />
              : <FutureTimeline reduced={reduced} right={futureMode === "compare" && reviewFor ? 400 : 40} />)}
          </Window>
          <Window id="future" activationKey={futurePanel ?? undefined} present={futureMode === "future" && !!futurePanel} onClose={closeFuturePanel}>
            <FutureLayer />
          </Window>
          <Window id="planner" present={plannerOpen} onClose={() => usePlannerStore.setState({ open: false })}>
            {siteForFarm(farmId ?? null) && <RotationPlanner key={siteForFarm(farmId ?? null)!} siteId={siteForFarm(farmId ?? null)!} />}
          </Window>
          <Window id="copilot" present={gusOpen} onClose={() => useCopilot.getState().close()}>
            <CopilotPanel navigation={navigation} />
          </Window>
      </div>
      <p className="sr-only">
        {reduced ? "Reduced motion enabled." : ""}This tool supports, and does
        not replace, local agronomic expertise.
      </p>
    </div>
  );
}

/** Close whichever Future card is open (the review drawer has its own close). */
function closeFuturePanel() {
  const s = useFutureStore.getState();
  if (s.panel === "review") s.openReview(null);
  else s.openPanel(null);
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
