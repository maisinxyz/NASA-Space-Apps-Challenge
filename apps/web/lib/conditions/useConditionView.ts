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
  const t = useFutureStore((s) => s.t);
  const strategyId = useFutureStore((s) => s.strategyId);
  const { data, forecast } = useFutureData();
  const twin = twinConfig(farmId);
  const feats = useMemo(() => plotFeats(twin?.fields ?? []), [twin]);
  const year = forecastYear(t, forecast?.horizon_years ?? 10);
  const engineId = strategyOf(data, strategyId).engineId;
  return useMemo(() => {
    const cond = condById(selected);
    if (!cond || !feats.length) return null;
    return { ...conditionView(cond, feats, { forecast, engineId }, year), now: conditionView(cond, feats, { forecast, engineId }, 1) };
  }, [selected, feats, forecast, engineId, year]);
}
