"use client";
// Which terrain the viewer pages show, and the data every one of them needs for it.
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { type FieldFeature, loadMockFields } from "@/components/viewer/meta";
import { getInsights, getLayers, getSite, getSites, getTerrain } from "@/lib/api/client";
import type { Insight, LayerCatalog, Site, TerrainPackage } from "@/lib/api/types";

import { useAppStore } from "./store";

/** `?terrain=` / `?site=` win, then the store, then the first site from getSites(). Writes the result to the store. */
export function useTerrainId(): { terrainId: string | null; error: unknown; retry(): void } {
  const params = useSearchParams();
  const pTerrain = params.get("terrain");
  const pSite = params.get("site");
  const terrainId = useAppStore((s) => s.terrainId);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  // terrainId is a dependency so that Reset (store back to null) resolves again.
  useEffect(() => {
    setError(null);
    if (pTerrain) {
      if (terrainId !== pTerrain) useAppStore.setState({ terrainId: pTerrain, siteId: pSite });
      return;
    }
    if (pSite) {
      getSite(pSite).then((s) => useAppStore.setState({ siteId: s.id, terrainId: s.terrain_id }), setError);
      return;
    }
    if (terrainId) return;
    getSites().then((sites) => {
      if (sites[0]) useAppStore.setState({ siteId: sites[0].id, terrainId: sites[0].terrain_id });
      else setError(new Error("No sites are available yet. Run a Land Scan to create a terrain."));
    }, setError);
  }, [pTerrain, pSite, terrainId, attempt]);

  return { terrainId, error, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

export interface SiteData {
  terrain: TerrainPackage;
  catalog: LayerCatalog;
  /** Contract request R1 mock; [] unless NEXT_PUBLIC_MOCK_EXTRAS=1. */
  fields: FieldFeature[];
  /** Terrain insights, or the error that stopped them (the page still works without them). */
  insights: Insight[] | { error: unknown };
  site: Site | null;
}

type Load = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; data: SiteData };

export function useSiteData(terrainId: string | null): Load & { retry(): void } {
  const siteId = useAppStore((s) => s.siteId);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Reset sets terrainId/siteId to null and then back to the same values: do not reload (and re-mount the viewer) for that.
  const loadedKey = useRef("");
  useEffect(() => {
    const key = `${terrainId}|${siteId}|${attempt}`;
    if (!terrainId || key === loadedKey.current) return;
    loadedKey.current = key;
    let cancelled = false;
    let finished = false;
    setState({ kind: "loading" });
    Promise.all([getTerrain(terrainId), getLayers(terrainId)])
      .then(async ([terrain, catalog]) => {
        const sid = terrain.site_id ?? siteId;
        const [fields, insights, site] = await Promise.all([
          loadMockFields(terrain).catch(() => []),
          getInsights(terrainId).catch((error: unknown) => ({ error })),
          sid ? getSite(sid).catch(() => null) : null,
        ]);
        finished = true;
        if (!cancelled) setState({ kind: "ok", data: { terrain, catalog, fields, insights, site } });
      })
      .catch((error: unknown) => {
        finished = true;
        if (!cancelled) setState({ kind: "error", error });
      });
    return () => {
      cancelled = true;
      if (!finished) loadedKey.current = "";
    };
  }, [terrainId, siteId, attempt]);

  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
