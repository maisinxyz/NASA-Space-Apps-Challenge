"use client";
// Right inspector content: the click-to-inspect field card, and the Explore / Evidence mode bodies (Simulate: ScenarioPanel.tsx).
// Compare's body is ComparePanel. Every value carries unit + basis + source (components/ui/Provenance).
import type { CropLook, Farm, FarmField } from "@/components/globe/types";

import { BasisChip, SourceFooter, Value } from "@/components/ui/Provenance";
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { useAppStore } from "@/lib/store";
import { bareMonths, rotationById } from "@/lib/twin/rotations";

import { CoverCalendar, CropSwatch, useTwin } from "./shared";

export const EVIDENCE_NOTE =
  "Decision support, not agronomic advice: talk to a local agronomist or adviser before changing a rotation.";

export function FieldCard({
  field,
  cropA,
  cropB,
}: {
  field: FarmField;
  cropA: CropLook;
  cropB?: CropLook;
}) {
  const compareA = useAppStore((s) => s.compareA);
  const twin = useTwin();
  const rotation = rotationById(twin.rotations, compareA)!;
  const phase = twin.phases[field.id];
  // Rows start at this field's own stage: fields in rotation are staggered by `phase` years.
  const rows =
    phase === undefined
      ? []
      : rotation.years.map((_, k) => ({
          label: `Year ${k + 1}`,
          months: rotation.years[(k + phase) % rotation.years.length],
        }));
  const bare = bareMonths({ years: rows.map((r) => r.months) });

  return (
    <div className="grid gap-3 text-sm">
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-ink-muted">Area</dt>
        <dd>
          <Value
            value={field.areaHa}
            meta={{
              basis: "derived",
              unit: "ha",
              sourceId: twin.outlineSource,
              observedAt: twin.outlineDate,
              spatialResolution: "approximate outline",
              qualityNote:
                "Flat-map estimate of the outline; the managed field may differ.",
            }}
          />
        </dd>
        <dt className="text-ink-muted">
          {cropB ? "Crop shown, A" : "Crop shown"}
        </dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          <CropSwatch crop={cropA} /> <BasisChip basis="assumed" />
        </dd>
        {cropB && (
          <>
            <dt className="text-ink-muted">Crop shown, B</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <CropSwatch crop={cropB} /> <BasisChip basis="assumed" />
            </dd>
          </>
        )}
        {rows.length > 0 && (
          <>
            <dt className="text-ink-muted">Bare soil</dt>
            <dd>
              <Value
                value={`${bare.total} of ${rows.length * 12}`}
                meta={{
                  basis: "derived",
                  unit: "months",
                  sourceId: "rotationCalendar",
                  qualityNote:
                    "Counted from typical season windows, not observed on this field.",
                }}
              />
            </dd>
          </>
        )}
      </dl>
      {rows.length ? (
        <div className="grid gap-1">
          <p className="text-xs text-ink-muted">
            Rotation A on this field:{" "}
            <span className="text-ink">
              {rotation.isExisting ? "Existing rotation" : rotation.name}
            </span>
          </p>
          <CoverCalendar rows={rows} />
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          Perennial: this field keeps the same cover every year and does not
          follow the rotation.
        </p>
      )}
      <SourceFooter
        ids={[
          twin.outlineSource,
          "illustrativeCrops",
          ...(rows.length ? (["rotationCalendar"] as const) : []),
        ]}
      />
    </div>
  );
}

export function ExploreBody({
  farm,
  fieldCount,
}: {
  farm: Farm;
  fieldCount: number;
}) {
  const { simAreaLabel } = useTwin();
  return (
    <div className="grid gap-2 text-sm">
      <p>
        Hover a field to see its name and crop. Click it, or pick one under
        Fields &amp; layers, to inspect it.
      </p>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-muted">Farm</dt>
        <dd>
          {farm.name}, {farm.owner}
        </dd>
        <dt className="text-ink-muted">Fields</dt>
        <dd>{fieldCount} shown</dd>
        <dt className="text-ink-muted">Model area</dt>
        <dd>
          {simAreaLabel}; the thin outline on the map marks where simulation
          layers apply.
        </dd>
      </dl>
      <p className="text-xs text-ink-muted">
        Keys: 1–4 modes · H hide panels · Esc close.
      </p>
    </div>
  );
}

export function EvidenceBody() {
  const { rotations } = useTwin();
  const mode = useAppStore((s) => s.twinMode);
  const selected = useAppStore((s) =>
    mode === "simulate" ? s.scenarioRotation : s.compareA,
  );
  const ordered = [...rotations].sort(
    (a, b) => Number(b.id === selected) - Number(a.id === selected),
  );
  return (
    <div className="grid gap-4">
      <p
        role="note"
        className="rounded border border-[#a3bfe9]/40 bg-[#a3bfe9]/10 p-3 text-sm"
      >
        {EVIDENCE_NOTE}
      </p>
      {ordered.map((r) => (
        <section key={r.id} className="rounded border border-line p-3">
          <h3 className="font-display text-lg">
            {r.id === selected ? "Selected option · " : ""}
            {r.isExisting ? "Existing rotation: " : ""}
            {r.name}
          </h3>
          <p className="mt-2 text-sm">{r.card.why_suggested}</p>
          <p className="mt-2 text-sm">
            <strong>Main tradeoff: </strong>
            {r.card.risks_for_local_review[0] ?? "Local review is required."}
          </p>
          <details className="mt-3 text-sm">
            <summary>Evidence, benefits and information gaps</summary>
            {(
              [
                ["Evidence", r.card.evidence],
                ["Benefits", r.card.benefits],
                ["Information gaps", r.card.information_gaps],
                ["Risks to review locally", r.card.risks_for_local_review],
              ] as const
            ).map(([title, items]) => (
              <div key={title} className="mt-3">
                <h4 className="font-semibold">{title}</h4>
                <ul className="list-disc pl-5">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        </section>
      ))}
      <p className="text-xs text-ink-muted">{SUPPORT_SENTENCE}</p>
    </div>
  );
}
