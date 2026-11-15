"use client";
// Compare mode: three strategies on one clock, a leaderboard that re-sorts live, and the review drawer.
// The map stays one 3D scene: three separate twins side by side need the multi-viewport work in the viewer
// track (see docs/progress note), so the panes here are hairline dividers over the shared map.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";

import { REVIEW_FLAGS, STRATEGIES } from "@/lib/farm-future/fixtures";
import { leaderboard, scoreAt, waterQuotaAt } from "@/lib/farm-future/model";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { AskCopilot } from "@/components/copilot/AskCopilot";
import { RotationComparison } from "./RotationComparison";
import { color } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { ChevronLeft } from "@/components/farm-view/icons";
import { Basis, EASE_OUT, Label, MUTED_RED, Num, ThinBar } from "./ui";

const DRAWER = 360;
const FIT = ["Machinery", "Buyers", "Labour", "Timing"];

export function CompareView() {
  const t = useFutureStore((s) => s.t);
  const w = useFutureStore((s) => s.whatIf);
  const reviewFor = useFutureStore((s) => s.reviewFor);
  const { setMode, openReview } = useFutureStore.getState();
  const reduced = useReducedMotion();
  const rightGap = reviewFor ? DRAWER : 0;
  const board = leaderboard(t, w);
  const { forecast } = useFutureData();

  // Engine forecast: one comparison of A, B and C (F4). The synthetic leaderboard below is the fallback only.
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
      {[1, 2].map((k) => <div key={k} aria-hidden className="ff-pane-line" style={{ left: `calc((100% - ${rightGap}px) * ${k / 3})` }} />)}

      <FvButton className="fv-back fv-onmap fv-auto" style={{ position: "absolute", left: 40, top: 30 }} data-testid="compare-exit" onClick={() => { setMode("future"); sound.close(); }}>
        <ChevronLeft size={14} />Single view
      </FvButton>

      {/* Leaderboard */}
      <section aria-label="Leaderboard" className="fv-glass fv-auto ff-card" style={{ left: `calc((100% - ${rightGap}px) / 2 - 150px)`, top: 30, width: 300, gap: 2, padding: "10px 14px" }} data-testid="leaderboard">
        <div className="ff-head"><h2 className="ff-title" style={{ color: color.inkSecondary, fontSize: 12 }}>Leaderboard · live</h2><Basis b="relative" /></div>
        <LayoutGroup>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {board.map((r, k) => (
              <motion.li key={r.s.id} layout={!reduced} transition={{ duration: 0.25, ease: EASE_OUT }} style={{ display: "grid", gridTemplateColumns: "16px 10px 1fr 32px", alignItems: "center", gap: 8, height: 28, fontSize: 12.5, borderTop: k ? `1px solid ${color.hairline}` : "none" }}>
                <span style={{ color: color.inkSecondary }}>{k + 1}</span>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: r.s.swatch }} />
                <span>{r.s.name}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}><Num value={r.score} /></span>
              </motion.li>
            ))}
          </ol>
        </LayoutGroup>
      </section>

      {/* One card per pane */}
      {STRATEGIES.map((s, i) => {
        const water = waterQuotaAt(s, t, w);
        const over = water > 100;
        return (
          <section key={s.id} aria-label={s.name} data-testid={`compare-card-${s.id}`} className="fv-glass fv-auto ff-card"
            style={{ left: `calc((100% - ${rightGap}px) * ${i / 3} + 20px)`, top: 300, width: `calc((100% - ${rightGap}px) / 3 - 40px)`, maxWidth: 340 }}>
            <div className="ff-head">
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: s.swatch }} />
              <h2 className="ff-title" style={{ fontSize: 13.5 }}>{s.name}</h2>
              <FvButton className="fv-pill" style={{ height: 24, padding: "0 8px", border: `1px solid ${color.glassBorder}`, borderRadius: 12 }} aria-label={`${REVIEW_FLAGS[s.id].length} review flags for ${s.name}`} data-testid={`flags-${s.id}`} onClick={() => openReview(reviewFor === s.id ? null : s.id)}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
                <span className="l" style={{ fontSize: 11.5 }}>{REVIEW_FLAGS[s.id].length}</span>
              </FvButton>
            </div>
            <span className="ff-sub" style={{ marginTop: -4 }}>{s.rotation}</span>
            <div className="ff-headline"><span className="ff-big" style={{ fontSize: 26 }}><Num value={scoreAt(s, t, w)} /></span><span className="ff-sub">score</span><Basis b="relative" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Label>Water demand vs quota</Label>
                <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: over ? MUTED_RED : color.inkSecondary }}><Num value={water} unit="%" /></span>
              </div>
              <motion.div animate={over && !reduced ? { x: [0, -2, 2, -1, 0] } : { x: 0 }} transition={{ duration: 0.3 }}>
                <ThinBar frac={water / 130} tone={over ? MUTED_RED : color.water} mark={100 / 130} />
              </motion.div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Label>Operational fit</Label><Basis b="assumed" /></div>
              {s.fit.map((v, k) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "70px 1fr", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: color.inkSecondary }}>{FIT[k]}</span>
                  <ThinBar frac={v} tone={color.inkSecondary} h={3} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <ReviewDrawer />
    </div>
  );
}

/** Plain-language risk list for one strategy; every flag deep-links to its zone or month. */
export function ReviewDrawer() {
  const reviewFor = useFutureStore((s) => s.reviewFor);
  const t = useFutureStore((s) => s.t);
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
