"use client";
import { type ReactNode, useEffect, useId, useState } from "react";

import { getGlossary } from "@/lib/rotation/api";
import type { GlossaryEntry } from "@/lib/rotation/draft-types";

let cache: Promise<GlossaryEntry[]> | null = null;
export function useGlossary(): GlossaryEntry[] {
  const [list, setList] = useState<GlossaryEntry[]>([]);
  useEffect(() => {
    let live = true;
    // Cache only success so a failed fetch can be retried on the next mount.
    cache ??= getGlossary().catch((e) => ((cache = null), Promise.reject(e)));
    cache.then((l) => live && setList(l), () => {});
    return () => {
      live = false;
    };
  }, []);
  return list;
}

/** Pure tooltip view (tests render it directly). Focusable, described by the tooltip text, shown on hover and focus. */
export function TermTip({ entry, children, tipId }: { entry: GlossaryEntry; children: ReactNode; tipId: string }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDismissed(true);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  return (
    <span className="group relative" onMouseEnter={() => setDismissed(false)} onFocus={() => setDismissed(false)}>
      <span tabIndex={0} aria-describedby={tipId} className="cursor-help underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent">
        {children}
      </span>
      <span id={tipId} role="tooltip" className={`absolute bottom-full left-0 z-20 hidden w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-2 text-xs font-normal text-ink shadow-md group-focus-within:block group-hover:block${dismissed ? " !hidden" : ""}`}>
        <b>{entry.term}</b>: {entry.short}
      </span>
    </span>
  );
}

/** Inline glossary term. Unknown id or glossary not loaded: plain text. */
export function GlossaryTerm({ id, children }: { id: string; children?: ReactNode }) {
  const tipId = useId();
  const entry = useGlossary().find((e) => e.id === id);
  return entry ? <TermTip entry={entry} tipId={tipId}>{children ?? entry.term}</TermTip> : <>{children ?? id}</>;
}
