// Must be imported before "cesium": tells Cesium where its static files (Workers, Assets, Widgets) are served.
// They are copied to public/cesium by scripts/sync-cesium.mjs (predev/prebuild).
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}
if (typeof window !== "undefined") window.CESIUM_BASE_URL = "/cesium";
export {};
