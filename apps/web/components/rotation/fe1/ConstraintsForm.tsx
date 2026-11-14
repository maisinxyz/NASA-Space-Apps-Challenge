"use client";
// F1-2: constraint toggles and the allowed-crops picker (empty = all crops allowed).
import type { FarmerConstraints } from "@/lib/rotation/draft-types";
import { updateFarmerRequest, useRotationStore } from "@/lib/rotation/store";

const TOGGLES: [keyof FarmerConstraints, string][] = [
  ["low_water", "I have little water"],
  ["no_specialty_equipment", "I have no specialty equipment"],
  ["no_local_market", "I have no local market for special crops"],
];

export function ConstraintsForm({ cropNames }: { cropNames: Record<string, string> }) {
  const { constraints, allowed_crops } = useRotationStore((s) => s.farmerRequest);
  const ids = Object.keys(cropNames);
  const flip = (id: string, on: boolean) => updateFarmerRequest({ allowed_crops: on ? [...allowed_crops, id] : allowed_crops.filter((x) => x !== id) });
  return (
    <fieldset className="grid gap-1.5 rounded-md border border-white/10 p-2 text-xs">
      <legend className="px-1 font-semibold">Your limits</legend>
      {TOGGLES.map(([k, label]) => (
        <label key={k} className="flex items-center gap-1.5">
          <input type="checkbox" checked={constraints[k]} onChange={(e) => updateFarmerRequest({ constraints: { ...constraints, [k]: e.target.checked } })} className="size-4 accent-accent" />
          {label}
        </label>
      ))}
      <details>
        <summary className="cursor-pointer font-medium">
          Crops I can grow <span className="font-normal text-ink-muted">({allowed_crops.length ? `${allowed_crops.length} chosen` : "all allowed"})</span>
        </summary>
        <div className="mt-1 grid grid-cols-1 gap-1 min-[420px]:grid-cols-2">
          {ids.map((id) => (
            <label key={id} className="flex items-center gap-1.5">
              <input type="checkbox" checked={allowed_crops.includes(id)} onChange={(e) => flip(id, e.target.checked)} className="size-4 accent-accent" />
              {cropNames[id]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[0.7rem] text-ink-muted">Leave all unticked to allow every crop.</p>
      </details>
    </fieldset>
  );
}
