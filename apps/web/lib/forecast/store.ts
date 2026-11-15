"use client";

import { create } from "zustand";
import { apiMode, getForecast, getPrebuiltForecast } from "@/lib/api/client";
import type { Forecast, ForecastRequest } from "@/lib/api/types";
import { requestFor } from "./sites";

export type ForecastSource = "live" | "prebuilt" | "mock";
export type ForecastState = {
  siteId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  forecast: Forecast | null;
  request: ForecastRequest | null;
  pendingRequest: ForecastRequest | null;
  source: ForecastSource | null;
  error: string | null;
  run(siteId: string, request: ForecastRequest): Promise<void>;
  retry(): Promise<void>;
  load(siteId: string, whatIf?: { rainPct: number; tempC: number }): Promise<void>;
  reset(): void;
};

let ticket = 0;
export const useForecastStore = create<ForecastState>((set, get) => ({
  siteId: null,
  status: "idle",
  forecast: null,
  request: null,
  pendingRequest: null,
  source: null,
  error: null,

  async run(siteId, request) {
    const mine = ++ticket;
    const same = get().siteId === siteId;
    set({
      siteId,
      status: "loading",
      pendingRequest: request,
      error: null,
      ...(same ? {} : { forecast: null, request: null, source: null }),
    });
    try {
      let forecast: Forecast;
      let source: ForecastSource;
      if (apiMode === "live") {
        forecast = await getForecast(siteId, request);
        source = "live";
      } else {
        const defaultRequest = requestFor(siteId);
        if (!defaultRequest || JSON.stringify(request) !== JSON.stringify(defaultRequest)) {
          throw new Error("Live forecast access is required to score edited inputs. The saved forecast remains visible.");
        }
        try {
          forecast = await getPrebuiltForecast(siteId);
          source = "prebuilt";
        } catch {
          forecast = await getForecast(siteId, request);
          source = "mock";
        }
      }
      if (mine === ticket) {
        set({ status: "ready", forecast, request: source === "live" ? request : null, source, pendingRequest: null });
      }
    } catch (error) {
      if (mine === ticket) set({ status: "error", error: error instanceof Error ? error.message : "Forecast failed." });
    }
  },

  async retry() {
    const { siteId, pendingRequest } = get();
    if (siteId && pendingRequest) await get().run(siteId, pendingRequest);
  },

  async load(siteId, whatIf) {
    const request = requestFor(siteId, whatIf);
    if (request) {
      await get().run(siteId, request);
    } else {
      ++ticket;
      set({ siteId, status: "error", forecast: null, request: null, pendingRequest: null, source: null, error: `No forecast request for ${siteId}.` });
    }
  },

  reset() {
    ++ticket;
    set({ siteId: null, status: "idle", forecast: null, request: null, pendingRequest: null, source: null, error: null });
  },
}));
