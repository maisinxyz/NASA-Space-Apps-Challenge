// Where a scenario run gets its data. "none" = no run: Simulate shows cards, inputs and an empty state, and the map
// renders no effect. "fixture" = synthetic sample inputs, not the farm's real weather.
// Policy (approved by the user 2026-11-14): "fixture" runs in the real twin for full-twin farms only (tier "twin":
// Cornell, Beltsville) so the effects can be shown before the backend delivers runs. It is always labelled
// "Synthetic demo data" (SYNTHETIC_BADGE) and readouts keep basis "synthetic". Explore-only farms stay "none".
import type { FarmInfo } from "@/lib/farms";

export type RunSource = "none" | "fixture";

export const EMPTY_RUN_MESSAGE = "This scenario runs when the backend delivers data for this farm.";
export const SYNTHETIC_BADGE = "Synthetic demo data";
export const SYNTHETIC_NOTE = "Fixture inputs, not this farm's real weather.";

/** Run source for a farm. `override` (the /dev/scenarios toggle) wins when given. */
export const runSourceFor = (farm: Pick<FarmInfo, "tier"> | null | undefined, override?: RunSource): RunSource => override ?? (farm?.tier === "twin" ? "fixture" : "none");
