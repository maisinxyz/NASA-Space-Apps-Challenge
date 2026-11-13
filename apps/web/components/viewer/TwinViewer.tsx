"use client";
// <TwinViewer />: loads assets, owns the fallback and quality tier, hosts the canvas. Public API: ./types.
import { Canvas } from "@react-three/fiber";
import { Component, forwardRef, type ReactNode, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { assetUrl } from "@/lib/api/client";
import { loadDiffTexture, loadRotationAssets, loadTerrainAssets, type RotationAssets, type TerrainAssets } from "./assets";
import Scene, { BASE_FOV, overviewPose } from "./Scene";
import { ResourceScope } from "./resources";
import { DEFAULT_EXAGGERATION, type TwinViewerHandle, type TwinViewerProps } from "./types";

class Boundary extends Component<{ onError(e: Error): void; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGL2(): boolean {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    // The capability probe must not consume a GPU context for the lifetime of the page.
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!context;
  } catch {
    return false;
  }
}

const TwinViewer = forwardRef<TwinViewerHandle, TwinViewerProps>(function TwinViewer(p, ref) {
  const { terrain, sim, quality, onError } = p;
  const exaggeration = p.exaggeration ?? DEFAULT_EXAGGERATION;
  const [webgl, setWebgl] = useState<"checking" | "ok" | "off" | "lost">("checking");
  const [failed, setFailed] = useState<string | null>(null);
  const [terrainState, setTerrainState] = useState<{ terrain: typeof terrain; attempt: number; data: TerrainAssets } | null>(null);
  const [rotationState, setRotationState] = useState<{ key: string; data: Record<string, RotationAssets> }>({ key: "", data: {} });
  const [diffState, setDiffState] = useState<{ key: string; data: Record<string, THREE.Texture> }>({ key: "", data: {} });
  const [autoLow, setAutoLow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tier: "low" | "high" = quality === "low" || (quality === "auto" && autoLow) ? "low" : "high";

  const assets = terrainState?.terrain === terrain && terrainState.attempt === attempt ? terrainState.data : null;
  const resourceKey = `${sim?.simId ?? ""}|${tier}|${webgl}|${attempt}|${failed ? "failed" : "active"}`;
  const diffs = diffState.key === resourceKey ? diffState.data : {};

  const api = useRef<TwinViewerHandle | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  useImperativeHandle(ref, () => ({
    replay: () => api.current?.replay(),
    skipTerraform: () => api.current?.skipTerraform(),
    setCameraPreset: (preset) => api.current?.setCameraPreset(preset),
  }));

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const fail = (e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    setFailed(err.message);
    onErrorRef.current(err);
  };

  useEffect(() => setWebgl(hasWebGL2() ? "ok" : "off"), [attempt]);
  useEffect(() => { setFailed(null); setAutoLow(false); }, [terrain]);

  useEffect(() => {
    if (webgl !== "ok" || failed) return;
    const scope = new ResourceScope();
    setTerrainState(null);
    scope.load("terrain", () => loadTerrainAssets(terrain))
      .then((a) => { if (a && scope.isActive) setTerrainState({ terrain, attempt, data: a }); })
      .catch((e) => { if (scope.isActive) fail(e); });
    return () => scope.dispose();
  }, [terrain, webgl, attempt, failed]);

  // Each context/retry/tier owns its cache, including requests still in flight on retirement.
  // Keep completed rotations in this scope so swapping A/B does not fetch them again.
  const scopeRef = useRef<ResourceScope | null>(null);
  useEffect(() => {
    const scope = new ResourceScope();
    scopeRef.current = scope;
    setRotationState({ key: resourceKey, data: {} });
    setDiffState({ key: resourceKey, data: {} });
    return () => {
      scopeRef.current = null;
      scope.dispose();
    };
  }, [resourceKey]);

  const [idA, idB] = p.rotationIds;
  const visibleRequest = useRef({ idA, idB, showDiff: p.showDiff });
  visibleRequest.current = { idA, idB, showDiff: p.showDiff };
  useEffect(() => {
    const scope = scopeRef.current;
    if (!sim || !scope || webgl !== "ok" || failed) return;
    for (const id of new Set([idA, idB])) {
      const result = id ? sim.results[id] : undefined;
      if (!id || !result) continue;
      scope.load(`rotation:${id}`, () => loadRotationAssets(result, tier === "low"))
        .then((r) => {
          if (r && scope.isActive) setRotationState((old) => old.key === resourceKey && old.data[id] === r ? old : { key: resourceKey, data: { ...(old.key === resourceKey ? old.data : {}), [id]: r } });
        })
        .catch((e) => {
          const current = visibleRequest.current;
          if (scope.isActive && (current.idA === id || current.idB === id)) fail(e);
        });
    }
  }, [sim, idA, idB, tier, webgl, attempt, resourceKey, failed]);

  const diffKey = sim && idA && idB ? `${idA}__${idB}` : null;
  useEffect(() => {
    const scope = scopeRef.current;
    if (!sim || !scope || !diffKey || !p.showDiff || webgl !== "ok" || failed) return;
    scope.load(`diff:${diffKey}`, () => loadDiffTexture(sim.simId, idA, idB as string))
      .then((t) => {
        if (t && scope.isActive) setDiffState((old) => old.key === resourceKey && old.data[diffKey] === t ? old : { key: resourceKey, data: { ...(old.key === resourceKey ? old.data : {}), [diffKey]: t } });
      })
      .catch((e) => {
        const current = visibleRequest.current;
        if (scope.isActive && current.showDiff && current.idA === idA && current.idB === idB) fail(e);
      });
  }, [sim, tier, diffKey, p.showDiff, idA, idB, webgl, attempt, resourceKey, failed]);

  const sides = useMemo(() => {
    const rotations = rotationState.key === resourceKey ? rotationState.data : {};
    return [rotations[idA], idB ? rotations[idB] : undefined];
  }, [rotationState, resourceKey, idA, idB]);
  const cameraPose = useMemo(() => (assets ? overviewPose(assets, exaggeration) : null), [assets, exaggeration]);

  const fallback = (title: string, detail: string) => (
    <div className={p.className} style={{ position: "relative", overflow: "hidden", background: "#2b2a26" }} role="region" aria-label={`Static terrain imagery for ${terrain.name}`}>
      {/* Static preview: the terrain's own imagery asset (no 3D). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={assetUrl(terrain.assets.texture)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, background: "rgba(20,20,18,0.88)", color: "#f4f1ea", padding: 20, borderRadius: 8, font: "14px/1.5 system-ui, sans-serif" }}>
          <strong style={{ display: "block", fontSize: 16, marginBottom: 6 }}>{title}</strong>
          <span>{detail}</span>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                setFailed(null);
                setWebgl("checking");
                setAttempt((n) => n + 1);
              }}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #f4f1ea", background: "transparent", color: "inherit", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (webgl === "off") return fallback("3D view is not available", "This browser or device has WebGL2 turned off. Showing the site imagery instead; the data panels still work.");
  if (webgl === "lost") return fallback("The 3D view stopped", "The graphics context was lost (the GPU was reset or ran out of memory). Showing the site imagery instead.");
  if (failed) return fallback("The 3D view could not load", failed);

  return (
    <div className={p.className} style={{ position: "relative", overflow: "hidden", background: "#d5e0e6" }}>
      {webgl === "ok" && assets && cameraPose && (
        <Boundary key={attempt} onError={fail} fallback={null}>
          <Canvas
            shadows
            dpr={tier === "high" ? [1, 2] : 1}
            gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
            camera={{ fov: BASE_FOV, near: 1, far: Math.max(assets.frame.sizeX, assets.frame.sizeZ) * 60, position: cameraPose.position.toArray() }}
            aria-label={`3D terrain of ${terrain.name}. Vertical scale exaggerated x${exaggeration}.`}
            role="img"
          >
            <Scene p={p} assets={assets} sides={sides} diff={diffKey ? diffs[diffKey] : undefined} tier={tier} exaggeration={exaggeration} api={api} pinEls={pinEls} onAutoLow={() => setAutoLow(true)} onContextLost={() => setWebgl("lost")} />
          </Canvas>
        </Boundary>
      )}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {(p.pins ?? []).map((pin) => (
          <button
            key={pin.id}
            type="button"
            ref={(el) => {
              if (el) pinEls.current.set(pin.id, el);
              else pinEls.current.delete(pin.id);
            }}
            onClick={() => p.onPinSelect?.(pin.id)}
            aria-label={pin.label}
            aria-pressed={!!pin.active}
            title={pin.label}
            className="ft-pin"
            data-active={pin.active ? "" : undefined}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              display: "none",
              pointerEvents: "auto",
              minWidth: 28,
              height: 28,
              padding: "0 6px",
              borderRadius: "14px 14px 14px 2px",
              border: pin.active ? "3px solid #ffd166" : "2px solid #ffffff",
              background: "#1f2a2e",
              color: "#ffffff",
              font: "700 13px/1 system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            {pin.text ?? "i"}
          </button>
        ))}
        {p.mode === "split" && <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(0.9, Math.max(0.1, p.divider ?? 0.5)) * 100}%`, width: 2, marginLeft: -1, background: "rgba(255,255,255,0.9)", boxShadow: "0 0 6px rgba(0,0,0,0.5)" }} />}
      </div>
    </div>
  );
});

export default TwinViewer;
