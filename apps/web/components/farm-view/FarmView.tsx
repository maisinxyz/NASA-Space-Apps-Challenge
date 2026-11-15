"use client";
// Farm view overlay (Slice A): title block, layer bar, condition pills, Field report + collapsed tab, Twin button,
// timeline. Panels are fixed-size and anchored to viewport edges; the Cesium map underneath stays draggable
// everywhere no panel covers it (root is pointer-events: none, each panel opts back in).
// Not built yet (later slices): condition cards, map layers, field popover, Twin pill/answers.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { CONDITIONS, LAYERS, SAMPLE_FIELDS, SUBTITLE, reportSummary, type ConditionId } from "@/lib/farm-view/sample";
import { color, layout, motion as m, zIndex, type LayerId } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "./FvButton";
import { ChevronLeft, ChevronRight, Droplet, Leaf, Logo, PanelLeft, RotateCcw, Thermometer, Volume2, VolumeX } from "./icons";
import { FV_CSS } from "./styles";
import { Timeline } from "./Timeline";

// tokens.ease.out as a cubic-bezier tuple for framer-motion.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const PILL_ICON: Record<ConditionId, typeof Droplet> = { rainfall: Droplet, moisture: Droplet, vigor: Leaf, heat: Thermometer };

export type FarmViewProps = {
  farmName: string;
  onBack(): void;
  onReset(): void;
};

export function FarmView({ farmName, onBack, onReset }: FarmViewProps) {
  const reduced = !!useReducedMotion();
  const [layer, setLayer] = useState<LayerId>("satellite");
  const [reportOpen, setReportOpen] = useState(false);
  const [muted, setMuted] = useState(() => sound.isMuted());

  useEffect(() => sound.installUnlock(), []);

  const pickLayer = (id: LayerId) => {
    if (id === layer) return;
    setLayer(id);
    sound.tickWeek(); // layer switch tick (map overlays arrive in Slice B)
  };
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
  const pop = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, scale: m.popFromScale }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: m.popFromScale } };

  return (
    <div className={`fv-root`} style={{ position: "absolute", inset: 0, zIndex: zIndex.chrome, pointerEvents: "none" }} data-testid="farm-view">
      <style>{FV_CSS + "@keyframes fv-spin{to{transform:rotate(360deg)}}"}</style>

      {/* Title block: text straight on the map, no glass, no scrim. */}
      <div className="fv-onmap" style={{ position: "absolute", left: layout.title.left, top: layout.title.top }}>
        <FvButton className="fv-back fv-auto" aria-label="Back to the globe" onClick={onBack} data-testid="back-to-globe">
          <ChevronLeft size={14} />
          Globe
        </FvButton>
        <h1 className="fv-title">{farmName}</h1>
        <p className="fv-sub">{SUBTITLE}</p>
      </div>

      {/* Layer bar */}
      <div className="fv-glass fv-bar fv-auto" role="radiogroup" aria-label="Map layer" onKeyDown={onBarKey} style={{ position: "absolute", right: layout.layerBar.right, top: layout.layerBar.top }}>
        {LAYERS.map((l) => (
          <FvButton key={l.id} className="fv-seg" role="radio" aria-checked={layer === l.id} tabIndex={layer === l.id ? 0 : -1} data-testid={`layer-${l.id}`} onClick={() => pickLayer(l.id)}>
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

      {/* Condition pills (cards arrive in Slice B) */}
      <LayoutGroup>
        <div style={{ position: "absolute", right: layout.pillRow.right, top: layout.pillRow.top, display: "flex", gap: layout.pillRow.gap }}>
          {CONDITIONS.map((c) => {
            const Icon = PILL_ICON[c.id];
            return (
              <FvButton key={c.id} layout className="fv-glass fv-pill fv-auto" aria-expanded={false} data-testid={`condition-pill-${c.id}`} onClick={() => sound.tickWeek()}>
                <Icon size={layout.pillRow.icon} />
                <span className="l">{c.label}</span>
                <span className="v">{c.value}</span>
              </FvButton>
            );
          })}
        </div>
      </LayoutGroup>

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
            <p className="fv-sum">{reportSummary()}</p>
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
                {SAMPLE_FIELDS.map((f) => (
                  <tr key={f.id} className="fv-row" data-testid={`field-report-row-${f.id}`} onPointerDown={() => sound.tap()}>
                    <td className="n">{f.name}</td>
                    <td>{f.moisture}%</td>
                    <td>{f.ndvi.toFixed(2)}</td>
                    <td className="s" style={{ paddingLeft: 15 }}>
                      <span className={f.status === "Dry" || f.status === "Stressed" ? "fv-diamond" : "fv-dot"} aria-hidden />
                      {f.status}
                    </td>
                  </tr>
                ))}
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

      <Timeline reduced={reduced} />

      {/* Twin: round button, logo only (the pill and answers arrive in Slice C) */}
      <div style={{ position: "absolute", left: "50%", bottom: layout.twinButton.bottom, transform: "translateX(-50%)", zIndex: zIndex.twin }}>
        <FvButton className="fv-glass fv-twin fv-auto" aria-label="Ask Twin" aria-expanded={false} data-testid="twin-button" style={{ color: color.ink }}>
          <Logo size={layout.twinButton.icon} />
        </FvButton>
      </div>

      <p className="fv-credit fv-onmap" style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", margin: 0, whiteSpace: "nowrap" }}>
        This tool supports, and does not replace, local agronomic expertise.
      </p>
    </div>
  );
}
