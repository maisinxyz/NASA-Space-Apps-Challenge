/** Return the automatically activated tab for a tablist navigation key. */
export function nextSimulationTab<T extends string>(tabs: readonly T[], current: T, key: string): T | null {
  const index = tabs.indexOf(current);
  if (!tabs.length || index < 0) return null;
  if (key === "Home") return tabs[0];
  if (key === "End") return tabs[tabs.length - 1];
  if (key === "ArrowRight") return tabs[(index + 1) % tabs.length];
  if (key === "ArrowLeft") return tabs[(index + tabs.length - 1) % tabs.length];
  return null;
}
