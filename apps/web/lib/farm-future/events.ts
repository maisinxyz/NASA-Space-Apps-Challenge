// What-if weather events for the BC farms (UBC Farm, KPU Langley). Each event is a preset run of one of the twin's
// scenarios (lib/twin/scenarios/registry.ts), so the 3D map plays the same storm / drought / frost animations as the
// Cornell twin. The preset inputs and the per-field exposure below are HARDCODED illustrative assumptions picked to
// look like Lower Mainland weather (owner request 2026-11-15); they are not measurements and not a forecast.
// Pure and deterministic: same farm, event, progress and inputs -> same numbers.
import { twinConfig } from "@/lib/farms";
import { stormCurve, WET_SPELL_DAYS, wetSpellRainy } from "@/lib/twin/scenarios/atmosphere/evaluators";
import type { ScenarioId } from "@/lib/twin/scenario";

export type EventId = Extract<ScenarioId, "storm" | "wet-spell" | "drought" | "heat-wave" | "frost">;

export type WeatherEvent = { id: EventId; label: string; blurb: string; inputs: Record<string, number> };

type FarmEvents = Record<EventId, Omit<WeatherEvent, "id">>;

// Inputs use the registry's input ids and stay inside each input's min/max/step.
const UBC: FarmEvents = {
  storm: { label: "Atmospheric river", blurb: "A November atmospheric river: a day of heavy Pacific rain on already-wet ground.", inputs: { peak_rain_mm_h: 10, duration_h: 24, antecedent_wetness: 70 } },
  "wet-spell": { label: "Wet month", blurb: "Four weeks of on-and-off coastal rain; the soil never dries between showers.", inputs: { rain_days_per_week: 5, wetness: 80 } },
  drought: { label: "Summer dry spell", blurb: "Eight weeks of dry, sunny Point Grey summer with no useful rain.", inputs: { dry_spell_days: 56, soil_water_holding: 110 } },
  "heat-wave": { label: "Heat dome", blurb: "A late-June heat dome: five days far hotter than a normal coastal summer.", inputs: { temp_anomaly_c: 10, duration_days: 5 } },
  frost: { label: "Late spring frost", blurb: "A clear, still April night after early plantings are in.", inputs: { min_temp_c: -3, hours_below_0: 5 } },
};

const KPU: FarmEvents = {
  storm: { label: "Atmospheric river", blurb: "A November atmospheric river over the Fraser Valley: rain on saturated floodplain soil.", inputs: { peak_rain_mm_h: 10, duration_h: 30, antecedent_wetness: 80 } },
  "wet-spell": { label: "Wet month", blurb: "Four rainy weeks in the valley; the low fields stay soggy.", inputs: { rain_days_per_week: 5, wetness: 90 } },
  drought: { label: "Summer dry spell", blurb: "Seven weeks of hot, dry valley summer with no useful rain.", inputs: { dry_spell_days: 49, soil_water_holding: 160 } },
  "heat-wave": { label: "Heat dome", blurb: "A late-June heat dome: inland Langley heats up more than the coast.", inputs: { temp_anomaly_c: 12, duration_days: 5 } },
  frost: { label: "Late spring frost", blurb: "Cold valley air pools on the flat fields on a clear April night.", inputs: { min_temp_c: -6, hours_below_0: 9 } },
};

const EVENTS: Record<string, FarmEvents> = { "ubc-farm": UBC, "kpu-langley": KPU };

/** A normal daily high for the season of each event's farm (°C), assumed. */
const NORMAL_HIGH_C: Record<string, number> = { "ubc-farm": 22, "kpu-langley": 25 };

export const EVENT_ORDER: EventId[] = ["storm", "wet-spell", "drought", "heat-wave", "frost"];

export const eventsFor = (farmId: string | null): WeatherEvent[] => {
  const set = farmId ? EVENTS[farmId] : undefined;
  return set ? EVENT_ORDER.map((id) => ({ id, ...set[id] })) : [];
};

export const isEventId = (id: string | null): id is EventId => !!id && (EVENT_ORDER as string[]).includes(id);

// How strongly each field reacts, 0.6 (sheltered / well drained) .. 1.3 (low, heavy or exposed), per event kind.
// Hardcoded guesses from where the plots sit; any field not listed falls back to a stable hash.
type Exposure = { wet: number; dry: number; heat: number; cold: number };
const EXPOSURE: Record<string, Exposure> = {
  "d3-brassicas": { wet: 0.9, dry: 1.05, heat: 1.0, cold: 0.9 },
  "d4-goosefoots": { wet: 1.0, dry: 1.0, heat: 1.1, cold: 1.0 },
  "d6-nightshades": { wet: 1.25, dry: 0.85, heat: 1.2, cold: 1.25 },
  "d6-alliums": { wet: 1.15, dry: 0.9, heat: 0.95, cold: 1.15 },
  "d7-cucurbits": { wet: 0.8, dry: 1.25, heat: 1.25, cold: 1.05 },
  "d5-maya": { wet: 0.75, dry: 1.1, heat: 0.8, cold: 0.7 },
  "kpu-f1": { wet: 1.0, dry: 1.0, heat: 1.0, cold: 1.05 },
  "kpu-f2": { wet: 1.3, dry: 0.8, heat: 0.9, cold: 1.3 },
  "kpu-f3": { wet: 0.85, dry: 1.15, heat: 1.15, cold: 0.9 },
  "kpu-f4": { wet: 1.1, dry: 0.95, heat: 1.2, cold: 1.1 },
};
const hashExposure = (id: string): number => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 0.75 + (h % 50) / 100;
};
const exposure = (fieldId: string, kind: keyof Exposure) => EXPOSURE[fieldId]?.[kind] ?? hashExposure(fieldId + kind);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

/** Share of the storm's total rain fallen by progress p (numeric integral of the shared rain curve). */
const STEPS = 240;
const CURVE_TOTAL = Array.from({ length: STEPS }, (_, i) => stormCurve((i + 0.5) / STEPS)).reduce((a, b) => a + b, 0) / STEPS;
function stormRainSoFar(p: number, peak: number, hours: number): number {
  const n = Math.round(clamp01(p) * STEPS);
  let s = 0;
  for (let i = 0; i < n; i++) s += stormCurve((i + 0.5) / STEPS);
  return (s / STEPS) * peak * hours;
}
export const stormTotalMm = (peak: number, hours: number) => CURVE_TOTAL * peak * hours;

/** Assumed rain on one rainy day of the wet spell, mm. */
const WET_DAY_MM = 11;
/** Assumed summer evapotranspiration, mm per day. */
const ET_MM_DAY = 4.5;

export type Stat = { label: string; value: string; unit: string };
export type FieldImpact = { fieldId: string; name: string; level: number; text: string };
export type EventStats = { stats: Stat[]; fields: FieldImpact[] };

const band = (level: number, words: [string, string, string]) => (level > 0.75 ? words[2] : level > 0.45 ? words[1] : words[0]);

/** Numbers for the what-if card at `progress` 0..1 of the event. */
export function eventStats(farmId: string, id: EventId, progress: number, inputs: Record<string, number>): EventStats {
  const p = clamp01(progress);
  const fields = twinConfig(farmId)?.fields ?? [];
  const per = (kind: keyof Exposure, base: number, words: [string, string, string]): FieldImpact[] =>
    fields.map((f) => {
      const level = clamp01(base * exposure(f.id, kind));
      return { fieldId: f.id, name: f.name, level, text: band(level, words) };
    });

  switch (id) {
    case "storm": {
      const { peak_rain_mm_h: peak, duration_h: hours, antecedent_wetness: w0 } = inputs;
      const fallen = stormRainSoFar(p, peak, hours);
      const total = stormTotalMm(peak, hours);
      const rateNow = peak * stormCurve(p);
      // Soil fills from the starting wetness towards saturation as rain falls; ~120 mm fills the top 30 cm (assumed).
      const sat = clamp01(w0 / 100 + (1 - w0 / 100) * (fallen / 120));
      const runoff = Math.max(0, fallen - (1 - w0 / 100) * 120 * 0.8);
      return {
        stats: [
          { label: "Rain so far", value: `${round(fallen)} of ${round(total)}`, unit: "mm" },
          { label: "Rain rate now", value: String(round(rateNow, 1)), unit: "mm/h" },
          { label: "Topsoil saturation", value: String(round(sat * 100)), unit: "%" },
          { label: "Runoff / ponding", value: String(round(runoff)), unit: "mm" },
        ],
        fields: per("wet", sat * (0.55 + 0.45 * clamp01(runoff / 30)), ["Soaking in", "Puddles in low spots", "Standing water"]),
      };
    }
    case "wet-spell": {
      const perWeek = inputs.rain_days_per_week;
      const day = Math.min(WET_SPELL_DAYS, Math.floor(p * WET_SPELL_DAYS));
      let rainyDays = 0;
      for (let d = 0; d < day; d++) if (wetSpellRainy(d, perWeek)) rainyDays++;
      const rain = rainyDays * WET_DAY_MM;
      const moist = clamp01(0.5 + (inputs.wetness / 100 - 0.5) * clamp01(day / 10));
      return {
        stats: [
          { label: "Day", value: `${Math.max(1, day)} of ${WET_SPELL_DAYS}`, unit: "" },
          { label: "Rain so far", value: String(rain), unit: "mm" },
          { label: "Rainy days", value: String(rainyDays), unit: "days" },
          { label: "Soil moisture", value: String(round(moist * 100)), unit: "% of capacity" },
        ],
        fields: per("wet", moist * clamp01(day / 14 + 0.3), ["Workable", "Too wet to till", "Waterlogged"]),
      };
    }
    case "drought": {
      const days = inputs.dry_spell_days;
      const whc = inputs.soil_water_holding;
      const day = Math.round(p * days);
      const moist = 0.75 * Math.exp((-ET_MM_DAY * day) / (whc * 0.9));
      const deficit = Math.max(0, 0.75 * whc - moist * whc);
      return {
        stats: [
          { label: "Day without rain", value: `${day} of ${days}`, unit: "" },
          { label: "Soil water left", value: String(round(moist * 100)), unit: "% of capacity" },
          { label: "Water deficit", value: String(round(deficit)), unit: "mm" },
          { label: "Irrigation to refill", value: String(round(deficit * 10, -1)), unit: "m³/ha" }, // 1 mm = 10 m³/ha
        ],
        fields: per("dry", clamp01((0.75 - moist) / 0.65), ["Fine", "Wilting by afternoon", "Needs water now"]),
      };
    }
    case "heat-wave": {
      const days = inputs.duration_days;
      const anomaly = inputs.temp_anomaly_c;
      const normal = NORMAL_HIGH_C[farmId] ?? 23;
      // Builds to the peak day ~65 % through, eases a little after (same shape as the sky).
      const shape = p <= 0.65 ? Math.sin((p / 0.65) * (Math.PI / 2)) : 1 - 0.35 * ((p - 0.65) / 0.35);
      const high = normal + anomaly * shape;
      const day = Math.max(1, Math.ceil(p * days));
      return {
        stats: [
          { label: "Day", value: `${day} of ${days}`, unit: "" },
          { label: "Daily high", value: String(round(high, 1)), unit: "°C" },
          { label: "Above normal", value: `+${round(high - normal, 1)}`, unit: "°C" },
          { label: "Crop water use", value: String(round(ET_MM_DAY + 0.35 * (high - normal), 1)), unit: "mm/day" },
        ],
        fields: per("heat", clamp01((high - normal) / 12), ["Coping", "Heat stress", "Scorch risk"]),
      };
    }
    case "frost": {
      const min = inputs.min_temp_c;
      const below = inputs.hours_below_0;
      const hour = 18 + p * 48;
      // Daily cycle: coldest at 05:00 (= min), warmest at 17:00 (min + 12 °C).
      const temp = min + 6 + 6 * Math.cos(((hour - 17) / 24) * 2 * Math.PI);
      const hh = Math.floor(hour % 24);
      // Hours below 0 so far: `below` hours each night before 06:00.
      let frozen = 0;
      for (let h = 18; h < hour; h++) {
        const untilSunrise = (((6 - h) % 24) + 24) % 24; // hours to the next 06:00
        if (untilSunrise > 0 && untilSunrise <= below) frozen++;
      }
      return {
        stats: [
          { label: "Time", value: `${String(hh).padStart(2, "0")}:00, night ${hour < 30 ? 1 : 2}`, unit: "" },
          { label: "Air temperature", value: String(round(temp, 1)), unit: "°C" },
          { label: "Hours below 0 °C", value: String(frozen), unit: "h" },
          { label: "Night low", value: String(min), unit: "°C" },
        ],
        fields: per("cold", clamp01(-temp / 6) * clamp01(-min / 5), ["No damage", "Frost on leaves", "Tender crops lost"]),
      };
    }
  }
}
