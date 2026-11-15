"use client";
import { create } from "zustand";

/** Whether the rotation planner overlay is open (F7). */
export const usePlannerStore = create<{ open: boolean }>(() => ({ open: false }));
