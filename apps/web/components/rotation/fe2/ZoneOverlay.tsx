"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";

import type { GroundOverlay } from "@/components/globe/types";
import { getZones } from "@/lib/rotation/api";
import { buildZoneOverlay, ZONE_RAMP } from "@/lib/twin/scenarios/ground/zones";

const useZoneToggle = create<{ on: boolean }>(() => ({ on: false }));

/** Overlays for the twin's `overlays` prop. [] while off, loading, failed, or when the site has no zones. */
export function useZoneOverlays(siteId: string | null): GroundOverlay[] {
  const on = useZoneToggle((s) => s.on);
  const [ov, setOv] = useState<{ siteId: string; overlay: GroundOverlay | null } | null>(null);
  useEffect(() => {
    if (!on || !siteId) return;
    let live = true;
    getZones(siteId).then(
      (z) => live && setOv({ siteId, overlay: buildZoneOverlay(z.zones) }),
      () => live && setOv({ siteId, overlay: null }), // zones are a stretch endpoint: absence is normal
    );
    return () => {
      live = false;
    };
  }, [on, siteId]);
  return on && ov?.siteId === siteId && ov.overlay ? [ov.overlay] : [];
}

const rgb = (c: number[]) => `rgb(${c.join(",")})`;

/** Default-off toggle, honesty label and legend. Render only where a twin is on screen. */
export function ZoneToggle() {
  const on = useZoneToggle((s) => s.on);
  return (
    <div className="max-w-60 rounded-md border border-white/15 bg-black/60 p-2 text-xs text-white backdrop-blur">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={on} onChange={(e) => useZoneToggle.setState({ on: e.target.checked })} className="accent-accent" />
        Vulnerability zones
      </label>
      <p className="mt-1 text-white/70">derived from terrain and soil data, not field-measured</p>
      {on && (
        <div className="mt-1">
          <div className="h-2 rounded" style={{ background: `linear-gradient(to right, ${rgb(ZONE_RAMP.low)}, ${rgb(ZONE_RAMP.high)})` }} aria-hidden />
          <div className="flex justify-between text-white/70">
            <span>lower</span>
            <span>higher terrain factor (relative)</span>
          </div>
        </div>
      )}
    </div>
  );
}
