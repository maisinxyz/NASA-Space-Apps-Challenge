"use client";
// One small card per lens, top right under the condition pills. Numbers first, thin bars, a basis label on every
// figure. Absolute estimates carry a p10–p90 range (CLAUDE.md). All values: synthetic demo data.
import { BASELINE, FIELD_FUTURE, GROUND_TRUTH, HEAVY_RAIN, STORM, YEARS } from "@/lib/farm-future/fixtures";
import { conditionsAt, dateAt, fieldAnomaly, groundwaterSeries, moistureBand, MONTH_NAMES, waterBalanceAt } from "@/lib/farm-future/model";
import { useFutureStore, type LensId } from "@/lib/farm-future/store";
import { SAMPLE_FIELDS } from "@/lib/farm-view/sample";
import { color, layout } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

import { FvButton } from "@/components/farm-view/FvButton";
import { lensLabel } from "./Controls";
import { Basis, CardHead, Headline, Label, MUTED_RED, Num, PopCard, Row, Sparkline, SyntheticBadge, ThinBar } from "./ui";

const fieldName = (id: string) => SAMPLE_FIELDS.find((f) => f.id === id)?.name ?? id;
const dateLabel = (doy: number) => { const d = dateAt(doy / 365); return `${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}`; };

export function LensCard() {
  const lens = useFutureStore((s) => s.lens);
  const panel = useFutureStore((s) => s.panel);
  const openPanel = useFutureStore((s) => s.openPanel);
  return (
    <PopCard open={!!lens && panel === "lens"} label={lens ? lensLabel(lens) : "Lens"} testId="lens-card" style={{ right: layout.card.right, top: layout.card.top, width: 320 }}>
      {lens && <CardHead title={lensLabel(lens)} onMinimize={() => openPanel(null)} />}
      {lens && <LensBody lens={lens} />}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><SyntheticBadge /></div>
    </PopCard>
  );
}

function LensBody({ lens }: { lens: LensId }) {
  const t = useFutureStore((s) => s.t);
  const w = useFutureStore((s) => s.whatIf);
  const goTo = useFutureStore((s) => s.goTo);
  const setPlaying = useFutureStore((s) => s.setPlaying);
  const c = conditionsAt(t, w);
  const d = dateAt(t);

  switch (lens) {
    case "heat":
      return (
        <>
          <Headline sub={`days above 30 °C in ${d.year}`} basis="modeled"><Num value={c.heatDays} /></Headline>
          <p className="ff-p"><Num value={c.heatDelta} signed /> vs 2026. Mean temperature <Num value={c.tempAnomalyC} decimals={1} signed /> °C.</p>
          <YearBars values={BASELINE.heatDays.map((v) => v + w.tempC * 4.5)} sel={d.yearIndex} label="Heat days per year, 2026 to 2035" />
        </>
      );
    case "rain": {
      const events = HEAVY_RAIN.filter((e) => e.yearIndex <= d.yearIndex);
      return (
        <>
          <Headline sub={`rain in ${d.year}`} basis="modeled"><Num value={c.rainMm} unit=" mm" /></Headline>
          <p className="ff-p"><Num value={c.rainDeltaPct} signed unit="%" /> vs 2026, but the downpours get bigger.</p>
          <Label>Heavy events so far</Label>
          {events.slice(-4).map((e, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "88px 1fr 48px", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span style={{ color: color.inkSecondary }}>{dateLabel(e.doy)} {YEARS[e.yearIndex]}</span>
              <ThinBar frac={e.mm / 70} />
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{e.mm} mm</span>
            </div>
          ))}
        </>
      );
    }
    case "frost": {
      const i = d.yearIndex;
      return (
        <>
          <Headline sub={`frost-free days in ${d.year}`} basis="modeled"><Num value={c.frostFreeDays} /></Headline>
          <Row k="Last spring frost" v={`${dateLabel(BASELINE.lastSpringFrostDoy[i])} (2026: ${dateLabel(BASELINE.lastSpringFrostDoy[0])})`} />
          <Row k="First autumn frost" v={`${dateLabel(BASELINE.firstFallFrostDoy[i])} (2026: ${dateLabel(BASELINE.firstFallFrostDoy[0])})`} />
          <p className="ff-p">Frost windows slide on the timeline as years pass.</p>
        </>
      );
    }
    case "water": {
      const wb = waterBalanceAt(t, w);
      const max = Math.max(wb.rain + wb.irrigation, wb.cropUse + wb.runoff);
      return (
        <>
          <Headline sub={`season balance, ${d.year}`} basis="derived"><Num value={wb.net} unit=" mm" /></Headline>
          {[["Rain", wb.rain, color.water, "+"], ["Irrigation", wb.irrigation, color.water, "+"], ["Crop water use", wb.cropUse, color.inkSecondary, "−"], ["Runoff", wb.runoff, color.inkSecondary, "−"]].map(([k, v, tone, sign]) => (
            <div key={k as string} style={{ display: "grid", gridTemplateColumns: "104px 1fr 52px", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ color: color.inkSecondary }}>{k}</span>
              <ThinBar frac={(v as number) / max} tone={tone as string} />
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sign as string}<Num value={v as number} /></span>
            </div>
          ))}
          <hr className="ff-hr" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Label>Groundwater trend, stand-in for GRACE</Label>
              <Sparkline values={groundwaterSeries()} label="Groundwater storage falling from 2026 to 2035" />
            </div>
            <Basis b="assumed" />
          </div>
        </>
      );
    }
    case "stress": {
      const ranked = FIELD_FUTURE.filter((f) => f.dryRank).sort((a, b) => (a.dryRank ?? 9) - (b.dryRank ?? 9));
      return (
        <>
          <p className="ff-p">Fields ranked by how fast they dry out after rain, {d.year}.</p>
          {ranked.map((f) => {
            const a = fieldAnomaly(f.id, t, w);
            return (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr 64px", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                <span style={{ width: 20, height: 20, borderRadius: 10, border: `1px solid ${color.ink}`, display: "grid", placeItems: "center", fontSize: 11 }}>{f.dryRank}</span>
                <span>{fieldName(f.id)}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: color.inkSecondary }}>{a > 0 ? "+" : a < 0 ? "−" : ""}{Math.abs(a)} pts</span>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Basis b="modeled" /></div>
        </>
      );
    }
    case "erosion":
      return (
        <>
          <p className="ff-p">{STORM.label} · {STORM.mm} mm in {STORM.hours} h</p>
          <Headline sub={`soil lost, ${STORM.field} · p10–p90 ${STORM.soilLossTHa.p10}–${STORM.soilLossTHa.p90}`} basis="modeled">{STORM.soilLossTHa.p50} t/ha</Headline>
          {FIELD_FUTURE.map((f) => (
            <Row key={f.id} k={fieldName(f.id)} v={<span style={{ color: f.erosion === "high" ? MUTED_RED : undefined }}>{f.erosion === "high" ? "High" : f.erosion === "medium" ? "Medium" : "Low"}</span>} />
          ))}
          <FvButton className="fv-glass fv-pill fv-auto" style={{ alignSelf: "flex-start", height: 30 }} data-testid="storm-replay"
            onClick={() => { goTo(STORM.yearIndex, STORM.doy - 3); useFutureStore.setState({ lens: "erosion", panel: "lens", zoom: "1y" }); setPlaying(true); sound.pop(); }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
            <span className="l" style={{ color: color.ink }}>Replay storm</span>
          </FvButton>
        </>
      );
    case "bare":
      return (
        <>
          <p className="ff-p">Weeks when soil is uncovered, {d.year}.</p>
          {FIELD_FUTURE.filter((f) => f.bareFrom).map((f) => {
            const on = d.doy >= (f.bareFrom ?? 0) && d.doy <= (f.bareTo ?? 0);
            return <Row key={f.id} k={fieldName(f.id)} v={<span>{dateLabel(f.bareFrom ?? 0)} – {dateLabel(f.bareTo ?? 0)}{on ? " · now" : ""}</span>} strong={on} />;
          })}
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Basis b="assumed" /></div>
        </>
      );
    case "uncertainty": {
      const b = moistureBand(t, w);
      return (
        <>
          <Headline sub={`July soil moisture, p50 · ${d.year}`} basis="modeled"><Num value={b.p50} unit="%" /></Headline>
          <p className="ff-p">p10–p90 {b.p10}–{b.p90}%. The band widens with every year out.</p>
          <p className="ff-p">The grid shows 9 km satellite pixels: one pixel spans several fields here.</p>
        </>
      );
    }
    case "soiltest":
      return (
        <>
          <p className="ff-p">Where one probe reading would narrow the forecast most.</p>
          {GROUND_TRUTH.map((g, i) => (
            <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{i + 1}. {fieldName(g.fieldId)}</span>
              <span className="ff-p">{g.why}</span>
            </div>
          ))}
        </>
      );
  }
}

/** Thin per-year bars (10), selected year in ink, others muted. */
function YearBars({ values, sel, label }: { values: number[]; sel: number; label: string }) {
  const max = Math.max(...values);
  return (
    <div role="img" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 36 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: 36 }}>
            <div style={{ width: 4, height: Math.max(2, (v / max) * 36), borderRadius: 1, background: i === sel ? color.ink : "rgba(242,235,221,0.4)" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 10, color: color.inkSecondary, fontVariantNumeric: "tabular-nums" }}>
        {YEARS.map((y) => <span key={y} style={{ flex: 1, textAlign: "center" }}>{String(y).slice(2)}</span>)}
      </div>
    </div>
  );
}

