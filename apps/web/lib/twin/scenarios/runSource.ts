// Where a scenario run gets its data. "none" = the backend has not delivered a run (the real twin, always, for now):
// Simulate shows cards, inputs and an empty state, and the map renders no effect. "fixture" = synthetic sample inputs,
// enabled only on the dev page /dev/scenarios. Never use "fixture" in the product.
export type RunSource = "none" | "fixture";

export const EMPTY_RUN_MESSAGE = "This scenario runs when the backend delivers data for this farm.";
