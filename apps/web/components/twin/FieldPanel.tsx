"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { MetricValue } from "@/components/ui/MetricValue";
import { type FieldFeature, mockExtrasEnabled, type TwinViewerHandle } from "@/components/viewer/meta";
import { fetchAsset } from "@/lib/api/client";
import type { LayerCatalog, TerrainPackage } from "@/lib/api/types";
import { decodeGray8, type Raster8 } from "@/lib/decode/layer";
import { meanInPolygon } from "@/lib/fieldStats";
import { useAppStore } from "@/lib/store";

/**
 * Field list (keyboard access: polygons in the canvas cannot be focused) and the selected field's details.
 * Fields are contract request R1, mock only: always "Illustrative (synthetic)".
 */
export function FieldPanel({ terrain, catalog, fields, viewerRef }: { terrain: TerrainPackage; catalog: LayerCatalog; fields: FieldFeature[]; viewerRef: React.RefObject<TwinViewerHandle | null> }) {
  const selectedId = useAppStore((s) => s.selectedFieldId);
  const selected = fields.find((f) => f.properties.id === selectedId) ?? null;
  const slopeLegend = catalog.layers.find((l) => l.name === "slope");
  const [slope, setSlope] = useState<Raster8 | null>(null);

  useEffect(() => {
    setSlope(null);
    if (!fields.length) return;
    let cancelled = false;
    fetchAsset(terrain.assets.layers.slope)
      .then((buf) => !cancelled && setSlope(decodeGray8(buf)))
      .catch(() => {}); // mean slope is then omitted with a note
    return () => {
      cancelled = true;
    };
  }, [terrain, fields.length]);

  const meanSlope = useMemo(
    () => (selected && slope && slopeLegend ? meanInPolygon(slope, terrain.bbox_wgs84, selected.geometry.coordinates[0], slopeLegend.value_range) : null),
    [selected, slope, slopeLegend, terrain.bbox_wgs84],
  );

  return (
    <section aria-labelledby="fields-h">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="fields-h" className="text-sm font-semibold text-ink">
          Fields
        </h2>
        {fields.length > 0 && <Badge variant="illustrative" />}
        {fields.length > 0 && mockExtrasEnabled && <Badge variant="mock" />}
      </div>
      {fields.length === 0 ? (
        <p className="mt-1 text-sm text-ink-muted">No field boundaries for this terrain yet. Field data is not part of the data contract; the layers and storm replay still cover the whole area.</p>
      ) : (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {fields.map((f) => {
              const on = f.properties.id === selectedId;
              return (
                <li key={f.properties.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => useAppStore.setState({ selectedFieldId: on ? null : f.properties.id })}
                    className={`rounded-md border px-2 py-1 text-sm ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface-2 text-ink hover:border-ink-muted"}`}
                  >
                    {on && <span aria-hidden>✓ </span>}
                    {f.properties.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.properties.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-3 grid gap-1 rounded-md border border-line bg-surface-2 p-3 text-sm">
                <p className="font-medium text-ink">{selected.properties.name}</p>
                <MetricValue label="Area" value={selected.properties.area_ha} unit="ha" basis={selected.properties.data_status === "derived" ? "derived" : "assumed"} digits={2} />
                <p className="text-ink">
                  <span className="text-ink-muted">Illustrative crop</span> {selected.properties.illustrative_crop}
                </p>
                {meanSlope && slopeLegend ? (
                  <>
                    <MetricValue label="Mean slope" value={meanSlope.mean} unit={slopeLegend.unit} basis="derived" digits={1} />
                    <p className="text-xs text-ink-muted">Averaged from the slope layer over {meanSlope.cells.toLocaleString("en-US")} grid cells inside this illustrative boundary (client-side, approximate).</p>
                  </>
                ) : (
                  <p className="text-xs text-ink-muted">Mean slope unavailable: the slope layer has not loaded or has no cells inside this boundary.</p>
                )}
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => viewerRef.current?.setCameraPreset("field")} className="rounded border border-line px-2 py-0.5 text-xs text-ink hover:bg-line">
                    Focus camera on field
                  </button>
                  <button type="button" onClick={() => viewerRef.current?.setCameraPreset("overview")} className="rounded border border-line px-2 py-0.5 text-xs text-ink hover:bg-line">
                    Overview
                  </button>
                </div>
              </motion.div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Choose a field above or click one on the map.</p>
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  );
}
