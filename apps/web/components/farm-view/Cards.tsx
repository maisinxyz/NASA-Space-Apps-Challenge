"use client";
// Condition card (one at a time, opened from its pill) and the map layer legend (design-spec §2.4, §2.6).
// Charts and map overlays are later work; the copy and numbers here are SAMPLE data and say so.
import { motion, useReducedMotion } from "framer-motion";

import { CONDITION_CARDS, LAYER_LEGENDS, type ConditionId } from "@/lib/farm-view/sample";
import { layout, motion as m, zIndex, type LayerId } from "@/lib/farm-view/tokens";

import { FvButton } from "./FvButton";
import { Droplet, Leaf, Minus, Thermometer } from "./icons";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const ICON: Record<ConditionId, typeof Droplet> = { rainfall: Droplet, moisture: Droplet, vigor: Leaf, heat: Thermometer };

export function ConditionCard({ id, onClose }: { id: ConditionId; onClose(): void }) {
  const reduced = useReducedMotion();
  const c = CONDITION_CARDS[id];
  const Icon = ICON[id];
  return (
    <motion.section
      id={`condition-card-${id}`}
      data-testid={`card-${id}`}
      data-card-id={id}
      aria-label={c.title}
      className="fv-glass fv-card fv-auto"
      style={{ position: "absolute", right: layout.card.right, top: layout.card.top, zIndex: zIndex.cards, transformOrigin: "top right" }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: m.popFromScale, y: m.popFromY }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: m.popEnterMs / 1000, ease: EASE_OUT } }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: m.popFromScale, y: m.popFromY, transition: { duration: m.popExitMs / 1000, ease: EASE_OUT } }}
    >
      <div className="fv-chead">
        <Icon size={16} />
        <h2>{c.title}</h2>
        <FvButton
          className="fv-icon"
          style={{ width: 28, height: 28, marginLeft: "auto" }}
          aria-label={`Minimize ${c.title}`}
          data-testid={`card-fold-${id}`}
          onClick={onClose}
        >
          <Minus size={16} />
        </FvButton>
      </div>
      <p className="fv-big"><span className="b">No data</span></p>
    </motion.section>
  );
}

export function LayerLegend({ layer }: { layer: LayerId }) {
  const l = LAYER_LEGENDS[layer];
  if (!l) return null;
  return (
    <motion.section
      key={layer}
      data-testid="layer-legend"
      aria-label={l.title}
      className="fv-glass fv-legend fv-auto"
      style={{ position: "absolute", right: layout.legend.right, bottom: layout.legend.bottom, zIndex: zIndex.cards }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: m.layerFadeMs / 1000, ease: "linear" }}
    >
      <h2>{l.title}</h2>
      <p className="fv-big"><span className="b">No data</span></p>
    </motion.section>
  );
}
