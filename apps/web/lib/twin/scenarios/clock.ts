// Pure helpers for the scenario screen: input values (defaults, clamping) and the scenario clock's steps and label.
import type { ScenarioDef, ScenarioInput } from "../scenario";

export const SPEEDS = [0.5, 1, 2, 4] as const;
export type ScenarioSpeed = (typeof SPEEDS)[number];

/** Keep a value inside min..max and on the input's step grid. Non-finite falls back to the default. */
export function clampInput(i: ScenarioInput, v: number): number {
  if (!Number.isFinite(v)) return i.default;
  const snapped = Math.round((Math.min(i.max, Math.max(i.min, v)) - i.min) / i.step) * i.step + i.min;
  return Number(Math.min(i.max, snapped).toFixed(6));
}

/** Current input values of a scenario: stored values (validated) over the defaults. */
export function resolveInputs(def: ScenarioDef, stored: Record<string, number> | undefined): Record<string, number> {
  return Object.fromEntries(def.inputs.map((i) => [i.id, stored && i.id in stored ? clampInput(i, stored[i.id]) : i.default]));
}

/** What the clock counts. `steps` = number of ticks (hours, days, months or years); 0 = no clock (static scenario). */
export type ClockSpec = { unit: "Hour" | "Day" | "Month" | "Year"; steps: number; firstYear?: number };

// The clock unit and length can differ from timeKind (e.g. a heat wave is a season-scale run counted in days).
export function clockSpec(def: ScenarioDef, inputs: Record<string, number>): ClockSpec {
  switch (def.id) {
    case "storm":
      return { unit: "Hour", steps: inputs.duration_h };
    case "wet-spell":
      return { unit: "Day", steps: 28 };
    case "drought":
      return { unit: "Day", steps: inputs.dry_spell_days };
    case "heat-wave":
      return { unit: "Day", steps: inputs.duration_days };
    case "frost":
      return { unit: "Hour", steps: 48 };
    case "bare-soil":
    case "veg-stress":
      return { unit: "Month", steps: 12 };
    case "multi-year":
      return { unit: "Year", steps: inputs.years };
    case "trends":
      return { unit: "Year", steps: 30, firstYear: inputs.start_year };
    default:
      return { unit: "Hour", steps: 0 };
  }
}

/** 1-based current step for progress 0..1. */
export const currentStep = (c: ClockSpec, progress: number) => (c.steps <= 0 ? 0 : Math.min(c.steps, 1 + Math.floor(Math.min(1, Math.max(0, progress)) * c.steps)));

/** "Hour 14 of 72", "Year 2005 (15 of 30)". Static scenarios: "Static map". */
export function clockLabel(c: ClockSpec, progress: number): string {
  if (c.steps <= 0) return "Static map";
  const n = currentStep(c, progress);
  return c.firstYear === undefined ? `${c.unit} ${n} of ${c.steps}` : `Year ${c.firstYear + n - 1} (${n} of ${c.steps})`;
}

/** Progress after moving `delta` steps (clamped to 0..1). Lands on the middle of a step so labels are stable. */
export function stepProgress(c: ClockSpec, progress: number, delta: number): number {
  if (c.steps <= 0) return 0;
  const n = Math.min(c.steps, Math.max(1, currentStep(c, progress) + delta));
  return (n - 0.5) / c.steps;
}
