// SAMPLE data for the farm view. Every card that shows these numbers carries a "Sample data" caption
// (spec: hive/farm-view/SHARED-SPEC.md). Not measurements. Single source for Slices A-D.
import type { LayerId } from "./tokens";

export type FieldStatus = "Stressed" | "Dry" | "Watch" | "OK";
export type SampleField = { id: string; name: string; crop: string; moisture: number; ndvi: number; status: FieldStatus };

export const SAMPLE_FIELDS: readonly SampleField[] = [
  { id: "trial-plots", name: "Trial plots", crop: "Winter wheat (sample)", moisture: 36, ndvi: 0.48, status: "Stressed" },
  { id: "north-strips", name: "North strips", crop: "Mixed cereals (sample)", moisture: 47, ndvi: 0.57, status: "Watch" },
  { id: "variety-strips", name: "Variety strips", crop: "Barley (sample)", moisture: 49, ndvi: 0.63, status: "Watch" },
  { id: "main-block", name: "Main block", crop: "Maize (sample)", moisture: 41, ndvi: 0.52, status: "Dry" },
  { id: "east-field", name: "East field", crop: "Grass-clover (sample)", moisture: 55, ndvi: 0.71, status: "OK" },
];

export const STRESS_LINE = 50;
export const underStress = (f: SampleField) => f.moisture < STRESS_LINE;
/** "4 of 5 fields are under the 50% stress line." */
export const reportSummary = () => `${SAMPLE_FIELDS.filter(underStress).length} of ${SAMPLE_FIELDS.length} fields are under the ${STRESS_LINE}% stress line.`;

export type ConditionId = "rainfall" | "moisture" | "vigor" | "heat";
export const CONDITIONS: readonly { id: ConditionId; label: string; value: string; period: string }[] = [
  { id: "rainfall", label: "Rainfall", value: "64 mm", period: "Past 30 days" },
  { id: "moisture", label: "Soil moisture", value: "41%", period: "Past 30 days" },
  { id: "vigor", label: "Crop vigor", value: "0.48", period: "Past 30 days" },
  { id: "heat", label: "Heat & frost", value: "9 days", period: "Past 30 days" },
];

/** Condition card copy (design-spec §2.4). Charts are not drawn yet; every card carries "Sample data". */
export type ConditionCard = { title: string; big: string; unit: string; description?: string; grid?: readonly { label: string; value: string; note?: string }[] };
export const CONDITION_CARDS: Record<ConditionId, ConditionCard> = {
  rainfall: { title: "Rainfall", big: "64 mm", unit: "in July · sample" },
  moisture: { title: "Soil moisture", big: "41%", unit: "of field capacity, farm average", description: "Under the 50% stress line since early July." },
  vigor: { title: "Crop vigor", big: "0.48", unit: "NDVI · −0.10 vs 5-yr avg", description: "Browning earlier than the 5-year curve." },
  heat: {
    title: "Heat & frost",
    big: "9 days",
    unit: "above 30 °C",
    grid: [
      { label: "Days above 30 °C", value: "9", note: "normal 4" },
      { label: "Growing degree days", value: "1,412", note: "+6%" },
      { label: "First frost median", value: "Oct 14", note: "92 days away" },
      { label: "Coldest July night", value: "11 °C" },
    ],
  },
};

/** Legend copy per map layer (design-spec §2.6). */
export const LAYER_LEGENDS: Partial<Record<LayerId, { title: string; from: string; to: string; lo: string; hi: string; note: string }>> = {
  vigor: { title: "Crop vigor, NDVI", from: "#F2E8A6", to: "#2C6A38", lo: "0.4 thin", hi: "0.8 lush", note: "Satellite, 14 Jul · sample data" },
  moisture: { title: "Soil moisture, % of capacity", from: "#E1ECF7", to: "#1C5AA3", lo: "30%", hi: "60%", note: "Dashed outline: under the 50% stress line" },
};

export const LAYERS: readonly { id: LayerId; label: string }[] = [
  { id: "satellite", label: "Satellite" },
  { id: "vigor", label: "Crop vigor" },
  { id: "moisture", label: "Soil moisture" },
];

export const EXPLORE_SUBTITLE = "Explore only: simulation not available for this farm yet.";
export const INITIAL_DAY = 194; // 14 July (0-based day of year)
