"use client";
import type { CropLook } from "@/components/globe/types";
import { useAppStore } from "@/lib/store";
import { CROP_LABELS, MONTHS, rotationById } from "@/lib/twin/rotations";

/** UI swatch colours for the crop legend and cover calendars (the 3D look is drawn by Globe.tsx). */
export const CROP_COLOR: Record<CropLook, string> = {
  grass: "#4f9a3c",
  corn: "#c9b23a",
  cereal: "#b8a05a",
  legume: "#3f7f5e",
  cover: "#7fae4a",
  berry: "#7a3b5c",
  bare: "#3b2616",
};

export function CropSwatch({ crop }: { crop: CropLook }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-3 rounded-sm" style={{ background: CROP_COLOR[crop] }} />
      {CROP_LABELS[crop]}
    </span>
  );
}

const sel = "rounded border border-line bg-surface-2 px-2 py-0.5 text-sm";

/** Which rotation year and month the fields show. Only meaningful once a rotation is shown on the fields. */
export function SeasonPicker() {
  const rotation = rotationById(useAppStore((s) => s.twinRotationId) ?? "");
  const year = useAppStore((s) => s.twinYear);
  const month = useAppStore((s) => s.twinMonth);
  if (!rotation) return <p className="text-sm text-ink-muted">Choose “Show on fields” to see a rotation’s crops on the farm.</p>;
  const years = rotation.years.length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>
        Fields show <b>{rotation.name}</b> in
      </span>
      <label>
        <span className="sr-only">Rotation year</span>
        <select className={sel} value={year % years} onChange={(e) => useAppStore.setState({ twinYear: Number(e.target.value) })}>
          {Array.from({ length: years }, (_, i) => (
            <option key={i} value={i}>
              Year {i + 1}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Month</span>
        <select className={sel} value={month} onChange={(e) => useAppStore.setState({ twinMonth: Number(e.target.value) })}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="text-accent underline underline-offset-2" onClick={() => useAppStore.setState({ twinRotationId: null })}>
        Show current crops
      </button>
      <p className="basis-full text-xs text-ink-muted">Fields in rotation are staggered by a year or two, as on a real farm; grass and berry fields stay as they are.</p>
    </div>
  );
}
