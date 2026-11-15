"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CopilotComposer, type PlaceNavigation } from "@/components/copilot/CopilotComposer";
import { AboutPanel } from "@/components/globe/AboutPanel";

/** Compact public-site navigation, kept above the map and farm workspace. */
export function DesktopNavigation() {
  return (
    <nav aria-label="Primary navigation" className="pointer-events-auto absolute top-3 right-4 z-40 flex items-center gap-1 rounded-full border border-white/20 bg-[#111a20]/95 p-1 text-sm text-white shadow-lg">
      <Link href="/methods" className="min-h-9 rounded-full px-3 py-2 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
        Methods
      </Link>
      <Link href="/learn" className="min-h-9 rounded-full px-3 py-2 text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
        Learn
      </Link>
      <AboutPanel className="min-h-9 rounded-full border border-white/20 px-3 py-1.5 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" />
    </nav>
  );
}

export function GlobeAssistant({ navigation, onAsk, showSearchPrompt = false }: {
  navigation: PlaceNavigation;
  onAsk(question: string, farmId: string): void;
  showSearchPrompt?: boolean;
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
    <section aria-label="Stardew Earth assistant" className="rounded-2xl border border-white/20 bg-[#111a20]/95 p-3 text-white shadow-xl">
      <h2 className="mb-2 px-1 text-sm font-semibold">Stardew Earth assistant</h2>
      {showSearchPrompt && <p className="mb-2 px-1 text-xs text-white/75">Find a farm or place, or ask a farm question.</p>}
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
      <h1 className="sr-only">Stardew Earth</h1>
      <details className="pointer-events-auto absolute left-4 top-4 max-w-[calc(100%-32px)] text-white">
        <summary className="w-fit cursor-pointer list-none rounded-full border border-white/25 bg-[#111a20]/95 px-4 py-2 text-sm" aria-label="Globe menu">☰ Menu</summary>
        <div className="mt-2 w-fit rounded-xl border border-white/20 bg-[#111a20]/95 p-3">{controls}</div>
      </details>
      <p role="note" aria-label="Globe controls" className="pointer-events-none absolute right-4 bottom-6 max-w-[18rem] rounded-full border border-white/20 bg-[#111a20]/90 px-4 py-2 text-xs text-white/85 shadow-lg">
        Drag to rotate · Click the globe and use arrow keys · Scroll or press + / − to zoom
      </p>
      <div className="pointer-events-auto absolute bottom-6 left-4" style={{ width: "min(420px, calc(100% - 32px))" }}>
        <GlobeAssistant navigation={navigation} onAsk={onAsk} showSearchPrompt />
      </div>
    </div>
  );
}
