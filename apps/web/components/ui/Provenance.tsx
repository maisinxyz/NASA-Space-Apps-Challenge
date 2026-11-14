// Provenance UI (plan Phase 2): basis chip, a value with unit + chip + source popover, and a sources footer.
// Types and formatting live in lib/provenance.ts.
import { useId } from "react";

import { formatValue, metaLines, sourceLine, type SourceId, type UiBasis, type ValueMeta } from "@/lib/provenance";

import { BasisChip as ContractBasisChip, isBasis } from "./BasisChip";

export type { ValueMeta } from "@/lib/provenance";

export const SYNTHETIC_DESCRIPTION = "Made-up demo data, shown so the screen can be tried. Not real.";

/** Basis chip for any UI basis: the contract enum (ui/BasisChip) plus "synthetic". */
export function BasisChip({ basis }: { basis: UiBasis }) {
  if (isBasis(basis)) return <ContractBasisChip basis={basis} />;
  if (basis !== "synthetic") throw new Error(`BasisChip: unknown basis "${String(basis)}"`);
  return (
    <span data-basis="synthetic" title={SYNTHETIC_DESCRIPTION} className="inline-flex items-center gap-1 rounded-full border border-dashed border-mock px-1.5 py-px align-middle text-[0.7rem] leading-4 font-medium text-ink-muted lowercase">
      <span aria-hidden className="size-1.5 rounded-full bg-mock" />
      synthetic
      <span className="sr-only">: {SYNTHETIC_DESCRIPTION}</span>
    </span>
  );
}

/**
 * A number (or short text) with its unit, basis chip and a hover/focus popover naming the source and one limitation.
 * Focusable so keyboard users get the popover too; screen readers get it through aria-describedby.
 */
export function Value({ value, meta, digits, className = "" }: { value: number | string; meta: ValueMeta; digits?: number; className?: string }) {
  const id = useId();
  return (
    <span className={`group relative inline-flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      <span tabIndex={0} aria-describedby={id} className="rounded font-mono text-ink tabular-nums underline decoration-ink-muted decoration-dotted underline-offset-4">
        {formatValue(value, meta.unit, digits)}
      </span>
      <BasisChip basis={meta.basis} />
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-30 mt-1 hidden w-64 rounded-md border border-line bg-surface p-2 text-xs leading-snug text-ink shadow-lg group-focus-within:block group-hover:block"
      >
        {metaLines(meta).map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </span>
    </span>
  );
}

/** "Sources: …" line under a panel, one entry per source id (duplicates dropped). */
export function SourceFooter({ ids, className = "" }: { ids: SourceId[]; className?: string }) {
  return (
    <p className={`text-[0.7rem] leading-snug text-ink-muted ${className}`}>
      Sources: {[...new Set(ids)].map(sourceLine).join("; ")}
    </p>
  );
}
