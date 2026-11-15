/** Only explicit farm-to-terrain mappings establish provenance; array order never does. */
export function terrainForSelectedFarm(
  farm: string | null,
  mappings: Readonly<Record<string, string>>,
): string | undefined {
  return farm ? mappings[farm] : undefined;
}
/** Static educational drafts remain provisional even when the API runs in live mode. */
export function learningContentStatus(apiMode: string): "provisional" {
  void apiMode;
  return "provisional";
}
