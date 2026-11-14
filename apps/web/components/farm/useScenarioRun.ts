"use client";
// Runs the scenario clock and composes the frame the globe draws. Owned by GlobeHome (one ticker only).
// No run source ("none", the real twin until the backend exists) = no ticking and no frame: nothing is rendered.
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/lib/store";
import { resolveInputs } from "@/lib/twin/scenarios/clock";
import { composeFrame, scenarioById } from "@/lib/twin/scenarios/registry";
import type { RunSource } from "@/lib/twin/scenarios/runSource";
import type { ScenarioFrame } from "@/lib/twin/scenario";

// ponytail: state updates at ~30 Hz, not every display frame; the engines interpolate with run.timeS if they need more.
const EMIT_MS = 33;

export function useScenarioRun({ farmId, runSource, enabled, reducedMotion }: { farmId: string | null; runSource: RunSource; enabled: boolean; reducedMotion: boolean }): ScenarioFrame | null {
  const s = useAppStore(useShallow((x) => ({ id: x.scenarioId, stored: x.scenarioInputs, progress: x.scenarioProgress, rotation: x.scenarioRotation })));
  const def = scenarioById(s.id);
  const live = enabled && runSource !== "none" && !!def;
  const [timeS, setTimeS] = useState(0);

  useEffect(() => {
    if (!live || reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    let lastEmit = 0;
    let t = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      t += dt;
      const st = useAppStore.getState();
      const d = scenarioById(st.scenarioId);
      if (st.scenarioPlaying && d && d.secondsAtOneX > 0) {
        const p = Math.min(1, st.scenarioProgress + (dt * st.scenarioSpeed) / d.secondsAtOneX);
        useAppStore.setState({ scenarioProgress: p, ...(p >= 1 && { scenarioPlaying: false }) });
      }
      if (now - lastEmit >= EMIT_MS) {
        lastEmit = now;
        setTimeS(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, reducedMotion]);

  return useMemo(() => {
    if (!live || !def || !farmId) return null;
    const frame = composeFrame({ scenarioId: def.id, farmId, progress: s.progress, inputs: resolveInputs(def, s.stored[def.id]), rotationId: def.rotationDependent ? s.rotation : null, timeS });
    // Fixture numbers are made up: every readout says so.
    return runSource === "fixture" ? { ...frame, readouts: frame.readouts.map((r) => ({ ...r, basis: "synthetic" as const })) } : frame;
  }, [live, def, farmId, runSource, s.progress, s.stored, s.rotation, timeS]);
}
