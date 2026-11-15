"use client";
// Compare mode, right inspector: Fe1Panel owns the ranking (weights, scores, why). The on-map A/B split and the
// cover calendar are in CompareTray.
import { Fe1Panel } from "@/components/rotation/fe1/Fe1Panel";

export function ComparePanel() {
  return (
    <div className="grid gap-3 text-sm">
      <Fe1Panel />
    </div>
  );
}
