// The farm list: always available next to the globe. It is also the keyboard / screen-reader path to every
// farm and the fallback when the globe cannot load.
import type { Farm, FarmTier } from "./types";

export const TIER_LABEL: Record<FarmTier, string> = { twin: "Full digital twin", explore: "Explore only" };

/** Tier as words (never colour alone). */
export function TierTag({ tier }: { tier: FarmTier }) {
  return <span className={`inline-flex rounded border px-1.5 py-px text-[0.7rem] leading-4 font-semibold ${tier === "twin" ? "border-accent bg-accent text-accent-ink" : "border-dashed border-ink-muted text-ink"}`}>{TIER_LABEL[tier]}</span>;
}

export function FarmList({ farms, selectedId, onSelect, className = "" }: { farms: Farm[]; selectedId: string | null; onSelect(id: string): void; className?: string }) {
  return (
    <section aria-labelledby="farm-list-title" className={`rounded-lg border border-line bg-surface/90 p-3 text-ink ${className}`}>
      <h2 id="farm-list-title" className="text-sm font-semibold">
        Research farms and farmland
      </h2>
      <ul className="mt-2 grid gap-1">
        {farms.map((f) => (
          <li key={f.id}>
            <button type="button" aria-pressed={f.id === selectedId} onClick={() => onSelect(f.id)} className={`w-full rounded-md border px-2 py-1.5 text-left hover:bg-surface-2 ${f.id === selectedId ? "border-accent bg-surface-2" : "border-transparent"}`}>
              <span className="block text-sm font-medium">{f.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                {f.country}
                <TierTag tier={f.tier} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
