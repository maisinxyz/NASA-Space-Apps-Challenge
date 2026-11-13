// Card for the selected farm. Facts come from lib/farms.ts; every one links back to its source.
import { TierTag } from "./FarmList";
import type { Farm } from "./types";

export const EXPLORE_NOTE = "Simulation not available for this farm yet";
export const PRIMARY_BTN = "rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90";

/** `onOpen` is left out when there is no globe to fly in (small screens, globe failure). */
export function FarmCard({ farm, onClose, onOpen, className = "" }: { farm: Farm; onClose(): void; onOpen?: () => void; className?: string }) {
  return (
    <section aria-labelledby="farm-card-title" className={`rounded-lg border border-line bg-surface/95 p-4 text-ink shadow-lg ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 id="farm-card-title" className="font-display text-lg leading-snug">
          {farm.name}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close farm card" className="rounded border border-line px-2 text-sm hover:bg-surface-2">
          Close
        </button>
      </div>
      <p className="mt-1">
        <TierTag tier={farm.tier} />
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-muted">Operated by</dt>
        <dd>{farm.owner}</dd>
        <dt className="text-ink-muted">Country</dt>
        <dd>{farm.country}</dd>
        {farm.areaHa !== undefined && (
          <>
            <dt className="text-ink-muted">Area</dt>
            <dd>{farm.areaHa.toLocaleString("en")} ha</dd>
          </>
        )}
      </dl>
      {!farm.coordsVerified && <p className="mt-2 text-xs text-ink-muted">Approximate location: the pin is not from coordinates published by the operator.</p>}
      <p className="mt-2 text-sm">
        <a href={farm.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
          Source (opens in a new tab)
        </a>
      </p>
      {farm.tier === "explore" && <p className="mt-2 text-sm text-ink-muted">{EXPLORE_NOTE}</p>}
      {onOpen && (
        <div className="mt-3">
          <button type="button" onClick={onOpen} className={PRIMARY_BTN}>
            Open twin
          </button>
        </div>
      )}
    </section>
  );
}
