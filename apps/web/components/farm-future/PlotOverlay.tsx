"use client";
// Drawn farm plots as one north-up canvas over the twin's simulation square: colour fill, white border.
// Shown in every 3D mode (not only Future), so the 2D and 3D tabs outline the same plots in the same colours.
import { useEffect, useMemo, useRef, useState } from "react";

import type { GroundOverlay } from "@/components/globe/types";
import { twinConfig } from "@/lib/farms";
import { usePlots } from "@/lib/plots/store";
import { useAppStore } from "@/lib/store";

const SIZE = 1024;

export function usePlotOverlays(): GroundOverlay[] {
  const farmId = useAppStore((s) => s.farmId);
  const twin = twinConfig(farmId);
  const plots = usePlots(farmId);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);
  // ponytail: plots outside the simulation square are clipped; widen bbox if users draw far from the pin.
  const bbox = twin?.simBbox;
  useEffect(() => {
    if (!bbox || plots.length === 0) return;
    if (!canvas.current) canvas.current = Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE });
    const c = canvas.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const [w, s, e, n] = bbox;
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (const p of plots) {
      ctx.beginPath();
      p.ring.forEach(([lon, lat], i) => {
        const x = ((lon - w) / (e - w)) * SIZE;
        const y = ((n - lat) / (n - s)) * SIZE;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = p.colour;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
    setVersion((v) => v + 1);
  }, [bbox, plots]);
  return useMemo(
    () => (bbox && plots.length > 0 && canvas.current && version > 0 ? [{ id: "drawn-plots", bbox, canvas: canvas.current, version, opacity: 1 }] : []),
    [bbox, plots.length, version],
  );
}
