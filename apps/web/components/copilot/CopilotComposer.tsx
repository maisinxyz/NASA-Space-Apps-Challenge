"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Farm } from "@/components/globe/types";
import { searchPlaces, type Place, type SearchHit } from "@/lib/globe/search";
import { MAX_MESSAGE } from "@/lib/copilot/copilot";

export type PlaceNavigation = {
  farms: Farm[];
  includePlaces?: boolean;
  onPick(hit: SearchHit): void;
};

export function CopilotComposer({ navigation, value, onChange, onAsk, busy }: {
  navigation?: PlaceNavigation;
  value: string;
  onChange(value: string): void;
  onAsk(value: string): void;
  busy?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const farms = navigation?.farms;
  const includePlaces = navigation?.includePlaces !== false;
  useEffect(() => {
    if (!farms || !includePlaces) return;
    const controller = new AbortController();
    fetch("/hero/places.json", { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.places) setPlaces(data.places); })
      .catch(() => {});
    return () => controller.abort();
  }, [farms, includePlaces]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const placeQuery = value.trim().replace(/^(?:take me to|go to|show me|open|find|visit)\s+/i, "").replace(/[.!]+$/, "");
  const hits = useMemo(
    () => focused && farms ? searchPlaces(placeQuery, farms, includePlaces ? places : []) : [],
    [focused, farms, placeQuery, places, includePlaces],
  );
  const choose = (hit: SearchHit) => {
    setActive(-1);
    setFocused(false);
    onChange("");
    navigation?.onPick(hit);
  };

  return (
    <form className="relative flex gap-2" onSubmit={(event) => {
      event.preventDefault();
      if (hits[active] || hits[0]) choose(hits[active] ?? hits[0]);
      else if (value.trim() && !busy) {
        setFocused(false);
        onAsk(value.trim());
      }
    }}>
      <input ref={input} value={value} maxLength={MAX_MESSAGE}
        data-testid="copilot-input"
        aria-label={!navigation ? "Message Gus" : includePlaces ? "Ask a question or find a farm, city or country" : "Ask a question or find a farm"}
        placeholder={!navigation ? "Message Gus" : includePlaces ? "Ask a question or find a place" : "Ask a question or find a farm"}
        role={navigation ? "combobox" : undefined}
        aria-expanded={navigation ? hits.length > 0 : undefined}
        aria-controls={navigation && hits.length ? id : undefined}
        aria-activedescendant={hits[active] ? `${id}-${active}` : undefined}
        aria-keyshortcuts="Control+K Meta+K"
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setActive(-1); }}
        onChange={(event) => { onChange(event.target.value); setFocused(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && hits.length) {
            event.preventDefault();
            event.stopPropagation();
            setFocused(false);
            setActive(-1);
          } else if (hits.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setActive((index) => event.key === "ArrowDown" ? (index + 1) % hits.length : (index <= 0 ? hits.length - 1 : index - 1));
          }
        }}
        className="min-w-0 flex-1 rounded-full border border-white/25 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/65 focus-visible:outline-2 focus-visible:outline-sky-200"
      />
      <button type="submit" aria-label="Send" data-testid="copilot-send" disabled={busy || !value.trim()}
        onPointerDown={(event) => event.preventDefault()}
        className="rounded-full bg-[#c3d6f4] px-4 text-lg text-[#101824] disabled:opacity-50">↑</button>
      {hits.length > 0 && (
        <ul id={id} role="listbox" className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-[38vh] overflow-auto rounded-xl border border-white/20 bg-[#161f27] py-1 text-white shadow-xl">
          {hits.map((hit, index) => (
            <li key={hit.id} id={`${id}-${index}`} role="option" aria-selected={active === index}
              onPointerDown={(event) => event.preventDefault()} onClick={() => choose(hit)}
              className={`flex cursor-pointer justify-between gap-3 px-4 py-2 text-sm hover:bg-white/10 ${active === index ? "bg-white/10" : ""}`}>
              <span>{hit.name}</span><span className="shrink-0 text-xs text-white/65">{hit.kind === "farm" ? "Farm" : hit.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
