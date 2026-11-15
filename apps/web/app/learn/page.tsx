"use client";
import Link from "next/link";
import type { ReactNode } from "react";

import { GlossaryTerm, useGlossary } from "@/components/rotation/fe2/Glossary";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { isMock } from "@/lib/api/client";
import { MOCK_CROP_EXPLAINERS } from "@/lib/rotation/draft-fixtures";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-10">
      <h2 id={id} className="font-display text-2xl text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function LearnPage() {
  const glossary = useGlossary();
  const sat = glossary.find((e) => e.id === "satellite_vs_ground");
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-ink">Learn</h1>
        {isMock && <Badge variant="mock" />}
      </div>
      <p className="mt-3 max-w-2xl text-lg text-ink-muted">
        Plain-language explanations of the terms and crop types used in <GlossaryTerm id="relative_score">relative scores</GlossaryTerm>.
      </p>

      <div className="mt-6 rounded-lg border border-line bg-surface-2 p-4 text-sm text-ink-muted">
        <strong className="text-ink">Draft educational fixtures:</strong> The crop explainers and glossary terms below are illustrative samples prepared for interface prototyping. Citations marked as pending review are not authoritative agronomic guidance.
      </div>

      <Section id="satellite" title="Satellite vs ground-based data">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="font-semibold text-ink">Satellite</h3>
            <p className="mt-2 text-sm text-ink">Covers every field, but sees coarse pixels and only the surface.</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-ink">Ground-based</h3>
            <p className="mt-2 text-sm text-ink">Measures one point accurately and deeper, but misses the rest of the field.</p>
          </Card>
        </div>
        {sat && (
          <p className="mt-4 text-ink-muted">
            {sat.long} {sat.how_we_use_it}
          </p>
        )}
      </Section>

      <Section id="crops" title="Crop types">
        <div className="grid gap-4 sm:grid-cols-2">
          {MOCK_CROP_EXPLAINERS.map((c) => (
            <Card key={c.id}>
              <h3 className="font-semibold text-ink">{c.short}</h3>
              <p className="mt-2 text-sm text-ink">{c.why_it_helps}</p>
              <p className="mt-2 text-sm text-ink-muted">Limits: {c.limits}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {c.source === "not yet verified" ? "Draft placeholder · Citation pending expert review" : `Source: ${c.source}`}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="terms" title="Glossary">
        <dl className="grid gap-4">
          {glossary.map((e) => (
            <div key={e.id}>
              <dt className="font-semibold text-ink">{e.term}</dt>
              <dd className="text-ink">{e.short}</dd>
              <dd className="text-sm text-ink-muted">{e.long}</dd>
              <dd className="text-sm text-ink-muted">How we use it: {e.how_we_use_it}</dd>
              <dd className="text-xs text-ink-muted">
                {e.source === "not yet verified" ? "Draft placeholder · Citation pending expert review" : `Source: ${e.source}`}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 rounded-md border border-line bg-surface-2 px-4 py-3 text-ink">{SUPPORT_SENTENCE}</p>
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/methods" className="text-accent underline underline-offset-2">
            Data and methods
          </Link>
        </p>
      </Section>
    </div>
  );
}
