"use client";
// One small card per lens, top right under the condition pills. Numbers first, thin bars, a basis label on every
// figure. Absolute estimates carry a p10–p90 range (CLAUDE.md). No lens has real data yet, so each shows "No data".
import { useFutureStore } from "@/lib/farm-future/store";
import { layout } from "@/lib/farm-view/tokens";
import { lensLabel } from "./Controls";
import { CardHead, NoData, PopCard } from "./ui";


export function LensCard() {
  const lens = useFutureStore((s) => s.lens);
  const panel = useFutureStore((s) => s.panel);
  const openPanel = useFutureStore((s) => s.openPanel);
  return (
    <PopCard open={!!lens && panel === "lens"} label={lens ? lensLabel(lens) : "Lens"} testId="lens-card" style={{ right: layout.card.right, top: layout.card.top, width: 320 }}>
      {lens && <CardHead title={lensLabel(lens)} onMinimize={() => openPanel(null)} />}
      {lens && <NoData />}
    </PopCard>
  );
}

