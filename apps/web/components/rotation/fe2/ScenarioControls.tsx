"use client";
import { RAIN_RANGE, SCENARIO_LABEL, setScenarioPreset, setScenarioValues, TEMP_RANGE, useRotationStore } from "@/lib/rotation/store";
import { SCENARIO_PRESETS, type ScenarioPreset } from "@/lib/rotation/draft-types";

export const PRESET_LABEL: Record<ScenarioPreset, string> = {
  baseline: "Baseline",
  wetter_winters: "Wetter winters",
  drier_summers: "Drier, warmer summers",
  both: "Both (wetter winters, drier summers)",
};

const btn = "rounded-md border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";

/** Hook-free so tests can call it and press the buttons. */
export function PresetButtons({ value, onPick }: { value: ScenarioPreset; onPick(p: ScenarioPreset): void }) {
  return (
    <div role="group" aria-label="Scenario presets" className="flex flex-wrap gap-2">
      {SCENARIO_PRESETS.map((p) => (
        <button key={p} type="button" aria-pressed={value === p} onClick={() => onPick(p)} className={`${btn} ${value === p ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink hover:bg-surface-2"}`}>
          {PRESET_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function Slider({ id, label, unit, value, range, onChange }: { id: string; label: string; unit: string; value: number; range: { min: number; max: number; step: number }; onChange(v: number): void }) {
  return (
    <div className="grid gap-1 rounded-md border border-line p-2">
      <label className="flex justify-between text-xs font-medium" htmlFor={id}>
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {value > 0 ? "+" : ""}
          {value} {unit}
        </span>
      </label>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-accent" aria-valuetext={`${value} ${unit}`} />
    </div>
  );
}

/** F2-1. Writes only useRotationStore.rotScenario; Frontend 1 reads the same state. */
export function ScenarioControls() {
  const s = useRotationStore((st) => st.rotScenario);
  return (
    <section aria-labelledby="fe2-scenario" className="grid gap-3">
      <h4 id="fe2-scenario" className="font-semibold text-ink">
        Climate scenario
      </h4>
      <p className="text-xs font-medium text-ink-muted">{SCENARIO_LABEL}</p>
      <PresetButtons value={s.preset} onPick={setScenarioPreset} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Slider id="fe2-rain" label="Rain change" unit="%" value={s.rain_scale_pct} range={RAIN_RANGE} onChange={(v) => setScenarioValues({ rain_scale_pct: v })} />
        <Slider id="fe2-temp" label="Temperature change" unit="°C" value={s.temp_offset_c} range={TEMP_RANGE} onChange={(v) => setScenarioValues({ temp_offset_c: v })} />
      </div>
    </section>
  );
}
