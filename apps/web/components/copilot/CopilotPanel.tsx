"use client";
// Gus slide-over (v4 PRD F6). Connected to the screen state: farm, field, year or month, scenario sliders,
// strategy and the selected field / flag / strategy. Answers come from the numbers the server builds for that screen;
// the panel says so, names local checks, and handles slow replies and errors plainly.
import { useEffect, useRef, useState } from "react";

import { strategyOf } from "@/lib/farm-future/data";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { color } from "@/lib/farm-view/tokens";
import { MAX_MESSAGE, TERMS, termsIn, useCopilot, type ScreenState } from "@/lib/copilot/copilot";
import { siteForFarm } from "@/lib/forecast/sites";
import { useAppStore } from "@/lib/store";

import { FvButton } from "@/components/farm-view/FvButton";
import { CopilotComposer, type PlaceNavigation } from "./CopilotComposer";

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

export function CopilotPanel({ navigation, inline = false }: {
  navigation?: PlaceNavigation;
  inline?: boolean;
} = {}) {
  const { open, draft, pendingFarm, messages, status, error, send, close } = useCopilot();
  const screen = useScreenState();
  const transcript = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages, open, status]);
  useEffect(() => {
    if (!screen || pendingFarm !== screen.farmId || !draft.trim() || status === "sending") return;
    useCopilot.setState({ pendingFarm: null, open: true });
    void send(draft, screen);
  }, [screen, pendingFarm, draft, send, status]);
  if (!screen && !navigation) return null;
  const showConversation = open && !!screen;
  const location = navigation?.farms.find((farm) => farm.id === screen?.farmId)?.name.split(",")[0];
  return (
    <aside className="fv-glass" aria-label="Farm co-pilot" data-testid={showConversation ? "copilot-panel" : undefined}
      style={{ position: inline ? "relative" : "absolute", left: inline ? undefined : 16, bottom: inline ? undefined : 26, width: inline ? "100%" : "min(420px, calc(100% - 32px))", zIndex: 70, pointerEvents: "auto", borderRadius: 16, padding: 12, display: "grid", alignContent: "start", gap: 10, fontSize: 13, background: "rgba(17,26,32,.95)" }}>
      {showConversation && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="fv-rtitle" style={{ margin: 0 }}>{location ? `Ask about ${location}` : "Farm co-pilot"}</h2>
        <FvButton className="ff-link" onClick={close} data-testid="copilot-close">Minimize</FvButton>
      </div>
      <div ref={transcript} style={{ overflowY: "auto", maxHeight: "min(46dvh, 430px)", display: "grid", gap: 10, alignContent: "start" }} aria-live="polite">
        {messages.length === 0 && <button type="button" className="justify-self-start rounded-full border border-white/20 px-3 py-2 text-left"
          onClick={() => void send("What if I planted sunflower?", screen)}>What if I planted sunflower?</button>}
        {messages.map((m, i) => (
          <div key={i} data-testid={`copilot-${m.role}`} style={{ justifySelf: m.role === "user" ? "end" : "start", maxWidth: "92%", background: m.role === "user" ? "rgba(163,191,233,.18)" : "rgba(255,255,255,.06)", borderRadius: 10, padding: "8px 10px", display: "grid", gap: 6 }}>
            {m.placeholder && <b style={{ fontWeight: 500, fontSize: 11.5 }}>Placeholder sample, not a reply from Gus (mock or offline mode)</b>}
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
      </>}
      <CopilotComposer navigation={navigation} value={draft} onChange={(value) => useCopilot.setState({ draft: value })}
        busy={status === "sending"} onAsk={(value) => {
          if (!screen) {
            useCopilot.setState({ open: true, error: "Forecast chat is available at UBC Farm and KPU Langley. Search for either farm to ask about its data." });
            return;
          }
          useCopilot.setState({ open: true });
          void send(value, screen);
        }} />
      {!screen && error && <p role="status" className="text-white/80">{error}</p>}
    </aside>
  );
}
