// Climate scenarios for the farm twin (Simulate mode). Foundation only: the registry is empty until scenarios are
// built from real NASA data. Never register a made-up scenario here.
import type { BasisOrRelative } from "@/lib/api/types";

export type ScenarioKind = "storm" | "heat" | "drought" | "frost";

export interface ClimateScenario {
  id: string;
  kind: ScenarioKind;
  label: string;
  basis: BasisOrRelative;
  durationMin: number;
  /** Colour key for the overlay, low to high. */
  legend: { color: string; label: string }[];
  /**
   * Draws the scenario at `tMin` minutes for `rotationId` into `canvas` (north-up, covering the farm bbox).
   * The caller wraps it in a GroundOverlay and bumps `version`.
   */
  render(tMin: number, rotationId: string, canvas: HTMLCanvasElement): void;
}

export const SCENARIOS: ClimateScenario[] = [];
