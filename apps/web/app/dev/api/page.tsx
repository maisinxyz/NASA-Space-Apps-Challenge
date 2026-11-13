"use client";
// Throwaway dev page: proves the API client works in mock and live mode. Remove before the demo.
import { useEffect, useState } from "react";

import { apiBase, apiMode, ApiError, getSites, getTerrain, isMock } from "@/lib/api/client";
import type { Site, TerrainPackage } from "@/lib/api/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; sites: Site[]; terrain: TerrainPackage };

export default function DevApiPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const sites = await getSites();
        const terrain = await getTerrain(sites[0].terrain_id);
        setState({ kind: "ok", sites, terrain });
      } catch (e) {
        const message = e instanceof ApiError ? `${e.code}: ${e.message}${e.hint ? ` (${e.hint})` : ""}` : String(e);
        setState({ kind: "error", message });
      }
    })();
  }, []);

  return (
    <main className="p-6 font-mono text-sm">
      <h1 className="mb-2 text-lg font-bold">
        /dev/api{" "}
        {isMock && <span className="rounded bg-amber-300 px-2 py-0.5 text-xs font-bold text-black uppercase">mock</span>}
      </h1>
      <p className="mb-4">
        mode: <b>{apiMode}</b>
        {!isMock && <> · base: {apiBase}</>}
      </p>
      {state.kind === "loading" && <p>Loading…</p>}
      {state.kind === "error" && <p className="text-red-600">{state.message}</p>}
      {state.kind === "ok" && (
        <>
          <h2 className="mt-4 font-bold">getSites()</h2>
          <pre className="max-h-80 overflow-auto bg-black/5 p-3">{JSON.stringify(state.sites, null, 2)}</pre>
          <h2 className="mt-4 font-bold">getTerrain(&quot;{state.terrain.id}&quot;)</h2>
          <pre className="max-h-80 overflow-auto bg-black/5 p-3">{JSON.stringify(state.terrain, null, 2)}</pre>
        </>
      )}
    </main>
  );
}
