// What the farm card can honestly say about a farm today. Only real data: nothing is invented. Fields without data
// are null and the card says so (CLAUDE.md honesty rules).
import type { Farm } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";

export type FarmFacts = {
  /** Crops, with how we know them. */
  crop: { text: string; basis: "illustrative" } | null;
  /** Area in hectares from the farm's cited source. */
  areaHa: number | null;
  /** Mean NDVI from HLS over the farm's fields. Null until Section 2's HLS calendars exist (Databases.md DB-6). */
  ndvi: number | null;
  /** Greenness trend over recent seasons, from the same HLS series. Null until then. */
  trend: "rising" | "steady" | "falling" | null;
};

export function farmFacts(farm: Farm): FarmFacts {
  // Twins: the field layout and crops are illustrative ("not farm records"); say so on the card. Regional crop names.
  const twin = twinConfig(farm.id);
  const crops = twin ? [...new Set(twin.fields.map((f) => twin.cropLabels[f.crop] ?? f.crop))] : [];
  return {
    crop: crops.length ? { text: crops.join(", "), basis: "illustrative" } : null,
    areaHa: farm.areaHa ?? null,
    ndvi: null,
    trend: null,
  };
}
