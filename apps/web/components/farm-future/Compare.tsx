"use client";
// Compare mode: the engine rotation comparison and the review drawer.
// The map stays one 3D scene: three separate twins side by side need the multi-viewport work in the viewer
// track (see docs/progress note), so the panes here are hairline dividers over the shared map.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { AskCopilot } from "@/components/copilot/AskCopilot";
import { RotationComparison } from "./RotationComparison";
import { color } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { ChevronLeft } from "@/components/farm-view/icons";
import { EASE_OUT, MUTED_RED, NoData } from "./ui";

const DRAWER = 360;

export function CompareView() {
  const reviewFor = useFutureStore((s) => s.reviewFor);
  const { setMode } = useFutureStore.getState();
  const rightGap = reviewFor ? DRAWER : 0;
  const { forecast } = useFutureData();

  // Engine forecast: one comparison of A, B and C (F4). Without a forecast there is no data.
  if (forecast) {
    return (
      <div data-testid="compare-view" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <FvButton className="fv-back fv-onmap fv-auto" style={{ position: "absolute", left: 40, top: 30 }} data-testid="compare-exit" onClick={() => { setMode("future"); sound.close(); }}>
          <ChevronLeft size={14} />Single view
        </FvButton>
        <section aria-label="Compare strategies" className="fv-glass fv-auto ff-card" style={{ left: 40, right: 40 + rightGap, top: 76, maxHeight: "calc(100% - 300px)", overflowY: "auto" }}>
          <RotationComparison />
        </section>
        <ReviewDrawer />
      </div>
    );
  }

  return (
    <div data-testid="compare-view" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <FvButton className="fv-back fv-onmap fv-auto" style={{ position: "absolute", left: 40, top: 30 }} data-testid="compare-exit" onClick={() => { setMode("future"); sound.close(); }}>
        <ChevronLeft size={14} />Single view
      </FvButton>
      <section aria-label="Compare strategies" className="fv-glass fv-auto ff-card" style={{ left: 40, right: 40 + rightGap, top: 76 }}>
        <NoData />
      </section>
      <ReviewDrawer />
    </div>
  );
}

/** Plain-language risk list for one strategy; every flag deep-links to its zone or month. */
export function ReviewDrawer() {
  const reviewFor = useFutureStore((s) => s.reviewFor);
  const t = useFutureStore((s) => Math.floor(s.t)); // whole years only: no re-render on every scrubber frame
  const { openReview, goTo } = useFutureStore.getState();
  const reduced = useReducedMotion();
  const { data } = useFutureData();
  const s = reviewFor ? data.strategies.find((x) => x.id === reviewFor) : undefined;
  const flags = s ? data.flags[s.id] : [];
  return (
    <AnimatePresence>
      {s && (
        <motion.aside key={s.id} aria-label={`Review flags: ${s.name}`} data-testid="review-drawer" className="ff-drawer fv-auto"
          initial={reduced ? { opacity: 0 } : { x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
          exit={{ x: reduced ? 0 : 24, opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="fv-rtitle" style={{ fontSize: 21 }}>Review · {s.name}</h2>
            <FvButton className="fv-icon" aria-label="Close review" data-testid="review-close" onClick={() => { openReview(null); sound.close(); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
            </FvButton>
          </div>
          <span className="ff-label">{flags.length} {flags.length === 1 ? "flag" : "flags"}</span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", overflowY: "auto" }}>
            {flags.map((f) => (
              <li key={f.id} data-testid="review-flag" style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 0", borderTop: `1px solid ${color.hairline}` }}>
                <span style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: f.severity === "verify" ? MUTED_RED : color.inkSecondary }}>{f.severity}</span>
                <span className="ff-p" style={{ color: color.ink }}>{f.text}</span>
                {f.fieldIds.length > 0 && <span className="ff-p">{f.fieldIds.length} {f.fieldIds.length === 1 ? "field" : "fields"}</span>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(f.fieldIds[0] || f.week !== null) && (
                    <FvButton className="ff-link" data-testid="review-goto" onClick={() => { goTo(Math.floor(t), (f.week ?? 26) * 7, f.fieldIds[0]); sound.success(); }}>
                      Go to {f.week !== null ? `week ${f.week + 1}` : "field"}
                    </FvButton>
                  )}
                  {data.source === "engine" && <AskCopilot kind="flag" id={f.id} strategyId={s.engineId} fieldId={f.fieldIds[0] ?? null} question={`Why is this flagged, and what should I check locally? "${f.text}"`} />}
                </div>
              </li>
            ))}
          </ul>
          <p className="ff-p" style={{ marginTop: "auto" }}>This tool supports, and does not replace, local agronomic expertise.</p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
