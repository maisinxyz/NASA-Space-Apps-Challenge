// DRAFT CONTRACT TYPES. Placeholder until contract v1.1 lands (openapi 1.1.0 + `make types`).
// Every shape is copied from docs/prd-backend-rotation.md (§7.4, §7.7, §8.5, §8.7, §9, §11, §12, §14) and
// implementation-plan/contract-request-v1.1.md (§4). Nothing here is invented beyond those two drafts.
// SWAP: when schema.d.ts has these schemas, replace each type below with the generated alias from lib/api/types.ts
// and fix any compile errors in lib/rotation/* and components/rotation/*. See docs/progress/fe-rot-draft.md.
import type { BasisOrRelative, EvidenceCard } from "@/lib/api/types";

// ------------------------------------------------------------- enums (PRD §14, v1.1 §4)
export const CRITERIA = [
  "nutrient_cycling",
  "erosion_risk",
  "organic_matter",
  "pest_disruption",
  "water_use",
  "forage_potential",
  "market_suitability",
] as const;
// shortcut: criterion ids follow PRD §8.4/§8.5 naming; only erosion_risk and water_use appear verbatim in the PRD. Confirm with Backend B when the Criterion enum lands.
export type Criterion = (typeof CRITERIA)[number];

export const WEIGHT_PRESETS = ["water", "income", "soil_structure", "erosion", "forage"] as const;
export type WeightPreset = (typeof WEIGHT_PRESETS)[number];

export const SCENARIO_PRESETS = ["baseline", "wetter_winters", "drier_summers", "both"] as const;
export type ScenarioPreset = (typeof SCENARIO_PRESETS)[number];

export type Confidence = "high" | "medium" | "low";
export type DataMode = "live" | "cached" | "seed" | "mock";

// ------------------------------------------------------------- request (PRD §9, §12.1)
export interface ScenarioInput {
  preset: ScenarioPreset;
  rain_scale_pct: number;
  temp_offset_c: number;
}

export interface FarmerConstraints {
  low_water: boolean;
  no_specialty_equipment: boolean;
  no_local_market: boolean;
}

export interface RotationAnalysisRequest {
  criteria_selected: Criterion[];
  weights: Partial<Record<Criterion, number>>;
  weight_preset?: WeightPreset;
  constraints: FarmerConstraints;
  allowed_crops: string[];
  scenario: ScenarioInput;
}

// ------------------------------------------------------------- analysis result (PRD §8.5, §8.7, §10)
export type Season = "spring" | "summer" | "fall" | "winter";

export interface RotationSlot {
  year_index: number;
  season: Season;
  crop_id: string;
}

export interface ScoreInput {
  name: string;
  value: number;
  unit: string;
  basis: BasisOrRelative;
}

export interface RotationScorecard {
  criterion: Criterion;
  /** 0–100, relative across the three rotations only; higher is always better. */
  score: number;
  unit: string;
  basis: BasisOrRelative;
  /** Present only for water_use, erosion_risk (PRD §10). Never invented for trait-driven criteria. */
  range?: { p10: number; p90: number };
  confidence: Confidence;
  needs_local_review: boolean;
  inputs: ScoreInput[];
}

export interface ExposureValue {
  value: number;
  p10: number;
  p90: number;
  basis: BasisOrRelative;
}

export interface AnalyzedRotation {
  rotation_id: `rot_${string}`;
  name: string; // shortcut: name is not in the PRD §8.5 example; UI needs a label. Ask Backend B to add it, else derive from sequence.
  is_existing: boolean;
  sequence: RotationSlot[];
  cover_calendar: { days_bare_per_year: number; monthly_cover: number[] };
  scorecard: RotationScorecard[];
  overall: number;
  rank: number;
  rank_stability: string | null;
  exposure: { winter: ExposureValue; summer: ExposureValue };
  evidence_card: EvidenceCard;
}

export interface AnalysisWarning {
  code: "NO_FEASIBLE_ALTERNATIVES" | string;
  message: string;
}

export interface RotationAnalysis {
  site_id: string;
  engine_version: string;
  data_mode: DataMode;
  scenario: ScenarioInput & { label: string };
  limited_data: boolean;
  rotations: AnalyzedRotation[];
  weights_applied: Partial<Record<Criterion, number>>;
  warnings: AnalysisWarning[];
  request_echo: RotationAnalysisRequest;
  disclaimer: string;
}

// ------------------------------------------------------------- feature table (PRD §7.3, §7.7)
export const FEATURE_IDS = [
  "rain_mm",
  "tmean_c",
  "soil_moisture_anomaly",
  "et0_mm",
  "water_balance_mm",
  "frost_prob",
  "heat_prob",
  "extreme_rain_prob",
  "dry_spell_prob",
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export interface FeatureSeries {
  unit: string;
  basis: BasisOrRelative;
  median: number[]; // 52 weeks
  p10?: number[];
  p90?: number[];
}

export interface FeatureTable {
  schema_version: string;
  site_id: string;
  years: { start: string; end: string };
  weeks: number;
  features: Partial<Record<FeatureId, FeatureSeries>>;
  quality: {
    years_available: number;
    missing_fraction: Record<string, number>;
    sources_used: { name: string; resolution_note: string }[];
    sources_agree: boolean | null;
    limited_data: boolean;
  };
  caveats: string[];
}

// ------------------------------------------------------------- hazards (v1.1 §4)
export interface DraftSource {
  name: string;
  role: string;
  license: string;
  basis: BasisOrRelative;
  url?: string;
  resolution_m?: number;
}

export interface HazardCalendar {
  site_id: string;
  scenario: ScenarioPreset;
  years: { start: string; end: string };
  j_wet: number[]; // 52, 0–1
  j_dry: number[]; // 52, 0–1
  thresholds: { q_rain: number; q_wet: number; n_dry_days: number; q_dry: number };
  basis: BasisOrRelative;
  sources: DraftSource[];
  caveats: string[];
}

export type HazardKind = "heavy_rain_wet_ground" | "multi_day_heavy_rain" | "dry_spell" | "heat_spell" | "late_frost";

export interface HazardType {
  id: string;
  kind: HazardKind;
  label: string;
  years_with_event: number;
  years_total: number;
  peak_weeks: number[];
  worst_storm_id: string | null;
  basis: BasisOrRelative;
  sources: DraftSource[];
}

export interface HazardCatalog {
  site_id: string;
  items: HazardType[];
}

// ------------------------------------------------------------- zones (v1.1 §4, PRD §12.2)
export interface Zone {
  id: string;
  outline: { type: "Polygon"; coordinates: [number, number][][] };
  icon_point: [number, number];
  area_ha: number;
  terrain_factor: number;
  field_id: string | null;
  crop: string | null;
  winter_exposure: number | null;
  summer_exposure: number | null;
  basis: BasisOrRelative;
  label?: string; // PRD §12.2 "plain-language label"; field name not fixed yet.
}

export interface ZoneCollection {
  site_id: string;
  zones: Zone[];
}

// ------------------------------------------------------------- glossary (PRD §11)
export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  long: string;
  how_we_use_it: string;
  source: string;
}

export interface CropExplainer {
  id: string;
  short: string;
  why_it_helps: string;
  limits: string;
  source: string;
}
