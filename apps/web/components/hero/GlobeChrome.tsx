"use client";

import { useState, type ReactNode } from "react";
import { CopilotComposer, type PlaceNavigation } from "@/components/copilot/CopilotComposer";
import { useCopilot } from "@/lib/copilot/copilot";

export function GlobeAssistant({ navigation, onAsk }: {
  navigation: PlaceNavigation;
  onAsk(question: string, farmId: string): void;
}) {
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const submit = (value: string) => {
    const candidates = [
      /\b(?:ubc|university of british columbia)\b/i.test(value) && "ubc-farm",
      /\b(?:kpu|langley|kwantlen)\b/i.test(value) && "kpu-langley",
    ].filter((id): id is string => !!id);
    if (candidates.length === 1) {
      onAsk(value, candidates[0]);
    } else {
      setQuestion(value);
      setDraft("");
    }
  };
  return (
    <section aria-label="FieldTwin assistant" className="rounded-2xl border border-white/20 bg-[#111a20]/95 p-3 text-white shadow-xl">
      <h2 className="mb-2 px-1 text-sm font-semibold">FieldTwin assistant</h2>
      {question && <div className="mb-3 px-1 text-sm" aria-live="polite">
        <p className="mb-2">Which farm should I use to answer “{question}”?</p>
        <div className="flex gap-2">
          {(["ubc-farm", "kpu-langley"] as const).map((id) => (
            <button key={id} type="button" className="rounded-full border border-white/30 px-3 py-1"
              onClick={() => onAsk(question, id)}>{id === "ubc-farm" ? "UBC Farm" : "KPU Langley"}</button>
          ))}
        </div>
      </div>}
      <CopilotComposer navigation={{
        ...navigation,
        onPick: (hit) => {
          setQuestion("");
          if (hit.kind === "farm" && question) onAsk(question, hit.id);
          else navigation.onPick(hit);
        },
      }} value={draft} onChange={setDraft} onAsk={submit} />
    </section>
  );
}

export function GlobeChrome({ navigation, onAsk, controls }: {
  navigation: PlaceNavigation;
  onAsk(question: string, farmId: string): void;
  controls: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <h1 className="sr-only">FieldTwin</h1>
      <details className="pointer-events-auto absolute left-4 top-4 max-w-[calc(100%-32px)] text-white">
        <summary className="w-fit cursor-pointer list-none rounded-full border border-white/25 bg-[#111a20]/95 px-4 py-2 text-sm" aria-label="Globe menu">☰ Menu</summary>
        <div className="mt-2 w-fit rounded-xl border border-white/20 bg-[#111a20]/95 p-3">{controls}</div>
      </details>
      <div className="pointer-events-auto absolute bottom-6 left-4" style={{ width: "min(420px, calc(100% - 32px))" }}>
        <GlobeAssistant navigation={navigation} onAsk={onAsk} />
      </div>
    </div>
  );
}
