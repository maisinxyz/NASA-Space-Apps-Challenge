"use client";
// DEV ONLY (not linked from the product). The same twin screen as the homepage, on the Cornell farm, with a
// "Fixture run source" switch that lets scenario effects render from the current inputs. This is the only way
// effects show until the backend delivers runs. Sky effects (lib/twin/scenarios/atmosphere) and ground layers
// (lib/twin/scenarios/ground) are developed and checked here.
import { useEffect, useState } from "react";

import { GlobeHome } from "@/components/globe/GlobeHome";
import { twinConfig } from "@/lib/farms";
import { useAppStore } from "@/lib/store";
import type { RunSource } from "@/lib/twin/scenarios/runSource";

const FARM = "cornell-ruminant";

export default function DevScenarios() {
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<RunSource>("none");

  useEffect(() => {
    if (!twinConfig(FARM)) return;
    useAppStore.setState({ farmId: FARM, globeView: "farm", twinMode: "simulate", leftOpen: true, rightOpen: true });
    setReady(true);
  }, []);

  return (
    <>
      {ready && <GlobeHome runSource={source} />}
      <div role="note" className="fixed right-0 bottom-0 left-0 z-50 flex h-8 items-center justify-center gap-4 border-t border-amber-300 bg-[#2a2210] px-3 text-xs text-amber-100">
        <strong>DEV FIXTURE: synthetic inputs, not real data, never shown in the product.</strong>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={source === "fixture"} onChange={(e) => setSource(e.target.checked ? "fixture" : "none")} className="accent-amber-300" />
          Fixture run source
        </label>
      </div>
    </>
  );
}
