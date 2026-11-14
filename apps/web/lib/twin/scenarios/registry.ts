// The 12 climate scenarios (Simulate mode): copy, inputs, data needs, basis and legend. Owner: product.
// Sky/air looks are written in ./atmosphere (weather person), ground layers in ./ground (ground person).
// Copy rules (CLAUDE.md): farmer language, relative comparisons only, no yield/profit/absolute soil-loss claims.
// No dataset ids or URLs here: data needs are named plainly; anything unconfirmed is marked TODO(verify).
// secondsAtOneX = wall-clock seconds for the WHOLE scenario (progress 0 to 1) at 1x speed; 0 = no clock (static).
import type { ScenarioDef, ScenarioFrame, ScenarioId, ScenarioRun } from "../scenario";
import { ATMOSPHERE } from "./atmosphere";
import { GROUND } from "./ground";

const SKY = "Illustrative weather effect: the clouds, rain and light are mood only, not a measurement.";
const WAIT = "Ground layers wait for backend data for this farm.";
const GROUND_ONLY = `No weather effect for this scenario. ${WAIT}`;

const RAIN_DATA = "Daily rainfall record for the farm (NASA POWER or GPM)";
const ELEV_DATA = "Elevation map (1 m lidar where available)";
const SOIL_DATA = "Soil moisture (SMAP)";
const VEG_DATA = "Vegetation index (Landsat/Sentinel HLS)";
const TMIN_DATA = "Minimum temperature (NASA POWER)";
const TMAX_DATA = "Maximum temperature (NASA POWER)";
const CROP_DATA = "Crop calendar for the chosen rotation (typical planting and harvest months)";

export const FAMILY_LABEL = { "rain-water": "Rain & water", "dry-hot": "Dry & hot", cold: "Cold", "seasons-years": "Seasons & years", "what-if": "What-if" } as const;
export const FAMILY_ORDER = ["rain-water", "dry-hot", "cold", "seasons-years", "what-if"] as const;

export const SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: "storm",
    family: "rain-water",
    label: "Storm",
    summary: "Replay a heavy rain event hour by hour and see where water gathers.",
    plainMeaning: "Shows how a hard rain could soak into the farm and where water would run or pool, hour by hour.",
    timeKind: "event-hours",
    outputKind: "frames",
    durationLabel: "Up to 72 hours, hourly",
    secondsAtOneX: 36,
    inputs: [
      { id: "peak_rain_mm_h", label: "Peak rain rate", unit: "mm/h", min: 5, max: 100, step: 5, default: 40, hint: "How hard it rains at the heaviest hour." },
      { id: "duration_h", label: "Storm length", unit: "h", min: 6, max: 72, step: 6, default: 24, hint: "How long the storm lasts." },
      { id: "antecedent_wetness", label: "Starting soil wetness", unit: "%", min: 0, max: 100, step: 10, default: 50, hint: "How wet the ground was before the rain." },
    ],
    dataNeeds: [RAIN_DATA, ELEV_DATA, SOIL_DATA],
    basis: "assumed",
    legend: [
      { color: "#cfe8f7", label: "Light rain" },
      { color: "#4aa3df", label: "Moderate" },
      { color: "#1f4e8c", label: "Heavy" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: true,
  },
  {
    id: "wet-spell",
    family: "rain-water",
    label: "Wet spell",
    summary: "Several rainy weeks in a row: how wet does the ground stay?",
    plainMeaning: "Shows what happens when it rains on and off for weeks and the soil never gets a chance to dry out.",
    timeKind: "season-months",
    outputKind: "frames",
    durationLabel: "4 weeks, daily",
    secondsAtOneX: 40,
    inputs: [
      { id: "rain_days_per_week", label: "Rainy days per week", unit: "days", min: 1, max: 7, step: 1, default: 4, hint: "How many days each week bring rain." },
      { id: "wetness", label: "Soil wetness", unit: "%", min: 20, max: 100, step: 10, default: 70, hint: "How wet the soil stays between rains." },
    ],
    dataNeeds: [RAIN_DATA, SOIL_DATA, ELEV_DATA],
    basis: "assumed",
    legend: [
      { color: "#d9d2c3", label: "Dry" },
      { color: "#8a7b5f", label: "Damp" },
      { color: "#3b2f22", label: "Saturated" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: true,
  },
  {
    id: "flood-zones",
    family: "rain-water",
    label: "Flood zones",
    summary: "See which low spots fill first when water rises.",
    plainMeaning: "Marks the low parts of the land where water would collect if it rose to the level you choose.",
    timeKind: "static",
    outputKind: "zones",
    durationLabel: "Static map, no clock",
    secondsAtOneX: 0,
    inputs: [{ id: "water_level_m", label: "Water level above the low points", unit: "m", min: 0, max: 2, step: 0.1, default: 0.5, hint: "How high the water stands above the lowest ground." }],
    dataNeeds: [ELEV_DATA, "Field and road outlines for the farm"],
    basis: "derived",
    legend: [
      { color: "#bfe3f5", label: "Shallow" },
      { color: "#2f8fd1", label: "Deeper" },
      { color: "#173f73", label: "Deepest" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: false,
  },
  {
    id: "drought",
    family: "dry-hot",
    label: "Drought",
    summary: "A long dry spell: how fast does the soil dry out?",
    plainMeaning: "Shows soil drying week by week when no useful rain falls, and which ground dries first.",
    timeKind: "season-months",
    outputKind: "frames",
    durationLabel: "Dry spell length you choose, daily",
    secondsAtOneX: 45,
    inputs: [
      { id: "dry_spell_days", label: "Dry spell length", unit: "days", min: 14, max: 91, step: 7, default: 42, hint: "Days in a row without useful rain." },
      { id: "soil_water_holding", label: "Soil water holding", unit: "mm", min: 50, max: 250, step: 10, default: 120, hint: "How much water the soil can store. Deeper, richer soil holds more." },
    ],
    dataNeeds: [RAIN_DATA, SOIL_DATA, "Soil type and depth for the farm (soil survey)"],
    basis: "assumed",
    legend: [
      { color: "#5f8f3a", label: "Moist" },
      { color: "#c9b27a", label: "Drying" },
      { color: "#a8793f", label: "Very dry" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: true,
  },
  {
    id: "heat-wave",
    family: "dry-hot",
    label: "Heat wave",
    summary: "Days much hotter than normal: where does heat build up?",
    plainMeaning: "Shows a run of very hot days and which fields would feel the most heat stress.",
    timeKind: "season-months",
    outputKind: "frames",
    durationLabel: "3 to 21 days, daily",
    secondsAtOneX: 30,
    inputs: [
      { id: "temp_anomaly_c", label: "Hotter than normal by", unit: "+°C", min: 2, max: 12, step: 1, default: 6, hint: "How far the daily highs rise above what is usual." },
      { id: "duration_days", label: "Duration", unit: "days", min: 3, max: 21, step: 1, default: 7, hint: "How many hot days in a row." },
    ],
    dataNeeds: [TMAX_DATA, VEG_DATA],
    basis: "assumed",
    legend: [
      { color: "#f6e7b4", label: "Warm" },
      { color: "#ef8a3c", label: "Hot" },
      { color: "#b3262d", label: "Very hot" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: true,
  },
  {
    id: "frost",
    family: "cold",
    label: "Frost",
    summary: "A freezing night: which low spots get cold first?",
    plainMeaning: "Shows where cold air settles on a freezing night, so you can see which parts of the land frost first.",
    timeKind: "event-hours",
    outputKind: "zones",
    durationLabel: "48 hours, hourly",
    secondsAtOneX: 30,
    inputs: [
      { id: "min_temp_c", label: "Lowest temperature", unit: "°C", min: -10, max: 0, step: 1, default: -4, hint: "How cold it gets overnight." },
      { id: "hours_below_0", label: "Hours below freezing", unit: "h", min: 1, max: 24, step: 1, default: 6, hint: "How long it stays below 0 °C." },
    ],
    dataNeeds: [TMIN_DATA, ELEV_DATA],
    basis: "assumed",
    legend: [
      { color: "#e8f3fb", label: "Light frost" },
      { color: "#8fc4e8", label: "Frost" },
      { color: "#2b6fb3", label: "Hard frost" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: false,
  },
  {
    id: "bare-soil",
    family: "seasons-years",
    label: "Bare soil",
    summary: "Which months leave the soil uncovered under each rotation?",
    plainMeaning: "Shows the months when fields have no crop or cover on them, the times soil is most exposed to rain and wind.",
    timeKind: "season-months",
    outputKind: "timeline",
    durationLabel: "12 months",
    secondsAtOneX: 36,
    inputs: [],
    dataNeeds: [CROP_DATA, VEG_DATA],
    basis: "relative",
    legend: [
      { color: "#3b2616", label: "Bare soil" },
      { color: "#7fae4a", label: "Cover crop" },
      { color: "#4f9a3c", label: "Crop growing" },
    ],
    effectCaption: GROUND_ONLY,
    rotationDependent: true,
  },
  {
    id: "veg-stress",
    family: "seasons-years",
    label: "Vegetation stress",
    summary: "How green is the crop compared with a normal year?",
    plainMeaning: "Shows where plants look greener or more worn than usual over a season. A guide to where to walk the field, not a verdict.",
    timeKind: "season-months",
    outputKind: "series",
    durationLabel: "1 growing season, monthly",
    secondsAtOneX: 36,
    inputs: [{ id: "stress_severity", label: "Stress severity", unit: "%", min: 0, max: 100, step: 10, default: 50, hint: "How far greenness falls below a normal year." }],
    dataNeeds: [VEG_DATA, RAIN_DATA, TMAX_DATA],
    basis: "relative",
    legend: [
      { color: "#2f7d32", label: "Greener than usual" },
      { color: "#a9c46c", label: "Normal" },
      { color: "#c7a24a", label: "Below normal" },
    ],
    effectCaption: GROUND_ONLY,
    rotationDependent: true,
  },
  {
    id: "multi-year",
    family: "seasons-years",
    label: "Multi-year rotation",
    summary: "Watch the rotation play out over several years.",
    plainMeaning: "Steps through the years of a rotation, showing what is on each field and how the soil is covered.",
    timeKind: "multi-year",
    outputKind: "timeline",
    durationLabel: "3 to 5 years, by season",
    secondsAtOneX: 50,
    inputs: [{ id: "years", label: "Years shown", unit: "years", min: 3, max: 5, step: 1, default: 4, hint: "How many years of the rotation to replay." }],
    dataNeeds: [CROP_DATA, VEG_DATA, RAIN_DATA],
    basis: "relative",
    legend: [
      { color: "#c9b23a", label: "Row crop" },
      { color: "#3f7f5e", label: "Hay or legume" },
      { color: "#7fae4a", label: "Cover crop" },
    ],
    effectCaption: GROUND_ONLY,
    rotationDependent: true,
  },
  {
    id: "trends",
    family: "seasons-years",
    label: "Trends",
    summary: "How rain and temperature have drifted over the decades.",
    plainMeaning: "Shows how the weather record for this area has changed over the years, so you can see slow shifts, not just single seasons.",
    timeKind: "decades",
    outputKind: "series",
    durationLabel: "30 years, yearly",
    secondsAtOneX: 60,
    // TODO(verify): earliest year of the daily record (NASA POWER daily starts around 1981); confirm before shipping.
    inputs: [{ id: "start_year", label: "Start year", unit: "year", min: 1981, max: 2000, step: 1, default: 1991, hint: "First year of the record you want to look at." }],
    dataNeeds: [RAIN_DATA, TMAX_DATA, TMIN_DATA],
    basis: "relative",
    legend: [
      { color: "#2b6fb3", label: "Cooler or wetter" },
      { color: "#d9d9d9", label: "Near average" },
      { color: "#c8553d", label: "Warmer or drier" },
    ],
    effectCaption: GROUND_ONLY,
    rotationDependent: false,
  },
  {
    id: "climate-shift",
    family: "what-if",
    label: "Climate shift",
    summary: "Replay a storm in a wetter, hotter world and compare.",
    plainMeaning: "Takes a storm like one that has happened and asks: what if rain came harder, dry spells ran longer and it were warmer?",
    timeKind: "event-hours",
    outputKind: "frames",
    durationLabel: "Up to 72 hours, hourly",
    secondsAtOneX: 40,
    inputs: [
      { id: "rain_change_pct", label: "Rain intensity change", unit: "%", min: -30, max: 50, step: 5, default: 20, hint: "Harder rain above zero, lighter below." },
      { id: "dry_spell_change_pct", label: "Dry spell length change", unit: "%", min: -30, max: 50, step: 5, default: 20, hint: "Longer dry spells above zero." },
      { id: "temp_shift_c", label: "Temperature shift", unit: "°C", min: -2, max: 6, step: 0.5, default: 2, hint: "How much warmer (or cooler) every day is." },
    ],
    dataNeeds: [RAIN_DATA, TMAX_DATA, TMIN_DATA, ELEV_DATA, "Climate-change adjustment factors (TODO(verify): which source and scenario)"],
    basis: "relative",
    legend: [
      { color: "#4aa3df", label: "Same as the storm" },
      { color: "#ef8a3c", label: "Changed climate" },
      { color: "#b3262d", label: "Largest change" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: true,
  },
  {
    id: "compound",
    family: "what-if",
    label: "Dry spell, then storm",
    summary: "A dry, hot stretch followed by a heavy storm on hard ground.",
    plainMeaning: "Shows how a storm that follows a dry spell can behave differently, because dry hard soil lets water run off.",
    timeKind: "event-hours",
    outputKind: "frames",
    durationLabel: "A dry phase, then a storm",
    secondsAtOneX: 50,
    inputs: [
      { id: "phase1_days", label: "Dry phase length", unit: "days", min: 3, max: 30, step: 1, default: 14, hint: "Days of dry, hot weather before the storm." },
      { id: "storm_peak_mm_h", label: "Storm peak rain rate", unit: "mm/h", min: 10, max: 100, step: 5, default: 50, hint: "How hard it rains at the heaviest hour." },
    ],
    dataNeeds: [RAIN_DATA, TMAX_DATA, SOIL_DATA, ELEV_DATA],
    basis: "relative",
    legend: [
      { color: "#c9b27a", label: "Dry ground" },
      { color: "#4aa3df", label: "Rain and runoff" },
      { color: "#1f4e8c", label: "Water gathering" },
    ],
    effectCaption: `${SKY} ${WAIT}`,
    rotationDependent: true,
  },
];

export const scenarioById = (id: string | null | undefined): ScenarioDef | undefined => SCENARIO_DEFS.find((d) => d.id === id);

/** Sky + ground + readouts for one run state. Readouts echo the user's inputs (basis "assumed": they are choices, not data). */
export function composeFrame(run: ScenarioRun): ScenarioFrame {
  const def = scenarioById(run.scenarioId) as ScenarioDef | undefined;
  if (!def) throw new Error(`Unknown scenario "${run.scenarioId}"`);
  const id: ScenarioId = def.id;
  return {
    atmosphere: ATMOSPHERE[id](run),
    ground: GROUND[id](run),
    readouts: def.inputs.map((i) => ({ label: i.label, value: String(run.inputs[i.id] ?? i.default), unit: i.unit, basis: "assumed" as const })),
  };
}
