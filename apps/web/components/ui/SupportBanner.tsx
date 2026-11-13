export const SUPPORT_SENTENCE = "This tool supports, and does not replace, local agronomic expertise.";

export function SupportBanner() {
  return (
    <p role="note" className="border-b border-line bg-surface-2 px-4 py-1.5 text-center text-xs text-ink-muted">
      {SUPPORT_SENTENCE}
    </p>
  );
}
