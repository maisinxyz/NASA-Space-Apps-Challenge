// Where a scenario run gets its data. "none" = no run: Simulate shows cards, inputs and an empty state, and the map
// renders no effect. "fixture" = synthetic sample inputs, not the farm's real weather.
// Fixture (made-up) runs are never used in the product: every farm is "none" and shows "No data". Only the
// /dev/scenarios override may pick "fixture".
import type { FarmInfo } from "@/lib/farms";

export type RunSource = "none" | "fixture";

export const EMPTY_RUN_MESSAGE = "No data";

/** Run source for a farm. `override` (the /dev/scenarios toggle) wins when given. */
export const runSourceFor = (_farm: Pick<FarmInfo, "tier"> | null | undefined, override?: RunSource): RunSource => override ?? "none";
