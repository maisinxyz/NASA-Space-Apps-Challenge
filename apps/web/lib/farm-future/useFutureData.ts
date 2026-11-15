"use client";
// The Future-mode read model for the current farm: engine forecast when one is loaded for this farm's site, else fixtures.
import { useMemo } from "react";

import { siteForFarm } from "@/lib/forecast/sites";
import { useForecastStore } from "@/lib/forecast/store";
import { useAppStore } from "@/lib/store";

import { buildFutureData } from "./data";

export function useFutureData() {
  const farmId = useAppStore((s) => s.farmId);
  const loaded = useForecastStore((s) => s.forecast);
  const siteId = siteForFarm(farmId);
  const forecast = loaded && siteId && loaded.site_id === siteId ? loaded : null;
  const data = useMemo(() => buildFutureData(forecast), [forecast]);
  return { data, forecast };
}
