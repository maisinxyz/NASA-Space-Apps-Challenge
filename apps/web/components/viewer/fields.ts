// Contract REQUEST R1 mock (PRD §4.4). Fields are NOT in openapi v1.0.0: this static file is the only
// source, it loads only with NEXT_PUBLIC_MOCK_EXTRAS=1, and UI must label it "Illustrative (synthetic)".
import type { TerrainPackage } from "@/lib/api/types";
import type { FieldFeature } from "./types";

export const mockExtrasEnabled = process.env.NEXT_PUBLIC_MOCK_EXTRAS === "1";

/** Illustrative fields that fall inside this terrain's bbox; [] when the flag is off. */
export async function loadMockFields(terrain: TerrainPackage): Promise<FieldFeature[]> {
  if (!mockExtrasEnabled) return [];
  const res = await fetch("/mock-extras/fields.json");
  if (!res.ok) return [];
  const { features } = (await res.json()) as { features: FieldFeature[] };
  const [w, s, e, n] = terrain.bbox_wgs84;
  return features.filter((f) => f.geometry.coordinates[0].every(([lon, lat]) => lon >= w && lon <= e && lat >= s && lat <= n));
}
