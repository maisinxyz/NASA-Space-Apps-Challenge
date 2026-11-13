"use client";
import { Legend } from "@/components/ui/Legend";
import type { ViewerLayerName, ViewerLegend } from "@/components/viewer";
import { useAppStore } from "@/lib/store";

/** Overlay toggles; each visible overlay shows its legend with unit and basis. */
export function LayerPanel({ legends }: { legends: ViewerLegend[] }) {
  const layers = useAppStore((s) => s.layers);
  const toggle = (name: ViewerLayerName, on: boolean) => useAppStore.setState({ layers: on ? [...layers, name] : layers.filter((l) => l !== name) });

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">Map layers</legend>
      {legends.length === 0 && <p className="mt-2 text-sm text-ink-muted">This terrain has no overlay layers.</p>}
      <ul className="mt-2 grid gap-3">
        {legends.map((l) => {
          const name = l.name as ViewerLayerName;
          const on = layers.includes(name);
          return (
            <li key={l.name}>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={on} onChange={(e) => toggle(name, e.target.checked)} className="size-4 accent-[var(--accent)]" />
                {l.title}
              </label>
              {on && (
                <div className="mt-2 ml-6">
                  <Legend legend={l} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
