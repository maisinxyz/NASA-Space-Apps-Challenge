"use client";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs. */
export function Tabs({ items, label, initialId }: { items: TabItem[]; label: string; initialId?: string }) {
  const [active, setActive] = useState(initialId ?? items[0]?.id);
  const base = useId();

  function onKeyDown(e: KeyboardEvent) {
    const i = items.findIndex((t) => t.id === active);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = items[(next + items.length) % items.length].id;
    setActive(id);
    document.getElementById(`${base}-tab-${id}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 border-b border-line">
        {items.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`${base}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${selected ? "border-accent font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div key={t.id} id={`${base}-panel-${t.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${t.id}`} hidden={t.id !== active} tabIndex={0} className="pt-4">
          {t.content}
        </div>
      ))}
    </div>
  );
}
