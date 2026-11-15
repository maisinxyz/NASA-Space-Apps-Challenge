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
export const CONDITIONS: readonly { id: ConditionId; label: string; value: string }[] = [
  { id: "rainfall", label: "Rainfall", value: "64 mm" },
  { id: "moisture", label: "Soil moisture", value: "41%" },
  { id: "vigor", label: "Crop vigor", value: "0.48" },
  { id: "heat", label: "Heat & frost", value: "9 days" },
];

export const LAYERS: readonly { id: LayerId; label: string }[] = [
  { id: "satellite", label: "Satellite" },
  { id: "vigor", label: "Crop vigor" },
  { id: "moisture", label: "Soil moisture" },
];

export const EXPLORE_SUBTITLE = "Explore only: simulation not available for this farm yet.";
export const INITIAL_DAY = 194; // 14 July (0-based day of year)
