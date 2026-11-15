// Where a scenario run gets its data. "none" = no run: Simulate shows cards, inputs and an empty state, and the map
// renders no effect. "fixture" = preset what-if inputs, not the farm's real weather.
// The two v4 BC farms (UBC Farm, KPU Langley) run What-if weather events from preset inputs
// (lib/farm-future/events.ts), approved by the owner 2026-11-15. Every other farm is "none" and shows "No data".
// The /dev/scenarios override may pick "fixture" for any farm.
import type { FarmInfo } from "@/lib/farms";

export type RunSource = "none" | "fixture";

export const EMPTY_RUN_MESSAGE = "No data";

const WHAT_IF_FARMS = new Set(["ubc-farm", "kpu-langley"]);

/** Run source for a farm. `override` (the /dev/scenarios toggle) wins when given. */
export const runSourceFor = (farm: Pick<FarmInfo, "id" | "tier"> | null | undefined, override?: RunSource): RunSource =>
  override ?? (farm && WHAT_IF_FARMS.has(farm.id) ? "fixture" : "none");
