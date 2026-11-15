"use client";
// Future mode, per strategy: Strategy picker + review flags under the mode switch, and the "Soil health" panel on
// the left (collapsible to the side). Minimal charts: depth profile line chart, thin bars, plain rows.
import { useRef, useState } from "react";

import { REVIEW_FLAGS, STRATEGIES, YEARS } from "@/lib/farm-future/fixtures";
import { dateAt, soilHealthAt, strategyById } from "@/lib/farm-future/model";
import { useFutureStore } from "@/lib/farm-future/store";
import { color } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { ChevronLeft, ChevronRight } from "@/components/farm-view/icons";
import { Basis, CardHead, HAIR, Headline, Label, MUTED_RED, Num, PopCard, Row, SyntheticBadge, useDismiss } from "./ui";

export function StrategyBar() {
  const strategyId = useFutureStore((s) => s.strategyId);
  const panel = useFutureStore((s) => s.panel);
  const { setStrategy, openPanel, openReview } = useFutureStore.getState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const s = strategyById(strategyId);
  const flags = REVIEW_FLAGS[strategyId].length;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
      <div ref={ref} style={{ position: "relative" }}>
        <FvButton className="fv-glass fv-pill fv-auto" aria-haspopup="listbox" aria-expanded={open} data-testid="strategy-picker" onClick={() => setOpen(!open)}>
          <span className="l">Strategy</span>
          <span className="v" style={{ marginLeft: 0, fontWeight: 500 }}>{s.rotation}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
        </FvButton>
        {open && (
          <div role="listbox" aria-label="Strategy" className="fv-glass ff-menu fv-auto" style={{ left: 0, right: "auto", width: 260 }}>
            {STRATEGIES.map((x) => (
              <FvButton key={x.id} role="option" aria-selected={x.id === strategyId} aria-checked={x.id === strategyId} className="ff-menu-item" onClick={() => { setStrategy(x.id); setOpen(false); sound.tickWeek(); }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: x.swatch }} aria-hidden />
                <span style={{ flex: 1 }}>{x.rotation}</span>
                <span style={{ color: color.inkSecondary, fontSize: 11.5 }}>{x.name === "Current rotation" ? "now" : x.name.replace("Strategy ", "")}</span>
              </FvButton>
            ))}
          </div>
        )}
      </div>
      <FvButton className="fv-glass fv-pill fv-auto" data-testid="flags-button" aria-label={`${flags} review flags for ${s.name}`} onClick={() => openReview(strategyId)}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color.stress} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
        <span className="l" style={{ color: color.ink }}>{flags} {flags === 1 ? "flag" : "flags"}</span>
      </FvButton>
      <FvButton className="fv-glass fv-pill fv-auto" aria-expanded={panel === "soil"} data-testid="soil-toggle" onClick={() => openPanel("soil")}>
        <span className="l" style={{ color: color.ink }}>Soil health</span>
        {panel === "soil" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </FvButton>
    </div>
  );
}

export function SoilHealthPanel() {
  const panel = useFutureStore((s) => s.panel);
  const t = useFutureStore((s) => s.t);
  const strategyId = useFutureStore((s) => s.strategyId);
  const openPanel = useFutureStore((s) => s.openPanel);
  const s = strategyById(strategyId);
  const h = soilHealthAt(s, t);
  const d = dateAt(t);
  return (
    <PopCard open={panel === "soil"} origin="top left" label="Soil health" testId="soil-panel" style={{ left: 40, top: 236, width: 412, maxHeight: "calc(100vh - 236px - 210px)", overflowY: "auto" }}>
      <CardHead title={`Soil health · ${s.name}, year ${d.yearIndex + 1}`} onMinimize={() => openPanel(null)} />
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <DepthProfile before={h.profile2026} now={h.profileNow} rootDepthM={h.rootDepthM} year={d.year} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
          <Headline sub={<>topsoil organic matter, <Num value={h.omChange} decimals={1} signed /> since 2026</>} basis="modeled"><Num value={h.omPct} decimals={1} unit="%" /></Headline>
          <Label>Nitrogen, kg/ha/yr</Label>
          <Row k="In" v={h.nitrogen.inKg} />
          <Row k="Fixed by legumes" v={h.nitrogen.fixedKg ? `+${h.nitrogen.fixedKg}` : "0"} />
          <Row k="Out" v={h.nitrogen.outKg} />
          {h.nitrogen.fertSaved.p50 > 0 && (
            <span className="ff-p">Fertilizer saved <b style={{ color: color.ink, fontWeight: 500 }}>{h.nitrogen.fertSaved.p50} kg N/ha</b> (p10–p90 {h.nitrogen.fertSaved.p10}–{h.nitrogen.fertSaved.p90}) <Basis b="modeled" /></span>
          )}
        </div>
      </div>
      <hr className="ff-hr" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Label>Rain that soaks in vs runs off</Label>
          <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}><Num value={h.infiltrationPct} unit="%" /> <span style={{ color: color.inkSecondary }}><Num value={h.infiltrationChange} signed unit=" pts" /></span></span>
        </div>
        <div aria-hidden style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 2 }}>
          <div style={{ width: `${h.infiltrationPct}%`, background: color.water }} />
          <div style={{ flex: 1, background: "rgba(242,235,221,0.3)" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Pest pressure · rotation breaks reset it</Label>
          <Basis b="assumed" />
        </div>
        <div role="img" aria-label="Pest pressure per year" style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 36 }}>
          {h.pest.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: 36 }}>
              <div style={{ width: 4, height: Math.max(2, v * 0.42), borderRadius: 1, background: v > 50 ? MUTED_RED : i === d.yearIndex ? color.ink : "rgba(242,235,221,0.45)" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 10, color: color.inkSecondary, fontVariantNumeric: "tabular-nums" }}>
          {YEARS.map((y) => <span key={y} style={{ flex: 1, textAlign: "center" }}>{String(y).slice(2)}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><SyntheticBadge /></div>
    </PopCard>
  );
}

function DepthProfile({ before, now, rootDepthM, year }: { before: { d: number; v: number }[]; now: { d: number; v: number }[]; rootDepthM: number; year: number }) {
  const w = 160, h = 160;
  const sx = (v: number) => 28 + (v / 3.2) * (w - 36);
  const sy = (d: number) => 8 + (d / 100) * (h - 26);
  const line = (p: { d: number; v: number }[]) => p.map((q) => `${sx(q.v).toFixed(1)},${sy(q.d).toFixed(1)}`).join(" ");
  const rootY = sy(Math.min(100, rootDepthM * 62));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Organic matter by depth, 2026 dashed versus ${year} solid`} style={{ display: "block", flex: "none" }}>
      {[0, 50, 100].map((dd) => (
        <g key={dd}>
          <line x1={28} x2={w - 6} y1={sy(dd)} y2={sy(dd)} stroke={HAIR} />
          <text x={0} y={sy(dd) + 3.5} fontSize={10} fill={color.inkSecondary}>{dd}</text>
        </g>
      ))}
      <polyline points={line(before)} fill="none" stroke={color.inkMuted} strokeWidth={1.25} strokeDasharray="3 3" />
      <polyline points={line(now)} fill="none" stroke={color.ink} strokeWidth={1.75} />
      <line x1={28} x2={w - 6} y1={rootY} y2={rootY} stroke={color.accent} strokeWidth={1} strokeDasharray="3 3" />
      <text x={w - 6} y={rootY - 4} fontSize={10} textAnchor="end" fill={color.inkSecondary}>roots {rootDepthM} m</text>
      <text x={sx(now[2].v) + 6} y={sy(40) + 4} fontSize={10} fill={color.ink}>{year}</text>
      <text x={sx(before[3].v) - 6} y={sy(60) + 4} fontSize={10} textAnchor="end" fill={color.inkSecondary}>2026</text>
      <text x={28} y={h - 2} fontSize={10} fill={color.inkSecondary}>OM % → · depth cm ↓</text>
    </svg>
  );
}
