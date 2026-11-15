// SYNTHETIC DEMO DATA for the farm view's Future / Compare modes (CLAUDE.md honesty rule: every view these
// numbers reach shows "Synthetic demo data"). Nothing here is a measurement or a model run: the shapes are
// hand-set so the UI can be built and judged before real projections exist. Replace each block with the real
// source named in its comment; the UI reads only through lib/farm-future/model.ts.
// Same inputs → same outputs: no randomness, no clock reads.

export const FIRST_YEAR = 2026;
export const YEAR_COUNT = 10; // 2026–2035
export const YEARS = Array.from({ length: YEAR_COUNT }, (_, i) => FIRST_YEAR + i);

/** One value per year, 2026 first. Real source later: downscaled climate projections (TODO(verify) dataset). */
export const BASELINE = {
  /** Days above 30 °C per year. */
  heatDays: [9, 10, 12, 13, 15, 16, 18, 20, 23, 24],
  /** Annual rainfall, mm. */
  rainMm: [892, 884, 871, 869, 853, 848, 836, 829, 812, 806],
  /** Frost-free days per year. */
  frostFreeDays: [195, 197, 199, 202, 204, 206, 208, 211, 214, 216],
  /** Root-zone soil moisture in July, % of field capacity. */
  julyMoisturePct: [41, 41, 40, 40, 39, 39, 39, 38, 38, 37],
  /** Mean temperature anomaly vs 2026, °C (drives the timeline ribbon). */
  tempAnomalyC: [0, 0.2, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.6, 1.8],
  /** Day of year of the last spring frost / first autumn frost (frost-free window on the timeline). */
  lastSpringFrostDoy: [108, 107, 105, 104, 102, 100, 99, 97, 95, 94],
  firstFallFrostDoy: [303, 304, 304, 306, 306, 306, 307, 308, 309, 310],
} as const;

/** Heavy-rain events drawn under the timeline. yearIndex + dayOfYear; mm in the event. */
export const HEAVY_RAIN = [
  { yearIndex: 1, doy: 200, mm: 38 },
  { yearIndex: 3, doy: 75, mm: 44 },
  { yearIndex: 5, doy: 255, mm: 52 },
  { yearIndex: 7, doy: 165, mm: 41 },
  { yearIndex: 7, doy: 226, mm: 64 }, // the "storm replay" event, Aug 2033
  { yearIndex: 8, doy: 219, mm: 58 },
] as const;

/** Season water balance, mm, for the growing season. 2026 values; trends applied in model.ts. */
export const WATER_BALANCE_2026 = { rain: 668, irrigation: 60, cropUse: 702, runoff: 38 } as const;
/** Groundwater storage anomaly, cm water equivalent, one per year. Synthetic stand-in for GRACE. */
export const GROUNDWATER_CM = [10.0, 10.5, 10.2, 9.4, 9.1, 8.6, 8.0, 7.6, 7.1, 6.8] as const;

/** Per-field future signals. ids match lib/farm-view/sample.ts SAMPLE_FIELDS. */
export const FIELD_FUTURE = [
  { id: "trial-plots", moistureAnomalyPts: -9, dryRank: 1, erosion: "high" as const, bareFrom: null, bareTo: null },
  { id: "north-strips", moistureAnomalyPts: -4, dryRank: 3, erosion: "medium" as const, bareFrom: null, bareTo: null },
  { id: "variety-strips", moistureAnomalyPts: -3, dryRank: null, erosion: "low" as const, bareFrom: null, bareTo: null },
  { id: "main-block", moistureAnomalyPts: -6, dryRank: 2, erosion: "medium" as const, bareFrom: 204, bareTo: 281 },
  { id: "east-field", moistureAnomalyPts: 3, dryRank: null, erosion: "low" as const, bareFrom: null, bareTo: null },
];

export const STORM = { label: "Aug 2033", yearIndex: 7, doy: 226, mm: 64, hours: 6, field: "Trial plots", soilLossTHa: { p10: 1.9, p50: 3.1, p90: 4.6 } } as const;

/** Crop calendar for the 1-year view. Months as fractional month index (0 = 1 Jan, 12 = 31 Dec). */
export const CROP_STAGES = [
  { crop: "Winter wheat", grow: [[0, 6.7], [9.3, 12]] as [number, number][], stress: [[5.6, 6.7]] as [number, number][] },
  { crop: "Barley", grow: [[2.5, 6.4]] as [number, number][], stress: [[5.2, 6.4]] as [number, number][] },
  { crop: "Maize", grow: [[4.3, 9.6]] as [number, number][], stress: [[6.0, 7.6]] as [number, number][] },
  { crop: "Clover-grass", grow: [[0, 12]] as [number, number][], stress: [[6.4, 7.4]] as [number, number][] },
];

export type StrategyId = "current" | "a" | "b";
export type Strategy = {
  id: StrategyId;
  name: string;
  rotation: string;
  /** Dot colour in compare / sensitivity rows (identity only; text never uses it). */
  swatch: string;
  /** Composite score in 2035, 0–100. Relative: only meaningful between strategies. */
  score2035: number;
  /** How strongly the score reacts to the what-if sliders (1 = baseline). */
  sensitivity: number;
  /** Water demand as % of the farm's quota in 2035. */
  waterQuotaPct2035: number;
  /** Operational fit 0–1: machinery, buyers, labour, timing. */
  fit: [number, number, number, number];
  /** Topsoil organic matter, %: start and change per year. */
  omStart: number;
  omPerYear: number;
  nitrogen: { inKg: number; fixedKg: number; outKg: number; fertSaved: { p10: number; p50: number; p90: number } };
  infiltrationPct: { start: number; perYear: number };
  /** Pest pressure 0–100 per year; drops where the rotation breaks the host chain. */
  pestPressure: number[];
};

export const STRATEGIES: readonly Strategy[] = [
  {
    id: "current", name: "Current rotation", rotation: "Wheat · barley", swatch: "#C9BFAE",
    score2035: 61, sensitivity: 1.5, waterQuotaPct2035: 118, fit: [0.9, 0.8, 0.7, 0.85],
    omStart: 2.1, omPerYear: -0.01, nitrogen: { inKg: 168, fixedKg: 0, outKg: 174, fertSaved: { p10: 0, p50: 0, p90: 0 } },
    infiltrationPct: { start: 59, perYear: -0.3 }, pestPressure: [30, 42, 55, 63, 68, 72, 75, 78, 80, 82],
  },
  {
    id: "a", name: "Strategy A", rotation: "Wheat · clover · maize", swatch: "#E2B866",
    score2035: 78, sensitivity: 0.67, waterQuotaPct2035: 92, fit: [0.6, 0.75, 0.6, 0.7],
    omStart: 2.1, omPerYear: 0.056, nitrogen: { inKg: 142, fixedKg: 46, outKg: 171, fertSaved: { p10: 22, p50: 38, p90: 51 } },
    infiltrationPct: { start: 59, perYear: 1.0 }, pestPressure: [20, 45, 70, 15, 35, 60, 12, 30, 52, 10],
  },
  {
    id: "b", name: "Strategy B", rotation: "Cover crop + no-till", swatch: "#9CC28A",
    score2035: 72, sensitivity: 1.0, waterQuotaPct2035: 104, fit: [0.5, 0.6, 0.85, 0.75],
    omStart: 2.1, omPerYear: 0.04, nitrogen: { inKg: 150, fixedKg: 18, outKg: 166, fertSaved: { p10: 8, p50: 16, p90: 25 } },
    infiltrationPct: { start: 59, perYear: 1.3 }, pestPressure: [25, 40, 52, 58, 40, 48, 55, 38, 46, 50],
  },
];

export const REVIEW_FLAGS: Record<StrategyId, { title: string; detail: string; goTo: { label: string; yearIndex: number; doy: number; fieldId?: string } }[]> = {
  current: [
    { title: "Water over quota from 2031", detail: "Demand reaches 118% of the allocation in dry years.", goTo: { label: "Jul–Aug 2031", yearIndex: 5, doy: 196 } },
    { title: "Pest build-up", detail: "Two cereal years in a row, no break crop.", goTo: { label: "Main block", yearIndex: 8, doy: 150, fieldId: "main-block" } },
    { title: "Bare soil after harvest", detail: "Erosion risk on the trial plots.", goTo: { label: "Aug–Oct", yearIndex: 7, doy: 226, fieldId: "trial-plots" } },
  ],
  a: [{ title: "Machinery gap", detail: "Maize needs a planter the farm does not list.", goTo: { label: "Apr 2028", yearIndex: 2, doy: 110 } }],
  b: [{ title: "Water near quota", detail: "Demand reaches 104% in the driest projected years.", goTo: { label: "Jul 2034", yearIndex: 8, doy: 195 } }],
};

/** Where a soil probe would narrow the forecast most (highest spread between p10 and p90). */
export const GROUND_TRUTH = [
  { id: "gt-1", fieldId: "trial-plots", why: "One 9 km pixel covers three fields here, so moisture is least certain. A probe here narrows the forecast most." },
  { id: "gt-2", fieldId: "main-block", why: "The model and the satellite disagree most here in dry Julys." },
] as const;

export const WHAT_IF_LIMITS = { rainPct: { min: -15, max: 15, step: 1 }, tempC: { min: 0, max: 3, step: 0.1 } } as const;
