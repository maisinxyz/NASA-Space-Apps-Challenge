// Light public entry: types, legends and the R1 mock loader, with NO three.js behind it.
// Import this from pages and panels; import "@/components/viewer" only where <TwinViewer /> itself is loaded.
export * from "./types";
export { buildLayerLegends, diffLegend, isCoarseImagery, RISK_LEGEND } from "./legends";
export { loadMockFields, mockExtrasEnabled } from "./fields";
