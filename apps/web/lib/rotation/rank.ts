// Client-side re-ranking from the per-criterion scores the API returned (PRD §8.4 "Overall").
// Weights reorder rotations only; the scorecard objects are never modified. Not draft-specific: keep after v1.1.
import type { AnalyzedRotation, Criterion } from "./draft-types";

export type RankedRotation = AnalyzedRotation & { overall: number; rank: number };

/** Weights normalized to sum to 1 over the selected criteria. All zero (or none selected) returns null (INVALID_WEIGHTS). */
export function normalizeWeights(weights: Partial<Record<Criterion, number>>, selected: readonly Criterion[]): Partial<Record<Criterion, number>> | null {
  const total = selected.reduce((s, c) => s + Math.max(0, weights[c] ?? 0), 0);
  if (total <= 0) return null;
  return Object.fromEntries(selected.map((c) => [c, Math.max(0, weights[c] ?? 0) / total]));
}

/** overall = Σ w·score over selected criteria; rank 1 = best. Ties keep the API order (stable sort). */
export function rerank(rotations: readonly AnalyzedRotation[], weights: Partial<Record<Criterion, number>>, selected: readonly Criterion[]): RankedRotation[] | null {
  const w = normalizeWeights(weights, selected);
  if (!w) return null;
  const scored = rotations.map((r) => ({
    ...r,
    overall: Math.round(selected.reduce((s, c) => s + (w[c] ?? 0) * (r.scorecard.find((x) => x.criterion === c)?.score ?? 0), 0) * 10) / 10,
  }));
  const order = [...scored].sort((a, b) => b.overall - a.overall);
  return scored.map((r) => ({ ...r, rank: order.indexOf(r) + 1 }));
}
