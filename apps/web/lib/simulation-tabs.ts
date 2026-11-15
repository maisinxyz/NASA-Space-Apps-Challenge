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

import { decodeShare, type SharePanelSection } from "./share";
import type { TwinMode } from "./store";

/** Map tabs with a dedicated view mode; map and field preserve the current mode. */
export function modeForSimulationSection(section: SharePanelSection): TwinMode | undefined {
  return section === "scenarios" ? "simulate" : section === "compare" ? "compare" : section === "evidence" ? "evidence" : undefined;
}

/** The fallback opens by default, unless a link for this farm explicitly says otherwise. */
export function fallbackPanelState(hash: string, farmId: string): { open: boolean; section: SharePanelSection } {
  const shared = decodeShare(hash);
  if (shared?.farm !== farmId) return { open: true, section: "scenarios" };
  const defaultSection = shared.mode === "compare" || shared.mode === "evidence" ? shared.mode : "scenarios";
  return { open: shared.panelOpen ?? true, section: shared.panelSection ?? defaultSection };
}
