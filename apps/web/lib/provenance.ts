// Provenance for every number the twin shows (plan Phase 2): what it is based on, its unit, where it comes from,
// and one limitation. Rendering lives in components/ui/Provenance.tsx; this file is pure so it can be tested.
import type { BasisOrRelative } from "@/lib/api/types";

/** Contract basis enum plus "synthetic" (made-up demo data, UI only; never sent to or from the API). */
export type UiBasis = BasisOrRelative | "synthetic";

export type ValueMeta = {
  basis: UiBasis;
  unit: string;
  sourceId: SourceId;
  /** When the underlying data was observed or captured (ISO date), if known. */
  observedAt?: string;
  /** When we last fetched or edited it (ISO date), if known. */
  updatedAt?: string;
  /** Plain-language resolution, e.g. "about 55 km grid", "volunteer-mapped outline". */
  spatialResolution?: string;
  /** One limitation, in farmer language. */
  qualityNote?: string;
};

export type Source = { name: string; attribution?: string; licence?: string };

/** Sources the twin UI cites. Methods & data lists the full dataset rows. */
export const SOURCES = {
  osm: { name: "OpenStreetMap field outlines", attribution: "© OpenStreetMap contributors", licence: "ODbL 1.0" },
  tracedOutlines: { name: "FieldTwin field outlines traced on public imagery (approximate)" },
  illustrativeCrops: { name: "FieldTwin illustrative crops (not farm records)" },
  rotationCalendar: { name: "FieldTwin rotation calendar (typical season windows, not observed)" },
  teamScores: { name: "FieldTwin team scores (assumption, these three rotations only)" },
} satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

/** "35.5 ha" with a fixed locale so server and client render the same text. */
export function formatValue(value: number | string, unit: string, digits = 1): string {
  const text = typeof value === "number" ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : value;
  return unit ? `${text} ${unit}` : text;
}

/** One line naming the source with its attribution and licence, e.g. "OpenStreetMap field outlines · © … · ODbL 1.0". */
export function sourceLine(id: SourceId): string {
  const s: Source = SOURCES[id];
  return [s.name, s.attribution, s.licence].filter(Boolean).join(" · ");
}

/** The detail lines of a value's popover, in reading order. */
export function metaLines(m: ValueMeta): string[] {
  return [
    `Source: ${sourceLine(m.sourceId)}`,
    m.observedAt && `Observed: ${m.observedAt}`,
    m.updatedAt && `Updated: ${m.updatedAt}`,
    m.spatialResolution && `Resolution: ${m.spatialResolution}`,
    m.qualityNote && `Limitation: ${m.qualityNote}`,
  ].filter((x): x is string => !!x);
}
