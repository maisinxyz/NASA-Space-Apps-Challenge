"use client";
// The selected condition layer for the current farm and scrubber year. Shared by the 2D map, the 3D overlay and the legend.
import { useMemo } from "react";
import { create } from "zustand";

import { forecastYear, strategyOf } from "@/lib/farm-future/data";
import { useFutureStore } from "@/lib/farm-future/store";
import { useFutureData } from "@/lib/farm-future/useFutureData";
import { twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";

import { condById, conditionView, plotFeats, type CondId } from "./model";

export const useConditionStore = create<{ selected: CondId | null; open: boolean }>(() => ({ selected: "heat", open: true }));

export function useConditionView() {
  const farmId = useAppStore((s) => s.farmId);
  const selected = useConditionStore((s) => s.selected);
  const t = useFutureStore((s) => Math.floor(s.t)); // whole years only: no re-render on every scrubber frame
  const strategyId = useFutureStore((s) => s.strategyId);
  const { data, forecast } = useFutureData();
  const twin = twinConfig(farmId);
  const feats = useMemo(() => plotFeats(twin?.fields ?? []), [twin]);
  const year = forecastYear(t, forecast?.horizon_years ?? 10);
  const engineId = strategyOf(data, strategyId).engineId;
  return useMemo(() => {
    const cond = condById(selected);
    if (!cond || !feats.length) return null;
    return conditionView(cond, feats, { forecast, engineId }, year);
  }, [selected, feats, forecast, engineId, year]);
}

/** Farm-average headline numbers at the scrubber year, for the four Conditions pills. */
export function usePillValues() {
  const farmId = useAppStore((s) => s.farmId);
  const t = useFutureStore((s) => Math.floor(s.t)); // whole years only: no re-render on every scrubber frame
  const strategyId = useFutureStore((s) => s.strategyId);
  const { data, forecast } = useFutureData();
  const twin = twinConfig(farmId);
  const feats = useMemo(() => plotFeats(twin?.fields ?? []), [twin]);
  const year = forecastYear(t, forecast?.horizon_years ?? 10);
  const engineId = strategyOf(data, strategyId).engineId;
  return useMemo(() => {
    if (!feats.length) return null;
    const avg = (id: CondId) => conditionView(condById(id)!, feats, { forecast, engineId }, year).series[year - 1];
    const days = Math.round(avg("firstFrost") - avg("lastFrost"));
    return {
      rain: `${Math.round(avg("rain")).toLocaleString("en-US")} mm/yr`,
      moisture: `${avg("soilMoist").toFixed(1)}% drier`,
      heat: `${Math.round(avg("heat"))} days/yr`,
      frost: `${days} days`,
    };
  }, [feats, forecast, engineId, year]);
}
