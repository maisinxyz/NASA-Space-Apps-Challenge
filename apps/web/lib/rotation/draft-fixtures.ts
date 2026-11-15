// DRAFT MOCK DATA. Illustrative placeholder values in the draft contract shapes (lib/rotation/draft-types.ts).
// Not observations, not model output: every screen that shows them is in mock mode and carries the "mock" badge.
// SWAP: when Backend A commits the v1.1 fixtures to packages/contracts/fixtures, point lib/rotation/api.ts at
// /mock/<fixture>.json and delete this file. See docs/progress/fe-rot-draft.md.
import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import { twinConfig } from "@/lib/farms";

import type {
  AnalyzedRotation,
  Criterion,
  CropExplainer,
  FeatureTable,
  GlossaryEntry,
  HazardCalendar,
  HazardCatalog,
  RotationScorecard,
  ScenarioInput,
  ZoneCollection,
} from "./draft-types";
import { SCENARIO_LABEL } from "./store";

const WEEKS = 52;
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smooth seasonal curve, peak at week `peak`, deterministic. */
const season = (peak: number, lo: number, hi: number) =>
  Array.from({ length: WEEKS }, (_, w) => lo + ((hi - lo) * (1 + Math.cos((2 * Math.PI * (w - peak)) / WEEKS))) / 2);

const TRAIT = { confidence: "low", needs_local_review: true } as const;
const sc = (criterion: Criterion, score: number, unit: string, basis: RotationScorecard["basis"], extra: Partial<RotationScorecard> = {}): RotationScorecard => ({
  criterion,
  score,
  unit,
  basis,
  confidence: "medium",
  needs_local_review: false,
  inputs: [],
  ...extra,
});
const IDX = "index 0-100, higher is better";

function card(id: `rot_${string}`, why: string, benefits: string[]): AnalyzedRotation["evidence_card"] {
  return {
    rotation_id: id,
    why_suggested: why,
    evidence: ["Mock evidence line: illustrative only, not computed from this site's data."],
    benefits,
    information_gaps: ["No satellite cross-check", "No soil sample", "Placeholder market rating"],
    risks_for_local_review: ["Planting window", "Soil test", "Equipment fit", "Local price", "Pest history"],
    support_not_replace: SUPPORT_SENTENCE as AnalyzedRotation["evidence_card"]["support_not_replace"],
  };
}

/** Three rotations, seven criteria each. Scores are min-max across these three (0 / 50 / 100 pattern, PRD §8.4). */
export const MOCK_ROTATIONS: AnalyzedRotation[] = [
  {
    rotation_id: "rot_existing",
    name: "Corn silage – winter wheat (current)",
    is_existing: true,
    sequence: [
      { year_index: 1, season: "summer", crop_id: "crop_corn_silage" },
      { year_index: 2, season: "fall", crop_id: "crop_wheat_winter" },
    ],
    cover_calendar: { days_bare_per_year: 150, monthly_cover: [0.1, 0.1, 0.1, 0.2, 0.3, 0.6, 0.9, 0.9, 0.7, 0.2, 0.1, 0.1] },
    scorecard: [
      sc("nutrient_cycling", 0, IDX, "derived", TRAIT),
      sc("erosion_risk", 0, "index 0-100, higher is lower risk", "modeled", { range: { p10: 0, p90: 18 }, inputs: [{ name: "days_bare_per_year", value: 150, unit: "days", basis: "derived" }] }),
      sc("organic_matter", 0, IDX, "derived", TRAIT),
      sc("pest_disruption", 0, IDX, "derived", TRAIT),
      sc("water_use", 62, "index 0-100, higher is less seasonal deficit", "modeled", { range: { p10: 44, p90: 78 }, inputs: [{ name: "seasonal_deficit", value: 120, unit: "mm", basis: "modeled" }] }),
      sc("forage_potential", 50, IDX, "derived", TRAIT),
      sc("market_suitability", 100, IDX, "assumed", TRAIT),
    ],
    overall: 0,
    rank: 3,
    rank_stability: "ranked last in 76% of resampled years",
    exposure: { winter: { value: 0.8, p10: 0.6, p90: 0.95, basis: "relative" }, summer: { value: 0.5, p10: 0.3, p90: 0.7, basis: "relative" } },
    evidence_card: card("rot_existing", "Your current rotation, shown as the baseline for comparison.", ["Familiar crops and equipment"]),
  },
  {
    rotation_id: "rot_cover",
    name: "Corn silage – cereal rye cover – field pea",
    is_existing: false,
    sequence: [
      { year_index: 1, season: "summer", crop_id: "crop_corn_silage" },
      { year_index: 1, season: "winter", crop_id: "crop_rye_cover" },
      { year_index: 2, season: "spring", crop_id: "crop_pea_field" },
    ],
    cover_calendar: { days_bare_per_year: 60, monthly_cover: [0.5, 0.5, 0.6, 0.6, 0.5, 0.7, 0.9, 0.9, 0.7, 0.5, 0.5, 0.5] },
    scorecard: [
      sc("nutrient_cycling", 100, IDX, "derived", TRAIT),
      sc("erosion_risk", 100, "index 0-100, higher is lower risk", "modeled", { range: { p10: 82, p90: 100 }, inputs: [{ name: "days_bare_per_year", value: 60, unit: "days", basis: "derived" }] }),
      sc("organic_matter", 70, IDX, "derived", TRAIT),
      sc("pest_disruption", 100, IDX, "derived", TRAIT),
      sc("water_use", 0, "index 0-100, higher is less seasonal deficit", "modeled", { range: { p10: 0, p90: 21 }, inputs: [{ name: "seasonal_deficit", value: 165, unit: "mm", basis: "modeled" }] }),
      sc("forage_potential", 0, IDX, "derived", TRAIT),
      sc("market_suitability", 40, IDX, "assumed", TRAIT),
    ],
    overall: 0,
    rank: 1,
    rank_stability: "ranked first in 82% of resampled years",
    exposure: { winter: { value: 0.3, p10: 0.2, p90: 0.45, basis: "relative" }, summer: { value: 0.45, p10: 0.3, p90: 0.6, basis: "relative" } },
    evidence_card: card("rot_cover", "Mock: ranked on your selected priorities; adds a legume and keeps soil covered over winter.", ["Fewer bare months", "Adds a nitrogen-fixing crop"]),
  },
  {
    rotation_id: "rot_forage",
    name: "Corn silage – oats – alfalfa (2 yr)",
    is_existing: false,
    sequence: [
      { year_index: 1, season: "summer", crop_id: "crop_corn_silage" },
      { year_index: 2, season: "spring", crop_id: "crop_oats" },
      { year_index: 2, season: "summer", crop_id: "crop_alfalfa" },
      { year_index: 3, season: "summer", crop_id: "crop_alfalfa" },
    ],
    cover_calendar: { days_bare_per_year: 90, monthly_cover: [0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.9, 0.8, 0.5, 0.3, 0.3] },
    scorecard: [
      sc("nutrient_cycling", 80, IDX, "derived", TRAIT),
      sc("erosion_risk", 65, "index 0-100, higher is lower risk", "modeled", { range: { p10: 48, p90: 80 }, inputs: [{ name: "days_bare_per_year", value: 90, unit: "days", basis: "derived" }] }),
      sc("organic_matter", 100, IDX, "derived", TRAIT),
      sc("pest_disruption", 60, IDX, "derived", TRAIT),
      sc("water_use", 100, "index 0-100, higher is less seasonal deficit", "modeled", { range: { p10: 85, p90: 100 }, inputs: [{ name: "seasonal_deficit", value: 95, unit: "mm", basis: "modeled" }] }),
      sc("forage_potential", 100, IDX, "derived", TRAIT),
      sc("market_suitability", 0, IDX, "assumed", TRAIT),
    ],
    overall: 0,
    rank: 2,
    rank_stability: "kept its rank in 64% of resampled years",
    exposure: { winter: { value: 0.5, p10: 0.35, p90: 0.65, basis: "relative" }, summer: { value: 0.35, p10: 0.2, p90: 0.5, basis: "relative" } },
    evidence_card: card("rot_forage", "Mock: perennial alfalfa years add forage and root mass.", ["Forage for livestock", "Deep roots"]),
  },
];

export const mockScenarioEcho = (s: ScenarioInput) => ({ ...s, label: SCENARIO_LABEL });

/** Weekly features, nudged by the scenario so the charts visibly respond in mock mode. */
export function mockFeatureTable(siteId: string, s: ScenarioInput): FeatureTable {
  const rainK = 1 + s.rain_scale_pct / 100;
  const rain = season(26, 12, 28).map((v) => r1(v * rainK));
  const tmean = season(29, -4, 22).map((v) => r1(v + s.temp_offset_c));
  const et0 = tmean.map((t) => r1(Math.max(0, t) * 1.4));
  return {
    schema_version: "1.1.0-draft",
    site_id: siteId,
    years: { start: "1991-01-01", end: "2024-12-31" },
    weeks: WEEKS,
    features: {
      rain_mm: { unit: "mm", basis: "derived", median: rain },
      tmean_c: { unit: "°C", basis: "derived", median: tmean },
      et0_mm: { unit: "mm", basis: "modeled", median: et0 },
      water_balance_mm: { unit: "mm", basis: "modeled", median: rain.map((r, i) => r1(r - et0[i])) },
      soil_moisture_anomaly: { unit: "σ", basis: "derived", median: season(10, -0.6, 0.6).map((v) => r2(v + s.rain_scale_pct / 100)) },
      frost_prob: { unit: "0–1", basis: "derived", median: tmean.map((t) => r2(clamp01((2 - t) / 8))) },
      heat_prob: { unit: "0–1", basis: "derived", median: tmean.map((t) => r2(clamp01((t - 18) / 10))) },
      extreme_rain_prob: { unit: "0–1", basis: "derived", median: season(30, 0.02, 0.2).map((v) => r2(clamp01(v * rainK))) },
      dry_spell_prob: { unit: "0–1", basis: "derived", median: season(30, 0.05, 0.3).map((v) => r2(clamp01(v / rainK))) },
    },
    quality: {
      years_available: 34,
      missing_fraction: { rain_mm: 0.01 },
      sources_used: [{ name: "NASA POWER", resolution_note: "regional estimate" }],
      sources_agree: null,
      limited_data: true,
    },
    caveats: ["Mock values for interface development only", "Rain not bias-corrected"],
  };
}

export function mockHazardCalendar(siteId: string, s: ScenarioInput): HazardCalendar {
  const rainK = 1 + s.rain_scale_pct / 100;
  return {
    site_id: siteId,
    scenario: s.preset,
    years: { start: "1991-01-01", end: "2024-12-31" },
    j_wet: season(14, 0.05, 0.45).map((v) => r2(clamp01(v * rainK))),
    j_dry: season(32, 0.05, 0.35).map((v) => r2(clamp01((v / rainK) * (1 + s.temp_offset_c / 10)))),
    thresholds: { q_rain: 0.95, q_wet: 0.75, n_dry_days: 10, q_dry: 0.1 },
    basis: "derived",
    sources: [{ name: "NASA POWER", role: "weather", license: "Public domain (NASA)", basis: "derived" }],
    caveats: ["Mock values for interface development only", "Rain not bias-corrected"],
  };
}

export const mockHazards = (siteId: string): HazardCatalog => ({
  site_id: siteId,
  items: [
    { id: "hz_wet", kind: "heavy_rain_wet_ground", label: "Heavy rain on wet ground", years_with_event: 21, years_total: 34, peak_weeks: [12, 13, 14, 15], worst_storm_id: null, basis: "derived", sources: [] },
    { id: "hz_dry", kind: "dry_spell", label: "Dry spell", years_with_event: 15, years_total: 34, peak_weeks: [30, 31, 32], worst_storm_id: null, basis: "derived", sources: [] },
    { id: "hz_frost", kind: "late_frost", label: "Late frost", years_with_event: 9, years_total: 34, peak_weeks: [17, 18], worst_storm_id: null, basis: "derived", sources: [] },
  ],
});

/** Zones from the twin farm's own field outlines (mock geography). Farms without a twin get no zones. */
export function mockZones(siteId: string): ZoneCollection {
  const fields = twinConfig(siteId)?.fields ?? [];
  return {
    site_id: siteId,
    zones: fields.slice(0, 3).map((f, i) => {
      const ring = f.ring;
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      return {
        id: `zone_mock_${i}`,
        outline: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
        icon_point: [cx, cy],
        area_ha: f.areaHa,
        terrain_factor: [1.4, 1.1, 0.8][i],
        field_id: f.id,
        crop: null,
        winter_exposure: null,
        summer_exposure: null,
        basis: "relative",
        label: ["Erosion-risk zone", "Water-stress hotspot", "Frost pocket"][i],
      };
    }),
  };
}

/** PRD §11 starter entries (plain language, "reviewed before demo"). TODO(verify): every `source` below. */
export const MOCK_GLOSSARY: GlossaryEntry[] = [
  { id: "et", term: "Evapotranspiration (ET)", short: "Water leaving the ground through soil evaporation and plant transpiration; the \"thirst\" of the field.", long: "Water leaving the ground through soil evaporation and plant transpiration.", how_we_use_it: "We estimate a reference value from temperature, so it is modeled, not measured.", source: "not yet verified" },
  { id: "water_balance", term: "Water balance", short: "Rain minus evapotranspiration.", long: "Positive weeks add moisture; negative weeks dry the soil.", how_we_use_it: "Shown per week in the feature charts.", source: "not yet verified" },
  { id: "soil_moisture_anomaly", term: "Soil-moisture anomaly", short: "How much wetter or drier the soil is than normal for that week.", long: "Measured in standard deviations. Zero is normal.", how_we_use_it: "Shown per week in the feature charts.", source: "not yet verified" },
  { id: "ndvi", term: "NDVI", short: "A satellite \"greenness\" score.", long: "Low values in the growing season can signal stress or bare soil.", how_we_use_it: "Used as a cross-check where available.", source: "not yet verified" },
  { id: "frost_risk", term: "Frost risk", short: "The share of past years with freezing temperatures in that week.", long: "It is history, not a forecast.", how_we_use_it: "Shown per week in the feature charts.", source: "not yet verified" },
  { id: "satellite_vs_ground", term: "Satellite vs ground-based measurements", short: "Satellites cover every field but see coarse pixels and only the surface; ground sensors measure one point accurately and deeper, but miss the rest.", long: "Combining them lets satellite data show patterns and ground data check them.", how_we_use_it: "Our baseline weather values are regional satellite-model estimates, not field sensors.", source: "not yet verified" },
  { id: "relative_score", term: "Relative score", short: "A comparison between these three rotations only.", long: "Not a prediction of yield or soil loss.", how_we_use_it: "Every rotation score is relative.", source: "not yet verified" },
];

// TODO(verify): every `source` below.
export const MOCK_CROP_EXPLAINERS: CropExplainer[] = [
  { id: "nitrogen_fixing", short: "Nitrogen-fixing crops (for example beans, peas, clover)", why_it_helps: "Bacteria on roots turn air nitrogen into plant food, which can reduce fertilizer need.", limits: "Benefit depends on inoculation and what follows in the rotation.", source: "not yet verified" },
  { id: "cover_crops", short: "Cover crops", why_it_helps: "Keep soil covered between cash crops, which reduces erosion, adds organic matter and holds moisture.", limits: "Can use water that the next crop needs.", source: "not yet verified" },
  { id: "deep_rooting", short: "Deep-rooting crops", why_it_helps: "Open channels in compacted soil, draw water and nutrients from deeper layers, and improve structure over time.", limits: "Effect builds slowly.", source: "not yet verified" },
  { id: "drought_tolerant", short: "Drought-tolerant crops", why_it_helps: "Need less water and hold up better in dry spells.", limits: "May offer lower returns or fewer markets (local review).", source: "not yet verified" },
];
