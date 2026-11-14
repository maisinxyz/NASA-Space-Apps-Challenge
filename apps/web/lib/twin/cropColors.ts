// Crop colour table shared by the map (components/viewer/cesium/twin.ts, ground shader) and the scenario legends.
// Light module (no cesium) so UI and tests can read the exact colours the map draws.
import type { CropLook } from "@/components/globe/types";

/**
 * Illustrative ground-cover colours (not a measured crop map). Natural hues, distinct from each other and
 * readable over aerial imagery. Product choice, tune freely.
 */
export const CROP_COLORS: Record<CropLook, string> = {
  grass: "#7cb85a", // pasture / hay
  corn: "#2f7a32", // tall dark green
  cereal: "#d9b44a", // ripening grain
  legume: "#a8d46a", // light green (beans, peas)
  cover: "#3f9a86", // teal-green cover crop
  berry: "#7a4a86", // berry rows, purple-ish
  bare: "#8a6446", // bare soil
};

/** Plain words for the crop looks (hover label). Illustrative, not a crop map. */
export const CROP_WORDS: Record<CropLook, string> = {
  grass: "Grass / hay",
  corn: "Corn",
  cereal: "Small grain",
  legume: "Legume (beans, peas)",
  cover: "Cover crop",
  berry: "Berries",
  bare: "Bare soil",
};
