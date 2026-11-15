"use client";
// Fetches the analysis when the farm, scenario, constraints or allowed crops change. NOT when weights or criteria
// change: those re-rank client-side with rerank(), so per-criterion scores never move with weights.
import { useEffect, useState } from "react";

import { getCrops, isMock } from "@/lib/api/client";
import { postRotationAnalysis } from "@/lib/rotation/api";
import type { RotationAnalysis } from "@/lib/rotation/draft-types";
import { buildAnalysisRequest, useRotationStore } from "@/lib/rotation/store";
import { useAppStore } from "@/lib/store";

type State = { data?: RotationAnalysis; error?: unknown; done: boolean };

export function useRotationAnalysis() {
  const farmId = useAppStore((s) => s.farmId);
  const scenario = useRotationStore((s) => s.rotScenario);
  const constraints = useRotationStore((s) => s.farmerRequest.constraints);
  const allowed = useRotationStore((s) => s.farmerRequest.allowed_crops);
  const [res, setRes] = useState<State & { key: string }>({ key: "", done: false });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([farmId, scenario, constraints, allowed, tick]);

  useEffect(() => {
    if (!farmId) return;
    let stale = false;
    postRotationAnalysis(farmId, buildAnalysisRequest())
      .then((data) => !stale && setRes({ key, data, done: true }))
      .catch((error) => !stale && setRes((r) => ({ key, error, data: r.data, done: true })));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every dependency; weights are read at call time on purpose.
  }, [key]);

  const current = res.key === key;
  // Stale-while-revalidate: `data` keeps the last success while refetching (so results do not unmount); errors only for the current key.
  return { farmId, isMock, data: res.data, error: current ? res.error : undefined, loading: !!farmId && !(current && res.done), retry: () => setTick((t) => t + 1) };
}

/** crop_id -> display name from GET /crops; empty until loaded, callers fall back to the id. */
export function useCropNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let stale = false;
    getCrops()
      .then((cs) => !stale && setNames(Object.fromEntries(cs.map((c) => [c.id, c.name]))))
      .catch(() => {}); // picker and names degrade to ids; the analysis call reports its own errors
    return () => {
      stale = true;
    };
  }, []);
  return names;
}
