// Public entry for viewer-side helpers: types, legends and the R1 mock loader (no three.js).
export * from "./types";
export { buildLayerLegends, diffLegend, isCoarseImagery, RISK_LEGEND } from "./legends";
export { loadMockFields, mockExtrasEnabled } from "./fields";
