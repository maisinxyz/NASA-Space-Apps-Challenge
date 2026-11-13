export type BadgeVariant = "pre-built" | "mock" | "illustrative" | "coarse";

const BADGES: Record<BadgeVariant, { label: string; title: string; className: string }> = {
  "pre-built": {
    label: "Pre-built",
    title: "Curated site, prepared ahead of time from open data.",
    className: "border-accent bg-accent text-accent-ink",
  },
  mock: {
    label: "mock",
    title: "Development fixture data. Not real. Must never reach the demo.",
    className: "border-black/40 bg-mock text-black uppercase tracking-wider",
  },
  illustrative: {
    label: "Illustrative (synthetic)",
    title: "Made up for illustration. Not real field boundaries or crops.",
    className: "border-dashed border-ink-muted bg-transparent text-ink",
  },
  coarse: {
    label: "coarse",
    title: "Low-resolution data. Do not read it as fine-scale detail.",
    className: "border-ink-muted bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--line)_4px_6px)] text-ink",
  },
};

export function Badge({ variant }: { variant: BadgeVariant }) {
  const b = BADGES[variant];
  return (
    // Presenter mode hides dev-only badges by CSS; the header keeps a plain "mock data" note instead.
    <span title={b.title} data-dev-only={variant === "mock" ? "" : undefined} className={`inline-flex items-center rounded border px-1.5 py-px align-middle text-[0.7rem] leading-4 font-semibold ${b.className}`}>
      {b.label}
    </span>
  );
}
