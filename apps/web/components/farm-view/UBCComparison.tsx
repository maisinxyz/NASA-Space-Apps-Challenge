"use client";
import React, { useState, useEffect, useCallback } from "react";
import type { AnalyzedRotation, RotationAnalysis } from "@/lib/rotation/draft-types";
import type { EvidenceCard } from "@/lib/api/types";
import { apiBase } from "@/lib/api/client";

// ---------------------------------------------------------------- styles
const STYLES = `
.ubc-wrap { font-family: inherit; color: #f2ebdd; }
.ubc-toggle-row { display:flex; align-items:center; gap:8px; margin-bottom:16px; font-size:14px; color:#c9bfae; cursor:pointer; }
.ubc-toggle-row input[type=checkbox] { width:16px; height:16px; accent-color:#7ecf7e; cursor:pointer; }
.ubc-status { color:#c9bfae; font-size:14px; padding:12px 0; }
.ubc-retry { margin-left:12px; padding:4px 10px; border-radius:6px; border:1px solid rgba(242,235,221,0.3); background:transparent; color:#f2ebdd; cursor:pointer; font-size:13px; }
.ubc-retry:hover { background:rgba(242,235,221,0.08); }
.ubc-section-label { font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#7ecf7e; margin:0 0 10px 0; }
.ubc-baseline-wrap { margin-bottom:16px; }
.ubc-alts-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:12px; margin-bottom:16px; }
.ubc-card { background:rgba(16,20,18,0.86); border-radius:12px; padding:16px; border:1px solid rgba(242,235,221,0.12); }
.ubc-card-title { font-size:15px; font-weight:600; color:#f2ebdd; margin:0 0 12px 0; }
.ubc-label { color:#c9bfae; font-size:12px; margin:0 0 2px 0; }
.ubc-value { color:#f2ebdd; font-size:14px; font-weight:500; margin:0 0 10px 0; }
.ubc-details { margin-top:12px; }
.ubc-details summary { font-size:12px; color:#7ecf7e; cursor:pointer; user-select:none; }
.ubc-details-body { margin-top:8px; }
.ubc-details-row { margin-bottom:8px; }
.ubc-provenance { font-size:11px; color:#7a7069; border-top:1px solid rgba(242,235,221,0.08); padding-top:10px; margin-top:4px; line-height:1.5; }
`;

// ---------------------------------------------------------------- helpers
function rotationName(r: AnalyzedRotation): string {
  if (r.name) return r.name;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const slot of r.sequence) {
    if (!seen.has(slot.crop_id)) { seen.add(slot.crop_id); ids.push(slot.crop_id); }
  }
  return ids.join(" → ");
}

function scorecardVal(r: AnalyzedRotation, criterion: string): { display: string; score: string } {
  const entry = r.scorecard.find((s) => s.criterion === criterion);
  if (!entry) return { display: "Unavailable", score: "Unavailable" };
  const inp = entry.inputs?.[0];
  const display = inp != null ? `${inp.value} ${inp.unit}`.trim() : "Unavailable";
  return { display, score: String(entry.score) };
}

// ---------------------------------------------------------------- card
function RotationCard({ rotation }: { rotation: AnalyzedRotation }) {
  const erosion = scorecardVal(rotation, "erosion_risk");
  const water = scorecardVal(rotation, "water_use");
  const ec: EvidenceCard = rotation.evidence_card;

  return (
    <div className="ubc-card">
      <p className="ubc-card-title">{rotationName(rotation)}</p>

      <p className="ubc-label">Bare-soil days</p>
      <p className="ubc-value">{erosion.display}</p>

      <p className="ubc-label">Seasonal water shortfall</p>
      <p className="ubc-value">{water.display}</p>

      <p className="ubc-label">Relative erosion score (0–100)</p>
      <p className="ubc-value">{erosion.score}</p>

      <details className="ubc-details">
        <summary>Why this option</summary>
        <div className="ubc-details-body">
          {ec.why_suggested && (
            <div className="ubc-details-row">
              <p className="ubc-label">Rationale</p>
              <p className="ubc-value" style={{ fontSize: 13 }}>{ec.why_suggested}</p>
            </div>
          )}
          {ec.benefits?.[0] && (
            <div className="ubc-details-row">
              <p className="ubc-label">Benefit</p>
              <p className="ubc-value" style={{ fontSize: 13 }}>{ec.benefits[0]}</p>
            </div>
          )}
          {ec.risks_for_local_review?.[0] && (
            <div className="ubc-details-row">
              <p className="ubc-label">Trade-off</p>
              <p className="ubc-value" style={{ fontSize: 13 }}>{ec.risks_for_local_review[0]}</p>
            </div>
          )}
          {ec.support_not_replace && (
            <div className="ubc-details-row">
              <p className="ubc-label">Local check</p>
              <p className="ubc-value" style={{ fontSize: 13 }}>{ec.support_not_replace}</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- pure view (also used in tests)
export function UBCComparisonView({
  analysis,
  lowWater,
  onToggle,
}: {
  analysis: RotationAnalysis;
  lowWater: boolean;
  onToggle: () => void;
}) {
  const baseline = analysis.rotations.find((r) => r.is_existing) ?? analysis.rotations[0];
  const alts = analysis.rotations.filter((r) => r !== baseline).slice(0, 2);

  return (
    <div className="ubc-wrap">
      <style>{STYLES}</style>
      <label className="ubc-toggle-row">
        <input
          type="checkbox"
          checked={lowWater}
          onChange={onToggle}
          aria-label="Limited irrigation water"
        />
        Limited irrigation water
      </label>

      {baseline && (
        <div className="ubc-baseline-wrap">
          <p className="ubc-section-label">Current rotation (baseline)</p>
          <RotationCard rotation={baseline} />
        </div>
      )}

      {alts.length > 0 && (
        <>
          <p className="ubc-section-label">Alternatives</p>
          <div className="ubc-alts-grid">
            {alts.map((r) => (
              <RotationCard key={r.rotation_id} rotation={r} />
            ))}
          </div>
        </>
      )}

      <p className="ubc-provenance">
        Modelled rotation comparison · NASA POWER daily weather 1991–2024, 0.5° × 0.625° · SoilGrids
        soil estimates at 250 m · Synthetic label: illustrative, not measured at this farm
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- main component
export function UBCComparison() {
  const [lowWater, setLowWater] = useState(false);
  const [analysis, setAnalysis] = useState<RotationAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = lowWater ? { constraints: { low_water: true } } : {};
      const res = await fetch(`${apiBase}/sites/site_ubc_farm/rotation-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = (await res.json()) as RotationAnalysis;
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [lowWater, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleToggle = () => {
    setLowWater((v) => !v);
  };

  if (loading) {
    return (
      <div className="ubc-wrap">
        <style>{STYLES}</style>
        <p className="ubc-status">Loading rotation comparison…</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="ubc-wrap">
        <style>{STYLES}</style>
        <p className="ubc-status">
          {error ?? "No data returned."}
          <button className="ubc-retry" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <UBCComparisonView
      analysis={analysis}
      lowWater={lowWater}
      onToggle={handleToggle}
    />
  );
}

export default UBCComparison;
