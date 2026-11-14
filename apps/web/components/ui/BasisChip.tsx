import type { BasisOrRelative } from "@/lib/api/types";

export const BASIS_DESCRIPTIONS: Record<BasisOrRelative, string> = {
  measured: "Observed directly by an instrument or survey.",
  derived: "Calculated from measured data, for example slope from the elevation grid.",
  modeled: "Output of a simulation model, not an observation.",
  assumed: "A stated assumption, not observed at this site.",
  relative: "Only meaningful when compared with other options. Not an absolute amount.",
};

const DOT: Record<BasisOrRelative, string> = {
  measured: "bg-basis-measured",
  derived: "bg-basis-derived",
  modeled: "bg-basis-modeled",
  assumed: "bg-basis-assumed",
  relative: "bg-basis-relative",
};

const UNKNOWN_DESCRIPTION = "This basis label is newer than this page. Treat the value with caution.";

export function isBasis(v: unknown): v is BasisOrRelative {
  return typeof v === "string" && v in BASIS_DESCRIPTIONS;
}

/**
 * Basis label from the contract enum. The word is always visible; hover shows what it means, screen readers
 * get it as text. Not a tab stop: dashboards show dozens of chips (B10), and /methods explains every basis.
 */
export function BasisChip({ basis: raw }: { basis: BasisOrRelative }) {
  // Contract v1.1 rule: enum values this build does not know render as a neutral chip, never a crash.
  const known = isBasis(raw);
  const basis = known ? raw : "unknown";
  const description = known ? BASIS_DESCRIPTIONS[raw] : UNKNOWN_DESCRIPTION;
  return (
    <span
      data-basis={basis}
      className="group relative inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-1.5 py-px align-middle font-sans text-[0.7rem] leading-4 font-medium tracking-wide text-ink-muted lowercase"
    >
      <span aria-hidden className={`size-1.5 rounded-full ${known ? DOT[raw] : "bg-line"}`} />
      {basis}
      <span className="sr-only">: {description}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden w-56 rounded-md border border-line bg-surface p-2 text-xs font-normal tracking-normal text-ink normal-case shadow-md group-hover:block"
      >
        <b className="capitalize">{basis}</b>: {description}
      </span>
    </span>
  );
}
