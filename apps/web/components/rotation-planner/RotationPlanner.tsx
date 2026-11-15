"use client";
// Crop rotation planner (v4 PRD F7, D10: the core feature). Crop pool by category with search, pin and exclude
// (GET /crop-catalog, trait sources in a details row); constraints and strategy count; the current rotation and the
// generated alternatives as a 10-year year-by-season grid with the 12-month calendar of the selected year; a custom
// rotation editor scored beside the others (custom_strategies); rule explanations, crop-role badges and review flags.
// No income and no fertilizer figures (D3).
import { useEffect, useMemo, useState } from "react";

import { apiMode, getCropCatalog } from "@/lib/api/client";
import type { CropCatalog, Forecast, ForecastStrategy, RotationSlot } from "@/lib/api/types";
import { originNote } from "@/lib/farm-future/data";
import { color } from "@/lib/farm-view/tokens";
import { fmt } from "@/lib/forecast/select";
import { baseRequest } from "@/lib/forecast/sites";
import {
  buildRequest, calendarOf, categoryLabel, cropAt, cropColour, cycleOf, inputFrom, MONTHS, namesOf, plainRole, plainRule, plainSource, ruleStatus, SEASON_LABEL, SEASONS, setCell, strategiesFor, validate, type PlannerInput, type Season,
} from "@/lib/rotation-planner/planner";
import { useForecastStore } from "@/lib/forecast/store";
import { useFutureStore } from "@/lib/farm-future/store";
import { tOf } from "@/lib/farm-future/model";
import { yearOfClock } from "@/lib/forecast/select";
import { useRotationStore } from "@/lib/rotation/store";
import { usePlannerStore } from "@/lib/rotation-planner/store";

import { AskCopilot } from "@/components/copilot/AskCopilot";
import { FvButton } from "@/components/farm-view/FvButton";

const CSS = `
.rp{position:absolute;inset:16px;z-index:60;pointer-events:auto;display:grid;grid-template-columns:minmax(260px,320px) 1fr;gap:12px;color:#f2ebdd;font-size:13px}
.rp section{background:rgba(22,19,15,.94);border:1px solid rgba(242,235,221,.12);border-radius:16px;padding:14px;overflow:auto;min-height:0}
.rp h2{font-size:15px;margin:0 0 8px;font-weight:600}.rp h3{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#c9bfae;margin:12px 0 6px;font-weight:500}
.rp label{display:flex;gap:6px;align-items:center}.rp input[type=search],.rp input[type=number],.rp select{background:rgba(255,255,255,.06);color:#f2ebdd;border:1px solid rgba(242,235,221,.22);border-radius:6px;padding:4px 6px;font-size:12px}
.rp .crop{display:grid;grid-template-columns:16px 1fr auto auto;gap:6px;align-items:center;padding:3px 0;border-top:1px solid rgba(242,235,221,.06)}
.rp .chip{font-size:10.5px;border:1px solid rgba(242,235,221,.25);border-radius:9px;padding:1px 7px;background:transparent;color:#f2ebdd;cursor:pointer;min-height:0}
.rp .chip[aria-pressed=true]{background:rgba(226,184,102,.25);border-color:#E2B866}
.rp .chip.x[aria-pressed=true]{background:rgba(196,106,82,.25);border-color:#C46A52}
.rp table{border-collapse:collapse;font-size:11px}.rp td,.rp th{padding:0;border:1px solid rgba(20,16,12,.9)}
.rp th{font-weight:400;color:#c9bfae;padding:2px 4px}
.rp .cell{width:22px;height:18px;display:block}
.rp .card{border-top:1px solid rgba(242,235,221,.12);padding:12px 0;display:grid;gap:8px}
.rp .badge{display:inline-flex;font-size:10.5px;border-radius:9px;padding:1px 8px;border:1px solid rgba(242,235,221,.25);margin:0 4px 4px 0}
.rp .good{color:#9CC28A}.rp .bad{color:#C46A52}.rp .neutral{color:#c9bfae}
.rp .muted{color:#c9bfae}
@media(max-width:800px){.rp{grid-template-columns:1fr;overflow:auto}}
`;

type Run = { status: "idle" | "loading" | "ready" | "error"; forecast: Forecast | null; note: string | null; error: string | null };

export function RotationPlanner({ siteId }: { siteId: string }) {
  const open = usePlannerStore((s) => s.open);
  const close = () => usePlannerStore.setState({ open: false });
  const shared = useForecastStore();
  const base = shared.siteId === siteId ? (shared.request ?? baseRequest(siteId)) : baseRequest(siteId);
  const priorities = useRotationStore((s) => s.farmerRequest);
  const t = useFutureStore((s) => s.t);
  const focusFieldId = useFutureStore((s) => s.focusFieldId);
  const [catalog, setCatalog] = useState<CropCatalog | null>(null);
  const [input, setInput] = useState<PlannerInput | null>(() => (base ? inputFrom(base) : null));
  const [query, setQuery] = useState("");
  const fieldId = focusFieldId;
  const year = yearOfClock(t, 10);
  const [customCycle, setCustomCycle] = useState(3);
  const [editing, setEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const run: Run = { status: shared.status, forecast: shared.siteId === siteId ? shared.forecast : null, note: shared.source && shared.source !== "live" ? "Saved forecast: edited inputs require the live API." : null, error: shared.error };

  useEffect(() => {
    if (!open || catalog) return;
    getCropCatalog({ siteId }).then(setCatalog, () => getCropCatalog().then(setCatalog, () => setCatalog({ crops: [], equipment: [] })));
  }, [open, catalog, siteId]);

  const names = useMemo(() => namesOf(catalog?.crops ?? []), [catalog]);
  const name = (id: string) => (id === "fallow" ? "Fallow" : (names.get(id) ?? id.replace(/^crop_/, "").replace(/_/g, " ")));

  const execute = async (i: PlannerInput) => {
    if (!base) return;
    const selected = priorities.criteria_selected.length ? priorities.criteria_selected : Object.keys(priorities.weights) as (keyof typeof priorities.weights)[];
    const weights = Object.fromEntries(selected.map((key) => [key, priorities.weights[key]]));
    if (Object.values(weights).every((value) => value === 0)) {
      setLocalError("Pick at least one thing that matters to you and give it more than zero."); return;
    }
    setLocalError(null);
    await useForecastStore.getState().run(siteId, { ...buildRequest(base, i), priorities: { criteria_selected: priorities.criteria_selected, weights } });
  };

  useEffect(() => {
    if (open && base) setInput(inputFrom(base));
    // Refresh on opening or farm change, not while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId]);

  if (!open || !base || !input) return null;
  const problems = validate(input);
  const set = (p: Partial<PlannerInput>) => setInput({ ...input, ...p });
  const toggle = (list: "pool" | "pinned" | "excluded", id: string) => {
    const cur = input[list];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    const patch: Partial<PlannerInput> = { [list]: next };
    if (list === "pinned" && !cur.includes(id)) patch.excluded = input.excluded.filter((x) => x !== id);
    if (list === "excluded" && !cur.includes(id)) patch.pinned = input.pinned.filter((x) => x !== id);
    if (list !== "pool" && !input.pool.includes(id)) patch.pool = [...input.pool, id];
    set(patch);
  };
  const crops = (catalog?.crops ?? []).filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toLowerCase()));
  const byCategory = new Map<string, typeof crops>();
  for (const c of crops) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);
  const poolIds = input.pool.filter((c) => !input.excluded.includes(c));
  const f = run.forecast;
  const { field, strategies } = f ? strategiesFor(f, fieldId) : { field: undefined, strategies: [] as ForecastStrategy[] };
  const current = strategies.find((s) => s.role === "existing");

  const startEdit = (from?: ForecastStrategy) => {
    const cycle = from ? Math.min(10, from.cycle_years) : customCycle;
    setCustomCycle(cycle);
    set({ custom: from ? cycleOf(from.plan, cycle) : (input.custom ?? []) });
    setEditing(true);
  };

  return (
    <div className="rp" role="dialog" aria-modal="false" aria-label="Plan your crop rotation" data-testid="rotation-planner">
      <style>{CSS}</style>
      <section aria-label="Crops and your farm limits">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>1. Pick crops you could grow</h2>
          <FvButton className="ff-link" onClick={close} data-testid="planner-close">Close</FvButton>
        </div>
        <input type="search" placeholder="Find a crop" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a crop" style={{ width: "100%" }} />
        <p className="muted" style={{ margin: "6px 0 0" }}>{poolIds.length} crops picked. Tick the box to include a crop. <b>Always use</b> puts it in every plan; <b>Never use</b> keeps it out.</p>
        {[...byCategory.entries()].map(([cat, list]) => (
          <div key={cat}>
            <h3>{categoryLabel(cat)}</h3>
            {list.map((c) => (
              <div className="crop" key={c.id} data-testid={`pool-${c.id}`}>
                <input type="checkbox" aria-label={`Include ${c.name}`} checked={input.pool.includes(c.id)} onChange={() => toggle("pool", c.id)} />
                <details>
                  <summary style={{ cursor: "pointer" }}><span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: cropColour(c.id), marginRight: 6 }} />{c.name}</summary>
                  <ul style={{ margin: "4px 0", paddingLeft: 14, color: color.inkSecondary, fontSize: 11 }}>
                    {Object.entries(c.trait_sources ?? {}).slice(0, 8).map(([k, v]) => <li key={k}><b style={{ fontWeight: 500 }}>{k.replace(/_/g, " ")}</b>: {plainSource(v as string)}</li>)}
                  </ul>
                </details>
                <button type="button" className="chip" aria-pressed={input.pinned.includes(c.id)} onClick={() => toggle("pinned", c.id)}>Always use</button>
                <button type="button" className="chip x" aria-pressed={input.excluded.includes(c.id)} onClick={() => toggle("excluded", c.id)}>Never use</button>
              </div>
            ))}
          </div>
        ))}
        {catalog && catalog.crops.length === 0 && <p className="muted">The crop list did not load.</p>}

        <h3>2. Tell us about your farm</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {(catalog?.equipment ?? []).map((e) => (
            <label key={e.id}><input type="checkbox" checked={input.constraints.equipment.includes(e.id)} onChange={() => set({ constraints: { ...input.constraints, equipment: input.constraints.equipment.includes(e.id) ? input.constraints.equipment.filter((x) => x !== e.id) : [...input.constraints.equipment, e.id] } })} />{e.label}</label>
          ))}
          {catalog && (catalog.equipment ?? []).length === 0 && <span className="muted">No special equipment to choose from.</span>}
          <label>Workers available
            <select value={input.constraints.labour_level} onChange={(e) => set({ constraints: { ...input.constraints, labour_level: e.target.value as PlannerInput["constraints"]["labour_level"] } })}>
              <option value="low">Few</option><option value="medium">Some</option><option value="high">Plenty</option>
            </select>
          </label>
          <label><input type="checkbox" checked={input.constraints.no_till} onChange={(e) => set({ constraints: { ...input.constraints, no_till: e.target.checked } })} />I do not plough (no-till)</label>
          <label><input type="checkbox" checked={input.constraints.livestock_on_farm} onChange={(e) => set({ constraints: { ...input.constraints, livestock_on_farm: e.target.checked } })} />I keep animals</label>
          <label>Longest rotation
            <input type="number" min={1} max={10} value={input.constraints.max_cycle_years} onChange={(e) => set({ constraints: { ...input.constraints, max_cycle_years: Math.min(10, Math.max(1, +e.target.value || 1)) } })} style={{ width: 52 }} /> years
          </label>
          <label>Water I can use
            <input type="number" min={0} placeholder="none" value={input.waterQuotaMm ?? ""} onChange={(e) => set({ waterQuotaMm: e.target.value === "" ? null : Math.max(0, +e.target.value) })} style={{ width: 70 }} /> mm/season
          </label>
          <label>How many plans to suggest
            <select value={input.strategyCount} onChange={(e) => set({ strategyCount: +e.target.value })} data-testid="planner-count">
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="muted">(your current plan counts as one)</span>
          </label>
        </div>
        {problems.map((p) => <p key={p} role="alert" className="bad" style={{ margin: "6px 0 0" }}>{p}</p>)}
        <FvButton className="fv-seg fv-accent-btn" style={{ marginTop: 10, width: "100%", background: "linear-gradient(180deg,#c3d6f4,#a3bfe9)", color: "#05070c", fontWeight: 600 }} disabled={problems.length > 0 || run.status === "loading"} onClick={() => execute(input)} data-testid="planner-run">
          {run.status === "loading" ? "Working…" : "3. Show me plans"}
        </FvButton>
      </section>

      <section aria-label="Crop plans">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Crop plans for the next 10 years</h2>
          {f && (
            <label>Field
              <select value={fieldId ?? ""} onChange={(e) => useFutureStore.setState({ focusFieldId: e.target.value || null })} data-testid="planner-field">
                <option value="">All fields</option>
                {f.fields.map((x) => <option key={x.field_id} value={x.field_id}>{x.name}</option>)}
              </select>
            </label>
          )}
          <label>Show year
            <select value={year} onChange={(e) => useFutureStore.getState().setT(tOf(+e.target.value - 1, 194))}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          </label>
        </div>
        {apiMode !== "live" && <p className="muted">Edits cannot be scored without the live API.</p>}
        {shared.request && JSON.stringify(inputFrom(shared.request)) !== JSON.stringify(input) && <p className="muted">Planner edits are not yet scored; showing the last accepted forecast.</p>}
        {shared.request && shared.source === "live" && <button type="button" className="chip" onClick={() => {
          const blob = new Blob([JSON.stringify({ version: 1, site_id: siteId, request: shared.request }, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${siteId}-forecast-request.json`; link.click(); URL.revokeObjectURL(url);
        }}>Download accepted forecast inputs</button>}
        {shared.request && <p className="muted">To rerun, post the downloaded JSON’s request property to /api/v1/sites/{siteId}/forecast.</p>}
        {run.note && <p className="muted" data-testid="planner-note">{run.note}</p>}
        {run.status === "loading" && <p role="status">Working out the plans…</p>}
        {localError ? <p role="alert" className="bad">{localError}</p> : run.status === "error" && <p role="alert" className="bad">{run.error}</p>}
        {f && !fieldId && f.fields.length > 1 && <p className="muted">Crop order shown for {field?.name}; the numbers cover all {f.fields.length} fields.</p>}

        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} f={f!} fieldId={fieldId} year={year} name={name} onEdit={s.role === "existing" ? () => startEdit(s) : undefined} />
        ))}

        <div className="card" data-testid="custom-editor">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Build your own plan</strong>
            {!editing && <FvButton className="fv-seg" onClick={() => startEdit(current)} data-testid="edit-current">Start from my current plan</FvButton>}
            {!editing && <FvButton className="fv-seg" onClick={() => { setInput({ ...input, custom: [] }); setEditing(true); }}>Start from a blank plan</FvButton>}
            {editing && (
              <label>Repeats every
                <select value={customCycle} onChange={(e) => { const n = +e.target.value; setCustomCycle(n); set({ custom: (input.custom ?? []).filter((x) => x.year_index <= n) }); }}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select> years, then starts over until year 10
              </label>
            )}
          </div>
          {editing && (
            <>
              <table aria-label="Build your own plan">
                <thead><tr><th />{Array.from({ length: customCycle }, (_, i) => <th key={i}>Year {i + 1}</th>)}</tr></thead>
                <tbody>
                  {SEASONS.map((season) => (
                    <tr key={season}>
                      <th style={{ textAlign: "left" }}>{SEASON_LABEL[season]}</th>
                      {Array.from({ length: customCycle }, (_, i) => {
                        const v = cropAt(input.custom ?? [], i + 1, season);
                        return (
                          <td key={i} style={{ background: v ? cropColour(v) : "transparent" }}>
                            <select aria-label={`Year ${i + 1} ${season}`} value={v ?? ""} data-testid={`custom-${i + 1}-${season}`} onChange={(e) => set({ custom: setCell(input.custom ?? [], i + 1, season as Season, e.target.value || null) })} style={{ width: 92, background: "rgba(10,8,6,.7)", border: 0 }}>
                              <option value="">—</option>
                              {poolIds.map((c) => <option key={c} value={c}>{name(c)}</option>)}
                              <option value="fallow">Fallow</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", gap: 8 }}>
                <FvButton className="fv-seg" disabled={!input.custom?.length || problems.length > 0 || run.status === "loading"} onClick={() => execute(input)} data-testid="custom-score">Add it to the comparison</FvButton>
                <FvButton className="fv-seg" onClick={() => { set({ custom: null }); setEditing(false); }}>Remove my plan</FvButton>
              </div>
            </>
          )}
        </div>
        {f && <p className="muted">{f.support_sentence} This is a forecast, not an order to plant.</p>}
      </section>
    </div>
  );
}

const TRAJ: { key: string; label: string; note?: string }[] = [
  { key: "soil_organic_index", label: "Soil richness", note: "(100 = today)" },
  { key: "bare_weeks", label: "Weeks the ground is bare" },
  { key: "irrigation_need_mm", label: "Extra watering needed" },
  { key: "pest_pressure_index", label: "Pests and disease" },
];

function StrategyCard({ s, f, fieldId, year, name, onEdit }: { s: ForecastStrategy; f: Forecast; fieldId: string | null; year: number; name(id: string): string; onEdit?(): void }) {
  const traj = (fieldId ? s.trajectories : f.farm_rollup.strategies.find((x) => x.id === s.id)?.trajectories ?? s.trajectories) as Record<string, { unit: string; points: { year: number; p50: number; p10?: number; p90?: number }[] } | undefined>;
  const label = s.role === "existing" ? "Your current plan" : s.role === "custom" ? `Your own plan · ${s.label}` : s.label;
  const ex = s.rotation_explanation;
  const cal = calendarOf(s.plan, year);
  const flags = s.review_flags;
  return (
    <div className="card" data-testid={`planner-strategy-${s.id}`}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong>{label}</strong>
        <span className="muted">repeats every {s.cycle_years} {s.cycle_years === 1 ? "year" : "years"}</span>
        {onEdit && <FvButton className="fv-seg" onClick={onEdit} data-testid="edit-rotation">Edit</FvButton>}
        <AskCopilot kind="strategy" id={s.id} strategyId={s.id} fieldId={fieldId} question={`Why is "${label}" suggested for this farm, and what should I check on my farm?`} />
      </div>
      {originNote(s.role) && <span className="muted" data-testid="planner-origin" style={{ fontSize: 11 }}>{originNote(s.role)}</span>}
      <table aria-label={`${label}: what grows in each season, years 1 to 10`}>
        <thead><tr><th />{Array.from({ length: 10 }, (_, i) => <th key={i} style={{ fontWeight: i + 1 === year ? 600 : 400 }}>{i + 1}</th>)}</tr></thead>
        <tbody>
          {SEASONS.map((season) => (
            <tr key={season}>
              <th style={{ textAlign: "left" }}>{SEASON_LABEL[season]}</th>
              {Array.from({ length: 10 }, (_, i) => {
                const c = cropAt(s.plan, i + 1, season);
                return <td key={i} title={c ? `Year ${i + 1} ${season}: ${name(c)}` : `Year ${i + 1} ${season}: nothing planned`}><span className="cell" style={{ background: c ? cropColour(c) : "rgba(255,255,255,.04)" }} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div aria-label={`Year ${year} calendar`} style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 2, fontSize: 10 }}>
        {cal.map((c, m) => (
          <div key={m} title={c ? name(c) : "nothing planned"} style={{ textAlign: "center" }}>
            <div style={{ height: 8, borderRadius: 2, background: c ? cropColour(c) : "rgba(255,255,255,.06)" }} />
            <span className="muted">{MONTHS[m]}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11 }}>
        {[...new Set(cycleOf(s.plan, s.cycle_years).map((x) => x.crop_id))].map((c) => (
          <span key={c} className="badge"><span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: cropColour(c), marginRight: 5, alignSelf: "center" }} />{name(c)}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", fontSize: 12 }}>
        {TRAJ.map((t) => {
          const series = traj[t.key];
          const p = series?.points.find((x) => x.year === year);
          if (!series || !p) return null;
          return <span key={t.key}>{t.label} in year {year}: <b style={{ fontWeight: 500 }}>{fmt(p.p50, t.note ? undefined : series.unit)}</b>{p.p10 !== undefined && p.p90 !== undefined && p.p10 !== p.p90 ? <span className="muted"> ({fmt(p.p10)}–{fmt(p.p90)})</span> : null}{t.note ? <span className="muted"> {t.note}</span> : null}</span>;
        })}
      </div>
      {ex && ex.crop_roles.length > 0 && (
        <div>{ex.crop_roles.map((r) => <span key={`${r.crop_id}-${r.role}`} className="badge" title={r.text}>{plainRole(r.role)} · {name(r.crop_id)}</span>)}</div>
      )}
      {ex && ex.rules.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16 }} aria-label="Good-practice checks">
          {ex.rules.map((r) => { const st = ruleStatus(r.status); return <li key={r.rule_id}><span className={st.tone}>{plainRule(r.status)}</span> · {r.text}</li>; })}
        </ul>
      )}
      <details>
        <summary style={{ cursor: "pointer" }}>Why this plan · {flags.length} {flags.length === 1 ? "thing" : "things"} to double-check</summary>
        <p style={{ margin: "6px 0" }}>{s.evidence_card.why_suggested}</p>
        {s.evidence_card.risks_for_local_review.length > 0 && <p className="muted" style={{ margin: "4px 0" }}>Check on your farm: {s.evidence_card.risks_for_local_review.join(" ")}</p>}
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {flags.slice(0, 6).map((fl) => <li key={fl.id}><span className={fl.severity === "verify" ? "bad" : "neutral"}>{fl.severity}</span> · {fl.text}</li>)}
          {flags.length > 6 && <li className="muted">+{flags.length - 6} more</li>}
        </ul>
      </details>
    </div>
  );
}

/** Edits to a custom rotation are slots of one cycle; the engine repeats them over the horizon. */
export type CustomCycle = RotationSlot[];
