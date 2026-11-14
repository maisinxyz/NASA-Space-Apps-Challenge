import type { Criterion, WeightPreset } from "@/lib/rotation/draft-types";

export const CRITERION_LABELS: Record<Criterion, string> = {
  nutrient_cycling: "Nutrient cycling",
  erosion_risk: "Erosion risk",
  organic_matter: "Soil organic matter",
  pest_disruption: "Pest and disease break",
  water_use: "Water use",
  forage_potential: "Forage potential",
  market_suitability: "Market fit",
};

export const PRESET_LABELS: Record<WeightPreset, string> = {
  water: "Save water",
  income: "Income",
  soil_structure: "Soil structure",
  erosion: "Protect from erosion",
  forage: "Forage",
};

// TODO(verify): preset weights are a frontend placeholder until the backend defines them (PRD §9)
export const PRESET_WEIGHTS: Record<WeightPreset, Record<Criterion, number>> = {
  water: { nutrient_cycling: 1, erosion_risk: 2, organic_matter: 2, pest_disruption: 1, water_use: 5, forage_potential: 1, market_suitability: 1 },
  income: { nutrient_cycling: 1, erosion_risk: 1, organic_matter: 1, pest_disruption: 2, water_use: 2, forage_potential: 2, market_suitability: 5 },
  soil_structure: { nutrient_cycling: 3, erosion_risk: 3, organic_matter: 5, pest_disruption: 2, water_use: 1, forage_potential: 1, market_suitability: 1 },
  erosion: { nutrient_cycling: 1, erosion_risk: 5, organic_matter: 3, pest_disruption: 1, water_use: 2, forage_potential: 1, market_suitability: 1 },
  forage: { nutrient_cycling: 2, erosion_risk: 1, organic_matter: 2, pest_disruption: 1, water_use: 2, forage_potential: 5, market_suitability: 2 },
};
