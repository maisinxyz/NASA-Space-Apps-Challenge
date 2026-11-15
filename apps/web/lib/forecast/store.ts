"use client";
// Loads the engine forecast for a farm and keeps it for the farm view. live = POST /forecast (NEXT_PUBLIC_API_MODE=live);
// prebuilt = real engine output shipped as a static file (offline/mock mode); mock = contract placeholder fixture.
import { create } from "zustand";

import { apiMode, ApiError, getForecast, getPrebuiltForecast } from "@/lib/api/client";
import type { Forecast } from "@/lib/api/types";

import { requestFor } from "./sites";

export type ForecastSource = "live" | "prebuilt" | "mock";
export type ForecastState = {
  siteId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  forecast: Forecast | null;
  source: ForecastSource | null;
  error: string | null;
  load(siteId: string, whatIf?: { rainPct: number; tempC: number }): Promise<void>;
  reset(): void;
};

let ticket = 0; // a later load supersedes an earlier one still in flight

export const useForecastStore = create<ForecastState>((set, get) => ({
  siteId: null,
  status: "idle",
  forecast: null,
  source: null,
  error: null,

  async load(siteId, whatIf) {
    const mine = ++ticket;
    const keep = get().siteId === siteId ? get().forecast : null; // keep the old result visible while a slider refetch runs
    set({ siteId, status: "loading", forecast: keep, error: null });
    try {
      const body = requestFor(siteId, whatIf);
      if (!body) throw new ApiError({ code: "SITE_NOT_FOUND", message: `No forecast request for ${siteId}.`, retryable: false }, 404);
      let forecast: Forecast;
      let source: ForecastSource;
      if (apiMode === "live") {
        forecast = await getForecast(siteId, body);
        source = "live";
      } else {
        try {
          forecast = await getPrebuiltForecast(siteId);
          source = "prebuilt";
        } catch {
          forecast = await getForecast(siteId, body); // contract fixture, labelled mock
          source = "mock";
        }
      }
      if (mine === ticket) set({ status: "ready", forecast, source });
    } catch (e) {
      if (mine === ticket) set({ status: "error", error: e instanceof Error ? e.message : "Forecast failed." });
    }
  },
  reset: () => set({ siteId: null, status: "idle", forecast: null, source: null, error: null }),
}));
