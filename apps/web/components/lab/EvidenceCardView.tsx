import { Card } from "@/components/ui/Card";
import type { EvidenceCard } from "@/lib/api/types";

const PARTS = [
  ["why_suggested", "Why it is suggested"],
  ["evidence", "Evidence"],
  ["benefits", "Benefits"],
  ["information_gaps", "Information gaps"],
  ["risks_for_local_review", "Risks to review locally"],
] as const;

/** The five parts of an evidence card, then the card's own support-not-replace sentence. */
export function EvidenceCardView({ card, name }: { card: EvidenceCard; name: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-display text-lg text-ink">{name}</h3>
      {PARTS.map(([key, title]) => {
        const v = card[key];
        return (
          <section key={key}>
            <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h4>
            {typeof v === "string" ? (
              <p className="mt-0.5 text-sm text-ink">{v}</p>
            ) : v.length ? (
              <ul className="mt-0.5 list-disc pl-5 text-sm text-ink">
                {v.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-sm text-ink-muted">None listed.</p>
            )}
          </section>
        );
      })}
      <p role="note" className="mt-auto border-t border-line pt-2 text-xs text-ink-muted">
        {card.support_not_replace}
      </p>
    </Card>
  );
}
