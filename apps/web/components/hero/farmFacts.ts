// What the farm card can honestly say about a farm today. Only real data: nothing is invented. Fields without data
// are null and the card says so (CLAUDE.md honesty rules).
import type { Farm } from "@/components/globe/types";

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
  return {
    crop: null, // field crops are not public records: the card shows "no data"
    areaHa: farm.areaHa ?? null,
    ndvi: null,
    trend: null,
  };
}
