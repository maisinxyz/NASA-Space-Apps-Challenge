"use client";
// Farm view overlay (Slice A): title block, layer bar, condition pills, Field report + collapsed tab, Twin button,
// timeline. Panels are fixed-size and anchored to viewport edges; the Cesium map underneath stays draggable
// everywhere no panel covers it (root is pointer-events: none, each panel opts back in).
// Not built yet (later slices): condition cards, map layers, field popover, Twin pill/answers.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { CONDITIONS, LAYERS, SAMPLE_FIELDS, EXPLORE_SUBTITLE, reportSummary, type ConditionId } from "@/lib/farm-view/sample";
import { color, layout, motion as m, zIndex, type LayerId } from "@/lib/farm-view/tokens";
import { DividerHandle } from "@/components/farm/CompareTray";
import { twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";
import { sound } from "@/lib/ui/sound";

import { ConditionCard, LayerLegend } from "./Cards";
import { FvButton } from "./FvButton";
import { ChevronLeft, ChevronRight, Droplet, Leaf, PanelLeft, RotateCcw, Thermometer, Volume2, VolumeX } from "./icons";
import { SimulationTab, useSimKeys, type SimProps, type SimState } from "./SimulationTab";
import { monthOf } from "@/lib/farm-view/timeline";
import { FV_CSS } from "./styles";
import { Timeline } from "./Timeline";
import { Twin } from "./Twin";

// tokens.ease.out as a cubic-bezier tuple for framer-motion.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const PILL_ICON: Record<ConditionId, typeof Droplet> = { rainfall: Droplet, moisture: Droplet, vigor: Leaf, heat: Thermometer };

export type FarmViewProps = {
  farmName: string;
  /** "Zürich, Switzerland": from the farm record, never hard-coded. */
  place?: string;
  onBack(): void;
  onReset(): void;
  /** Present on full-twin (simulation) farms: adds the Simulation tab and the farm's own field list. */
  sim?: SimProps;
  /** Vulnerability zone toggle or custom controls rendered in the reserved center header region. */
  zoneToggle?: ReactNode;
  /** Whether the field report is initially expanded (useful for testing or direct links). */
  initialReportOpen?: boolean;
  initialSim?: SimState;
  initialPanelsHidden?: boolean;
};

export function FarmView({ farmName, place, onBack, onReset, sim: simProps, zoneToggle, initialReportOpen = false, initialSim, initialPanelsHidden }: FarmViewProps) {
  const reduced = !!useReducedMotion();
  const currentLook = useAppStore((s) => s.look);
  const [layer, setLayer] = useState<LayerId>(() => (currentLook === "vegetation" ? "vigor" : currentLook === "thermal" ? "moisture" : "satellite"));
  const [reportOpen, setReportOpen] = useState(initialReportOpen);
  const [sim, setSimState] = useState<SimState>(() => initialSim ?? { open: false, section: "scenarios" });
  const reportBefore = useRef(false);
  const storePanelsHidden = useAppStore((s) => s.panelsHidden);
  const panelsHidden = initialPanelsHidden !== undefined ? initialPanelsHidden : storePanelsHidden;
  const comparing = useAppStore((s) => s.twinMode === "compare");
  const farmId = useAppStore((s) => s.farmId);
  const twin = twinConfig(farmId);
  // The Simulation tab shares the left column: opening it folds the report away, closing restores it.
  const setSim = (next: SimState) => {
    if (next.open && !sim.open) { reportBefore.current = reportOpen; setReportOpen(false); }
    if (!next.open && sim.open) setReportOpen(reportBefore.current);
    setSimState(next);
  };
  useSimKeys(sim, setSim, !!simProps);
  // One condition card at a time; its pill toggles it, Esc closes it.
  const [card, setCard] = useState<ConditionId | null>(null);
  const toggleCard = (id: ConditionId) => {
    if (card === id) return closeCard();
    setCard(id);
    sound.tickWeek();
  };
  const closeCard = () => {
    setCard(null);
    sound.close();
  };
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCard();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const [muted, setMuted] = useState(() => sound.isMuted());

  useEffect(() => sound.installUnlock(), []);

  // Sync analytical layer changes with Cesium post-processing look filters
  const pickLayer = (id: LayerId) => {
    if (id === layer) return;
    setLayer(id);
    sound.tickWeek();
    if (id === "vigor") {
      useAppStore.setState({ look: "vegetation" });
    } else if (id === "moisture") {
      useAppStore.setState({ look: "thermal" });
    } else {
      useAppStore.setState({ look: "none" });
    }
  };

  useEffect(() => {
    if (currentLook === "vegetation" && layer !== "vigor") setLayer("vigor");
    else if (currentLook === "thermal" && layer !== "moisture") setLayer("moisture");
    else if (currentLook === "none" && layer !== "satellite") setLayer("satellite");
  }, [currentLook, layer]);
  const onBarKey = (e: React.KeyboardEvent) => {
    const i = LAYERS.findIndex((l) => l.id === layer);
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = LAYERS[(i + d + LAYERS.length) % LAYERS.length].id;
    pickLayer(next);
    document.querySelector<HTMLElement>(`[data-testid="layer-${next}"]`)?.focus();
  };
  const toggleReport = (open: boolean) => {
    setReportOpen(open);
    if (!open) sound.close();
  };
  type Row = { id: string; name: string; moisture: number | null; ndvi: number | null; status: string; sim: boolean };
  // Sim farms: the farm's own fields, no invented per-field numbers (sim-gap.md Q1 default).
  const rows: Row[] = simProps ? simProps.fields.map((f) => ({ id: f.id, name: f.name, moisture: null, ndvi: null, status: "–", sim: true })) : SAMPLE_FIELDS.map((f) => ({ ...f, sim: false }));
  const pickSimField = (id: string) => {
    useAppStore.setState({ twinFieldId: id });
    setSim({ open: true, section: "field" });
  };
  const pop = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, scale: m.popFromScale }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: m.popFromScale } };

  return (
    <div className={`fv-root`} style={{ position: "absolute", inset: 0, zIndex: zIndex.chrome, pointerEvents: "none" }} data-testid="farm-view">
      <style>{FV_CSS + "@keyframes fv-spin{to{transform:rotate(360deg)}}"}</style>

      {/* Reserved Header Regions (Grid at 1280x800 prevents overlap between title, zone toggle, and condition pills) */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) auto minmax(280px, 1fr)",
          gap: 16,
          alignItems: "start",
          paddingLeft: layout.title.left,
          paddingRight: layout.layerBar.right,
          paddingTop: layout.title.top,
        }}
      >
        {/* Left Region: Title block */}
        <div className="fv-onmap pointer-events-auto" style={{ maxWidth: 380 }}>
          <FvButton className="fv-back fv-auto" aria-label="Back to the globe" onClick={onBack} data-testid="back-to-globe">
            <ChevronLeft size={14} />
            Globe
          </FvButton>
          <h1 className="fv-title" style={{ wordBreak: "break-word" }}>{farmName}</h1>
          <p className="fv-sub">{place ? `${place} · ` : ""}{simProps ? "Simulation available" : EXPLORE_SUBTITLE}</p>
          {simProps && twin && (
            <div className="fv-cap fv-onmap" style={{ marginTop: 6, color: color.ink, display: "grid", gap: 2 }}>
              <span>{[...twin.labels, ...twin.attribution].join(" · ")}</span>
              {simProps.pending > 0 && <span role="status">Loading 3D detail…</span>}
              <span>This tool supports, and does not replace, local agronomic expertise.</span>
            </div>
          )}
          {simProps && !panelsHidden && <SimulationTab props={simProps} sim={sim} setSim={setSim} />}
        </div>

        {/* Center Region: Vulnerability zones box */}
        <div className="pointer-events-auto flex justify-center">
          {zoneToggle}
        </div>

        {/* Right Region: Layer bar + condition pills */}
        {!panelsHidden ? (
          <div className="pointer-events-auto flex flex-col items-end gap-3" style={{ maxWidth: 460 }}>
            {/* Layer bar */}
            <div className="fv-glass fv-bar fv-auto" role="radiogroup" aria-label="Map layer" onKeyDown={onBarKey}>
              {LAYERS.map((l) => (
                <FvButton
                  key={l.id}
                  className="fv-seg"
                  role="radio"
                  aria-checked={layer === l.id}
                  tabIndex={layer === l.id ? 0 : -1}
                  data-testid={`layer-${l.id}`}
                  onClick={() => pickLayer(l.id)}
                  title={
                    l.id === "vigor"
                      ? "Crop vigor (illustrative excess-green layer)"
                      : l.id === "moisture"
                        ? "Soil moisture (illustrative false-colour thermal layer)"
                        : "True colour satellite imagery"
                  }
                >
                  {l.label}
                </FvButton>
              ))}
              <span className="fv-div" aria-hidden />
              <FvButton className="fv-icon" aria-label="Reset view" data-testid="reset-view" onClick={onReset}>
                <RotateCcw size={18} />
              </FvButton>
              <FvButton
                className="fv-icon"
                aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                data-testid="mute-toggle"
                onClick={() => {
                  sound.setMuted(!muted);
                  setMuted(!muted);
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={muted ? "x" : "on"}
                    style={{ display: "grid" }}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: m.iconSwapFromScale, filter: `blur(${m.iconSwapBlur}px)` }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: m.iconSwapFromScale, filter: `blur(${m.iconSwapBlur}px)` }}
                    transition={{ duration: m.iconSwapMs / 1000, ease: EASE_OUT }}
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </motion.span>
                </AnimatePresence>
              </FvButton>
            </div>

            {/* Condition pills */}
            <div className="flex flex-col items-end gap-1.5">
              <span
                className="fv-cap"
                style={{
                  padding: "2px 8px",
                  borderRadius: 9999,
                  fontSize: 11,
                  color: "rgba(242,235,221,0.75)",
                  background: "rgba(27,22,18,0.6)",
                  border: "1px solid rgba(242,235,221,0.12)",
                }}
                title="Illustrative 30-day baseline sample; not live sensor measurements"
              >
                Sample · Past 30 days
              </span>
              <LayoutGroup>
                <div className="flex flex-wrap justify-end gap-2">
                  {CONDITIONS.map((c) => {
                    const Icon = PILL_ICON[c.id];
                    return (
                      <FvButton
                        key={c.id}
                        layout
                        className="fv-glass fv-pill fv-auto"
                        aria-expanded={card === c.id}
                        aria-controls={`condition-card-${c.id}`}
                        data-testid={`condition-pill-${c.id}`}
                        title={`${c.label}: ${c.value} (${c.period} sample; not live sensor measurements)`}
                        onClick={() => toggleCard(c.id)}
                      >
                        <Icon size={layout.pillRow.icon} />
                        <span className="l">{c.label}</span>
                        <span className="v">{c.value}</span>
                      </FvButton>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-start justify-end" style={{ maxWidth: 460 }}>
            <FvButton
              className="fv-glass fv-pill fv-auto"
              data-testid="show-panels"
              aria-label="Show panels (H)"
              aria-keyshortcuts="H"
              onClick={() => useAppStore.setState({ panelsHidden: false })}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
            >
              <span>Show panels</span>
              <kbd style={{ fontSize: 11, opacity: 0.8, padding: "1px 5px", borderRadius: 4, background: "rgba(242,235,221,0.18)" }}>H</kbd>
            </FvButton>
          </div>
        )}
      </header>

      {!panelsHidden && (<>
      <AnimatePresence>{card && <ConditionCard key={card} id={card} onClose={closeCard} />}</AnimatePresence>
      <AnimatePresence>{layer !== "satellite" && <LayerLegend key={layer} layer={layer} />}</AnimatePresence>
      {/* Field report: open card, or a 40 px tab on the left edge */}
      <AnimatePresence initial={false}>
        {reportOpen ? (
          <motion.section
            key="report"
            data-testid="field-report"
            aria-label="Field report"
            className="fv-glass fv-report fv-auto"
            style={{ position: "absolute", left: layout.report.left, bottom: layout.report.bottom, zIndex: zIndex.report, transformOrigin: "left center" }}
            {...pop}
            transition={{ duration: (reportOpen ? m.reportCollapseMs : m.reportCollapseMs * 0.8) / 1000, ease: EASE_OUT }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="fv-rtitle">Field report</h2>
              <FvButton className="fv-icon" style={{ width: 28, height: 28 }} aria-label="Collapse field report" aria-expanded data-testid="field-report-toggle" onClick={() => toggleReport(false)}>
                <ChevronLeft size={18} />
              </FvButton>
            </div>
            <p className="fv-sum">{simProps ? "No field measurements for this farm yet." : reportSummary()}</p>
            <table className="fv-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col" style={{ width: 70 }}>Moisture</th>
                  <th scope="col" style={{ width: 60 }}>NDVI</th>
                  <th scope="col" style={{ width: 83, paddingLeft: 15 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const isClickable = f.sim;
                  return (
                    <tr
                      key={f.id}
                      className={`fv-row ${isClickable ? "cursor-pointer" : ""}`}
                      data-testid={`field-report-row-${f.id}`}
                      tabIndex={isClickable ? 0 : undefined}
                      role={isClickable ? "button" : undefined}
                      aria-label={isClickable ? `Select field ${f.name}` : undefined}
                      onPointerDown={() => isClickable && sound.tap()}
                      onClick={() => isClickable && pickSimField(f.id)}
                      onKeyDown={(e) => {
                        if (isClickable && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          sound.tap();
                          pickSimField(f.id);
                        }
                      }}
                    >
                      <td className="n">{f.name}</td>
                      <td>{f.moisture === null ? "–" : `${f.moisture}%`}</td>
                      <td>{f.ndvi === null ? "–" : f.ndvi.toFixed(2)}</td>
                      <td className="s" style={{ paddingLeft: 15 }}>
                        <span className={f.status === "Dry" || f.status === "Stressed" ? "fv-diamond" : "fv-dot"} aria-hidden />
                        {f.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="fv-cap" style={{ margin: "8px 0 0" }}>Sample data</p>
          </motion.section>
        ) : (
          <motion.div
            key="tab"
            style={{ position: "absolute", left: layout.reportTab.left, bottom: layout.reportTab.bottom, zIndex: zIndex.report }}
            initial={{ opacity: 0, x: reduced ? 0 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduced ? 0 : -8 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            <FvButton className="fv-glass fv-tab fv-auto" origin="left center" aria-label="Expand field report" aria-expanded={false} data-testid="field-report-toggle" onClick={() => setReportOpen(true)}>
              <PanelLeft size={16} />
              <span className="t">Field report</span>
              <ChevronRight size={14} />
            </FvButton>
          </motion.div>
        )}
      </AnimatePresence>

      {simProps && comparing && <DividerHandle />}

      <Timeline
        reduced={reduced}
        onDayChange={(day) => {
          const m = monthOf(day);
          if (useAppStore.getState().twinMonth !== m) {
            useAppStore.setState({ twinMonth: m });
          }
        }}
      />

      {/* Twin: round logo button that opens the ask pill and answer card */}
      <Twin />

      </>)}

      {!simProps && <p className="fv-credit fv-onmap" style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", margin: 0, whiteSpace: "nowrap" }}>
        This tool supports, and does not replace, local agronomic expertise.
      </p>}
    </div>
  );
}
