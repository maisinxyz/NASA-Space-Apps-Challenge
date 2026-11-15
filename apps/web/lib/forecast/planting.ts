import type { Forecast, ForecastRequest, ForecastStrategy } from "@/lib/api/types";

type Input = NonNullable<ForecastRequest["fields"]>[number];
type Slot = ForecastStrategy["plan"][number];
export type PlantingWeather = "baseline" | "drier_summers";
export const PLANTING_STRATEGY_ID = "rot_first_year_planting";

export function firstYearSlots(plan: Slot[]): Slot[] {
  const first = plan.filter((slot) => slot.year_index === 1);
  return first.filter((slot) => first.filter((entry) => entry.season === slot.season).length === 1);
}

export function plantingRequest(
  base: ForecastRequest, field: Input, slot: Slot, cropId: string, weather: PlantingWeather,
): ForecastRequest {
  const planted = {
    ...field,
    first_year_planting: { season: slot.season, crop_id: cropId },
  };
  return {
    ...base,
    fields: [planted],
    scenario: weather,
    climate_source: "cmip6_delta",
  };
}

export function plantingPair(forecast: Forecast, fieldId: string, slot: Slot, cropId: string) {
  const strategies = forecast.fields.find((field) => field.field_id === fieldId)?.strategies;
  const baseline = strategies?.find((strategy) => strategy.role === "existing");
  const changed = strategies?.find((strategy) => strategy.id === PLANTING_STRATEGY_ID);
  const match = (strategy: ForecastStrategy, crop: string) => strategy.plan.some(
    (entry) => entry.year_index === 1 && entry.season === slot.season && entry.crop_id === crop,
  );
  if (!baseline || !changed || !match(baseline, slot.crop_id) || !match(changed, cropId)) {
    throw new Error("The API did not return this planting comparison. Reload the farm and try again.");
  }
  return { baseline, changed };
}
