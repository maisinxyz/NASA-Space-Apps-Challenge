"use client";
// F1-1: which criteria matter, how much (0-5), or a preset. Weight edits clear the preset.
import { CRITERIA, type Criterion, type WeightPreset, WEIGHT_PRESETS } from "@/lib/rotation/draft-types";
import { updateFarmerRequest, useRotationStore } from "@/lib/rotation/store";
import { PRIORITIES_NOTE } from "@/lib/twin/rotations";

import { CRITERION_LABELS, PRESET_LABELS, PRESET_WEIGHTS } from "./presets";

const clamp = (v: number) => Math.min(5, Math.max(0, Math.round(v) || 0));

export function PrioritiesForm({ allZero }: { allZero: boolean }) {
  const { criteria_selected, weights, weight_preset } = useRotationStore((s) => s.farmerRequest);
  const setWeight = (c: Criterion, v: number) => updateFarmerRequest({ weights: { ...weights, [c]: clamp(v) }, weight_preset: null });
  const toggle = (c: Criterion, on: boolean) => updateFarmerRequest({ criteria_selected: CRITERIA.filter((x) => (x === c ? on : criteria_selected.includes(x))), weight_preset: null });
  const pick = (p: WeightPreset | "") =>
    updateFarmerRequest(p ? { weight_preset: p, weights: { ...PRESET_WEIGHTS[p] }, criteria_selected: [...CRITERIA] } : { weight_preset: null });

  return (
    <fieldset className="grid gap-1.5 rounded-md border border-white/10 p-2">
      <legend className="px-1 text-xs font-semibold">
        What matters most to you? <span className="font-normal text-ink-muted">(0 = not important, 5 = very)</span>
      </legend>
      <label className="flex flex-wrap items-center gap-2 text-xs">
        Start from a preset
        <select value={weight_preset ?? ""} onChange={(e) => pick(e.target.value as WeightPreset | "")} className="min-h-8 rounded border border-white/15 bg-transparent px-1.5 text-xs">
          <option value="">Custom</option>
          {WEIGHT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      {CRITERIA.map((c) => {
        const on = criteria_selected.includes(c);
        return (
          <div key={c} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 text-xs sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={on} onChange={(e) => toggle(c, e.target.checked)} className="size-4 accent-accent" />
              {CRITERION_LABELS[c]}
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={weights[c]}
              disabled={!on}
              onChange={(e) => setWeight(c, Number(e.target.value))}
              aria-label={`${CRITERION_LABELS[c]} weight, 0 to 5`}
              className="order-3 col-span-2 w-full min-w-0 accent-accent sm:order-none sm:col-span-1"
            />
            <input
              type="number"
              min={0}
              max={5}
              value={weights[c]}
              disabled={!on}
              onChange={(e) => setWeight(c, Number(e.target.value))}
              aria-label={`${CRITERION_LABELS[c]} weight number`}
              className="h-7 w-10 rounded border border-white/15 bg-transparent text-center tabular-nums disabled:opacity-40"
            />
          </div>
        );
      })}
      {allZero && (
        <p role="alert" className="text-xs text-danger">
          Every weight is 0, so there is nothing to rank by. Raise at least one weight above 0 and tick its box.
        </p>
      )}
      <p className="text-[0.7rem] leading-snug text-ink-muted">{PRIORITIES_NOTE}</p>
    </fieldset>
  );
}
