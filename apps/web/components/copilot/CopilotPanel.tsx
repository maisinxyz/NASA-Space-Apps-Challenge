"use client";
// Farm co-pilot slide-over (v4 PRD F6). Connected to the screen state: farm, field, year or month, scenario sliders,
// strategy and the selected field / flag / strategy. Answers come from the numbers the server builds for that screen;
// the panel says so, names local checks, and handles slow replies and errors plainly.
import { useEffect, useState } from "react";

import { strategyOf } from "@/lib/farm-future/data";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { color } from "@/lib/farm-view/tokens";
import { MAX_MESSAGE, TERMS, termsIn, useCopilot, type ScreenState } from "@/lib/copilot/copilot";
import { siteForFarm } from "@/lib/forecast/sites";
import { useAppStore } from "@/lib/store";

import { FvButton } from "@/components/farm-view/FvButton";

const SLOW_MS = 8000;

export function useScreenState(): ScreenState | null {
  const farmId = useAppStore((s) => s.farmId);
  const twinFieldId = useAppStore((s) => s.twinFieldId);
  const { t, whatIf, strategyId, focusFieldId, horizon, monthIndex } = useFutureStore();
  const { data } = useFutureData();
  const c = useCopilot();
  const siteId = siteForFarm(farmId);
  if (!farmId || !siteId) return null;
  return {
    farmId,
    siteId,
    fieldId: c.fieldId ?? focusFieldId ?? twinFieldId ?? null,
    horizon,
    timeIndex: horizon === "months" ? monthIndex : Math.floor(t) + 1,
    rainPct: whatIf.rainPct,
    tempC: whatIf.tempC,
    strategyId: c.strategyId ?? (data.source === "engine" ? strategyOf(data, strategyId).engineId : null),
    selected: c.selected,
  };
}

/** Header button that opens the co-pilot about the current screen. */
export function CopilotButton() {
  const farmId = useAppStore((s) => s.farmId);
  if (!siteForFarm(farmId)) return null;
  return (
    <FvButton className="fv-glass fv-seg" data-testid="copilot-open" onClick={() => useCopilot.setState({ open: true, selected: null, strategyId: null, fieldId: null })}>
      Ask co-pilot
    </FvButton>
  );
}

export function CopilotPanel() {
  const { open, draft, messages, status, error, send, close } = useCopilot();
  const screen = useScreenState();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== "sending") return setSlow(false);
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [status]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  if (!open || !screen) return null;
  const submit = () => void send(draft, screen);
  const context = [
    screen.fieldId ? `field ${screen.fieldId}` : "whole farm",
    screen.horizon === "years" ? `year ${screen.timeIndex}` : `month ${screen.timeIndex + 1}`,
    screen.strategyId ?? "no strategy",
    screen.rainPct || screen.tempC ? `rain ${screen.rainPct > 0 ? "+" : ""}${screen.rainPct} %, temp +${screen.tempC} °C` : "baseline scenario",
  ].join(" · ");
  return (
    <aside className="fv-glass" role="complementary" aria-label="Farm co-pilot" data-testid="copilot-panel"
      style={{ position: "absolute", right: 16, top: 16, bottom: 16, width: "min(380px, calc(100% - 32px))", zIndex: 70, pointerEvents: "auto", borderRadius: 16, padding: 14, display: "grid", gridTemplateRows: "auto auto 1fr auto auto", gap: 10, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="fv-rtitle" style={{ margin: 0 }}>Farm co-pilot</h2>
        <FvButton className="ff-link" onClick={close} data-testid="copilot-close">Close</FvButton>
      </div>
      <p style={{ margin: 0, color: color.inkSecondary, fontSize: 11.5 }}>
        Answers use the forecast numbers for this screen ({context}). They are not planting orders; check them locally.
      </p>
      <div style={{ overflowY: "auto", display: "grid", gap: 10, alignContent: "start" }} aria-live="polite">
        {messages.length === 0 && <p style={{ margin: 0, color: color.inkSecondary }}>Ask about a field, a flag or a strategy.</p>}
        {messages.map((m, i) => (
          <div key={i} data-testid={`copilot-${m.role}`} style={{ justifySelf: m.role === "user" ? "end" : "start", maxWidth: "92%", background: m.role === "user" ? "rgba(163,191,233,.18)" : "rgba(255,255,255,.06)", borderRadius: 10, padding: "8px 10px", display: "grid", gap: 6 }}>
            <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
            {m.tips && m.tips.length > 0 && (
              <div><b style={{ fontWeight: 500, fontSize: 11.5 }}>Check locally</b><ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>{m.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>
            )}
            {m.role === "assistant" && termsIn(m.content).map((t) => (
              <span key={t} style={{ fontSize: 11, color: color.inkSecondary }}><abbr title={TERMS[t]}>{t}</abbr>: {TERMS[t]}</span>
            ))}
          </div>
        ))}
        {status === "sending" && <p role="status" style={{ margin: 0, color: color.inkSecondary }}>{slow ? "Still working on it. Replies can take up to a minute." : "Thinking…"}</p>}
        {error && <p role="alert" style={{ margin: 0, color: "#C46A52" }}>{error}</p>}
      </div>
      <textarea aria-label="Question for the co-pilot" data-testid="copilot-input" value={draft} maxLength={MAX_MESSAGE} rows={3}
        onChange={(e) => useCopilot.setState({ draft: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        style={{ background: "rgba(255,255,255,.06)", color: color.ink, border: "1px solid rgba(242,235,221,.22)", borderRadius: 8, padding: 8, font: "inherit", resize: "vertical" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: color.inkSecondary }}>{draft.length}/{MAX_MESSAGE}</span>
        <FvButton className="fv-seg" disabled={!draft.trim() || status === "sending"} onClick={submit} data-testid="copilot-send">Send</FvButton>
      </div>
    </aside>
  );
}
