"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";

import type { GroundOverlay } from "@/components/globe/types";
import { BasisChip } from "@/components/ui/BasisChip";
import type { Zone } from "@/lib/rotation/draft-types";
import { getZones } from "@/lib/rotation/api";
import { GlossaryTerm } from "./Glossary";
import { buildZoneOverlay, ZONE_RAMP } from "@/lib/twin/scenarios/ground/zones";

const useZoneToggle = create<{ on: boolean }>(() => ({ on: false }));
/** Zones behind the current overlay, for the legend list. */
const useZoneList = create<{ zones: Zone[] }>(() => ({ zones: [] }));

/** Overlays for the twin's `overlays` prop. [] while off, loading, failed, or when the site has no zones. */
export function useZoneOverlays(siteId: string | null): GroundOverlay[] {
  const on = useZoneToggle((s) => s.on);
  const [ov, setOv] = useState<{ siteId: string; overlay: GroundOverlay | null } | null>(null);
  useEffect(() => {
    useZoneList.setState({ zones: [] });
    if (!on || !siteId) return;
    let live = true;
    getZones(siteId).then(
      (z) => {
        if (!live) return;
        setOv({ siteId, overlay: buildZoneOverlay(z.zones) });
        useZoneList.setState({ zones: z.zones });
      },
      () => live && setOv({ siteId, overlay: null }), // zones are a stretch endpoint: absence is normal
    );
    return () => {
      live = false;
    };
  }, [on, siteId]);
  return on && ov?.siteId === siteId && ov.overlay ? [ov.overlay] : [];
}

const rgb = (c: number[]) => `rgb(${c.join(",")})`;

const MAX_LISTED = 5;

/** Plain-language zone labels with area and relative terrain factor. */
export function ZoneList({ zones }: { zones: Zone[] }) {
  if (!zones.length) return null;
  return (
    <ul className="mt-1 grid gap-0.5">
      {zones.slice(0, MAX_LISTED).map((z) => (
        <li key={z.id} className="flex flex-wrap items-center gap-x-1.5">
          <span className="font-medium">{z.label ?? "Unlabelled zone"}</span>
          <span className="text-white/70">
            {z.area_ha} ha, <GlossaryTerm id="relative_score">relative</GlossaryTerm> terrain factor {z.terrain_factor}
          </span>
          <BasisChip basis={z.basis} />
        </li>
      ))}
      {zones.length > MAX_LISTED && <li className="text-white/70">+{zones.length - MAX_LISTED} more</li>}
    </ul>
  );
}

/** Default-off toggle, honesty label and legend. Render only where a twin is on screen. */
export function ZoneToggle() {
  const on = useZoneToggle((s) => s.on);
  const zones = useZoneList((s) => s.zones);
  return (
    <div className="max-w-72 rounded-md border border-white/15 bg-black/60 p-2 text-xs text-white backdrop-blur">
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
          <ZoneList zones={zones} />
        </div>
      )}
    </div>
  );
}

export const resetZoneToggle = () => useZoneToggle.setState({ on: false });
