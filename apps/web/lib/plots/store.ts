"use client";
// Farm plots the user draws on the 2D map (corner by corner). One list per farm. Rings are open (first point not repeated).
import { create } from "zustand";

import type { LonLat } from "@/lib/map2d/geo";

import seed from "./plots.json";

export type DrawnPlot = { id: string; name: string; colour: string; ring: LonLat[] };

export const PLOT_COLOURS = ["#E2B866", "#6FB1A0", "#C46A52", "#8FB35A", "#7C8FD6", "#D68FB8", "#E08A3C", "#5FB4D9"];
// Seed = the committed plots.json (shared with teammates). Changes are written back through /api/plots (dev only).
const save = (v: Record<string, DrawnPlot[]>) => {
  void fetch("/api/plots", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => {});
};

type PlotState = {
  byFarm: Record<string, DrawnPlot[]>;
  add(farmId: string, ring: LonLat[]): void;
  remove(farmId: string, id: string): void;
};

export const usePlotStore = create<PlotState>((set, get) => ({
  byFarm: seed as Record<string, DrawnPlot[]>,
  add: (farmId, ring) => {
    const list = get().byFarm[farmId] ?? [];
    const n = list.reduce((m, p) => Math.max(m, Number(p.id.split("-").pop()) || 0), 0) + 1;
    const plot: DrawnPlot = { id: `plot-${n}`, name: `Plot ${n}`, colour: PLOT_COLOURS[(n - 1) % PLOT_COLOURS.length], ring };
    const byFarm = { ...get().byFarm, [farmId]: [...list, plot] };
    save(byFarm);
    set({ byFarm });
  },
  remove: (farmId, id) => {
    const byFarm = { ...get().byFarm, [farmId]: (get().byFarm[farmId] ?? []).filter((p) => p.id !== id) };
    save(byFarm);
    set({ byFarm });
  },
}));

const EMPTY: DrawnPlot[] = [];
/** Drawn plots of one farm (stable empty array when none). */
export const usePlots = (farmId: string | null): DrawnPlot[] => {
  const list = usePlotStore((s) => (farmId ? s.byFarm[farmId] : undefined)) ?? EMPTY;
  return list;
};
