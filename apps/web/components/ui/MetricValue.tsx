import type { BasisOrRelative } from "@/lib/api/types";

import { BasisChip, isBasis } from "./BasisChip";

export interface MetricValueProps {
  value: number | string;
  unit: string;
  basis: BasisOrRelative;
  label?: string;
  /** Maximum fraction digits for numbers. Default 1. */
  digits?: number;
  className?: string;
}

/** A number with its unit and basis chip. Missing unit or basis is a bug: it throws outside production. */
export function MetricValue({ value, unit, basis, label, digits = 1, className = "" }: MetricValueProps) {
  if (process.env.NODE_ENV !== "production" && (!unit || !isBasis(basis))) {
    throw new Error(`MetricValue${label ? ` "${label}"` : ""}: unit and a valid basis are required (got unit=${JSON.stringify(unit)}, basis=${JSON.stringify(basis)})`);
  }
  // Fixed locale so the same input renders the same text on server and client.
  const text = typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : value;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      {label && <span className="text-sm text-ink-muted">{label}</span>}
      <span className="font-mono tabular-nums text-ink">
        {text}
        <span className="ml-0.5 text-ink-muted">{unit}</span>
      </span>
      {isBasis(basis) && <BasisChip basis={basis} />}
    </span>
  );
}
