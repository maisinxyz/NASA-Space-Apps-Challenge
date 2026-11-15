"use client";
// Simulation → Scenarios: live conditions for a weather event on the BC what-if farms (storm rain, soil saturation,
// per-field impact). Numbers come from lib/farm-future/events.ts (preset, illustrative), following the scenario clock.
import { eventStats, isEventId } from "@/lib/farm-future/events";
import { rampColour } from "@/lib/farm-future/fieldColours";
import { color } from "@/lib/farm-view/tokens";
import { useAppStore } from "@/lib/store";
import { resolveInputs } from "@/lib/twin/scenarios/clock";
import { scenarioById } from "@/lib/twin/scenarios/registry";
import { runSourceFor } from "@/lib/twin/scenarios/runSource";
import { farmById } from "@/lib/farms";

export function EventReadout({ farmId }: { farmId: string }) {
  const id = useAppStore((s) => s.scenarioId);
  const progress = useAppStore((s) => s.scenarioProgress);
  const stored = useAppStore((s) => s.scenarioInputs);
  const def = scenarioById(id);
  if (!def || !isEventId(def.id) || runSourceFor(farmById(farmId)) === "none") return null;
  const r = eventStats(farmId, def.id, progress, resolveInputs(def, stored[def.id]));
  return (
    <div data-testid="event-readout" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, margin: 0, color: color.inkSecondary, textTransform: "uppercase", letterSpacing: ".04em" }}>Conditions now</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
        {r.stats.map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 11, color: color.inkSecondary }}>{s.label}</span>
            <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{s.value}{s.unit && <span style={{ color: color.inkSecondary }}> {s.unit}</span>}</span>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 12, fontWeight: 600, margin: "4px 0 0", color: color.inkSecondary, textTransform: "uppercase", letterSpacing: ".04em" }}>Fields</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {r.fields.map((f) => (
          <div key={f.fieldId} style={{ display: "grid", gridTemplateColumns: "1fr 70px 120px", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: color.inkSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            <span style={{ height: 5, borderRadius: 3, background: "rgba(242,235,221,0.15)", position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", inset: 0, width: `${Math.round(f.level * 100)}%`, background: rampColour(f.level) }} />
            </span>
            <span style={{ textAlign: "right" }}>{f.text}</span>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 11, color: color.inkSecondary }}>Illustrative what-if: preset event with assumed inputs, not a forecast.</span>
    </div>
  );
}
