"use client";
// <TwinViewer /> loaded client-only, with the labels that must sit next to it (exaggeration, coarse imagery)
// and the global Reset hook (replay terraform). Pages pass the rest of the §4.2 props.
import { useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { DEFAULT_EXAGGERATION, isCoarseImagery, type TwinViewerHandle, type TwinViewerProps } from "@/components/viewer/meta";
import { RESET_EVENT } from "@/lib/keys";
import { useAppStore } from "@/lib/store";

const TwinViewer = dynamic(() => import("@/components/viewer").then((m) => m.TwinViewer), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-ink-muted">Loading the 3D view…</p>,
});

/** Height for viewer pages: the viewport minus the sticky header and banner. */
export const VIEWPORT_H = "lg:h-[calc(100dvh-5.5rem)] lg:min-h-[34rem]";

type Props = Omit<TwinViewerProps, "quality" | "reducedMotion" | "divider" | "onReady" | "onTerraformDone" | "onError" | "className"> & {
  viewerRef?: React.RefObject<TwinViewerHandle | null>;
};

export function ViewerStage({ viewerRef, ...props }: Props) {
  const quality = useAppStore((s) => s.quality);
  const divider = useAppStore((s) => s.divider);
  const reducedMotion = !!useReducedMotion();
  const own = useRef<TwinViewerHandle>(null);
  const ref = viewerRef ?? own;
  const [status, setStatus] = useState("Loading the 3D view.");

  useEffect(() => {
    const replay = () => ref.current?.replay();
    window.addEventListener(RESET_EVENT, replay);
    return () => window.removeEventListener(RESET_EVENT, replay);
  }, [ref]);

  return (
    <div className="relative h-full w-full">
      <TwinViewer
        ref={ref}
        {...props}
        className="h-full w-full"
        quality={quality}
        divider={divider}
        reducedMotion={reducedMotion}
        onReady={() => setStatus("3D view ready.")}
        onTerraformDone={() => setStatus("Terrain loaded.")}
        onError={(e) => setStatus(`3D view problem: ${e.message}`)}
      />
      <div className="pointer-events-none absolute top-2 left-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">Height x{DEFAULT_EXAGGERATION} exaggerated</span>
        {isCoarseImagery(props.terrain) && <Badge variant="coarse" />}
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
