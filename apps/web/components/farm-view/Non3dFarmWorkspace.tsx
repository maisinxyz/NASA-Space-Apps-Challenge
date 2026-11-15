"use client";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { fallbackPanelState } from "@/lib/simulation-tabs";
import { FV_CSS } from "./styles";
import {
  SimulationTab,
  useSimKeys,
  type SimProps,
  type SimState,
} from "./SimulationTab";
import { InvestigationControls } from "./InvestigationControls";

/** Data-first workspace uses the very same scenario/compare/evidence components as the 3D drawer. */
export function Non3dFarmWorkspace({
  sim,
  onBack,
}: {
  sim: SimProps;
  onBack(): void;
}) {
  const [state, setState] = useState<SimState>(() => {
    return fallbackPanelState(
      typeof window === "undefined" ? "" : window.location.hash,
      sim.farm.id,
    );
  });
  const hidden = useAppStore((s) => s.panelsHidden);
  useSimKeys(state, setState, true);
  return (
    <section
      className="fv-root"
      data-testid="non3d-workspace"
      style={{ pointerEvents: "auto" }}
    >
      <style>
        {FV_CSS +
          `.fv-root[data-testid="non3d-workspace"]{pointer-events:auto}.fv-root[data-testid="non3d-workspace"] *{max-width:100%;}.fv-root[data-testid="non3d-workspace"] .fv-seg{height:auto;min-height:36px;white-space:normal}.fv-root[data-testid="non3d-workspace"] select{max-width:100%}.fv-root[data-testid="non3d-workspace"] .fv-auto{pointer-events:auto}`}
      </style>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 rounded border border-line px-3 py-2"
      >
        ← Choose another farm
      </button>
      <h2 className="mb-2 font-display text-2xl">{sim.farm.name}</h2>
      <p className="mb-4 text-sm">
        Non-3D workspace · Scenarios and relative comparisons.
        No live farm measurements.
      </p>
      {hidden ? (
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={() => useAppStore.setState({ panelsHidden: false })}
        >
          Show panels
        </button>
      ) : (
        <button type="button" className="mb-3 rounded border px-4 py-2" onClick={() => useAppStore.setState({ panelsHidden: true })}>Hide panels</button>
      )}
      <div hidden={hidden}>
        <SimulationTab props={sim} sim={state} setSim={setState} embedded />
      </div>
      <div className="mt-4">
        <InvestigationControls />
      </div>
    </section>
  );
}
