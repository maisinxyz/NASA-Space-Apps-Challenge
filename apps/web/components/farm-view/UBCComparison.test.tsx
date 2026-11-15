import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UBCComparisonView } from "./UBCComparison";
import type { RotationAnalysis, RotationAnalysisRequest } from "@/lib/rotation/draft-types";

const mockAnalysis: RotationAnalysis = {
  site_id: "site_ubc_farm",
  engine_version: "seeded-v1",
  data_mode: "live",
  limited_data: false,
  scenario: { preset: "baseline", rain_scale_pct: 100, temp_offset_c: 0, label: "Baseline" },
  rotations: [
    {
      rotation_id: "rot_base",
      name: "Maize – Soybean",
      is_existing: true,
      sequence: [
        { year_index: 0, season: "summer", crop_id: "maize" },
        { year_index: 1, season: "summer", crop_id: "soybean" },
      ],
      cover_calendar: { days_bare_per_year: 65, monthly_cover: [0.5, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 0.8, 0.5, 0.5, 0.5, 0.5] },
      overall: 70,
      rank: 1,
      rank_stability: null,
      exposure: {
        winter: { value: 0.2, p10: 0.1, p90: 0.3, basis: "modeled" },
        summer: { value: 0.2, p10: 0.1, p90: 0.3, basis: "modeled" },
      },
      scorecard: [
        {
          criterion: "erosion_risk",
          score: 72,
          unit: "days",
          basis: "modeled",
          confidence: "medium",
          needs_local_review: false,
          inputs: [{ name: "Bare soil days", value: 65, unit: "days", basis: "modeled" }],
        },
        {
          criterion: "water_use",
          score: 60,
          unit: "mm",
          basis: "modeled",
          confidence: "medium",
          needs_local_review: false,
          inputs: [{ name: "Seasonal water shortfall", value: 110, unit: "mm", basis: "modeled" }],
        },
      ],
      evidence_card: {
        rotation_id: "rot_base",
        evidence: [],
        information_gaps: [],
        why_suggested: "Historical baseline for regional grain systems.",
        benefits: ["Consistent summer cash crop income"],
        support_not_replace: "This tool supports, and does not replace, local agronomic expertise.",
        risks_for_local_review: ["Elevated fall bare soil window"],
      },
    },
    {
      rotation_id: "rot_alt1",
      name: "Spring Canola – Grain Sorghum w/ Rye",
      is_existing: false,
      sequence: [
        { year_index: 0, season: "summer", crop_id: "spring_canola" },
        { year_index: 1, season: "summer", crop_id: "grain_sorghum" },
      ],
      cover_calendar: { days_bare_per_year: 35, monthly_cover: [0.7, 0.7, 0.7, 0.7, 0.9, 0.9, 0.9, 0.9, 0.7, 0.7, 0.7, 0.7] },
      overall: 82,
      rank: 2,
      rank_stability: null,
      exposure: {
        winter: { value: 0.2, p10: 0.1, p90: 0.3, basis: "modeled" },
        summer: { value: 0.2, p10: 0.1, p90: 0.3, basis: "modeled" },
      },
      scorecard: [
        {
          criterion: "erosion_risk",
          score: 85,
          unit: "days",
          basis: "modeled",
          confidence: "medium",
          needs_local_review: false,
          inputs: [{ name: "Bare soil days", value: 35, unit: "days", basis: "modeled" }],
        },
        {
          criterion: "water_use",
          score: 80,
          unit: "mm",
          basis: "modeled",
          confidence: "medium",
          needs_local_review: false,
          inputs: [{ name: "Seasonal water shortfall", value: 45, unit: "mm", basis: "modeled" }],
        },
      ],
      evidence_card: {
        rotation_id: "rot_alt1",
        evidence: [],
        information_gaps: [],
        why_suggested: "Reduced water demand and continuous winter cover.",
        benefits: ["40% less irrigation required"],
        support_not_replace: "This tool supports, and does not replace, local agronomic expertise.",
        risks_for_local_review: ["Requires adapted harvesting equipment"],
      },
    },
  ],
  weights_applied: {},
  warnings: [],
  request_echo: {} as unknown as RotationAnalysisRequest,
  disclaimer: "Supports and does not replace local agronomic expertise.",
};

describe("UBCComparisonView", () => {
  it("renders baseline card first and alternative cards", () => {
    const html = renderToStaticMarkup(
      <UBCComparisonView analysis={mockAnalysis} lowWater={false} onToggle={() => {}} />
    );

    expect(html).toContain("Current rotation (baseline)");
    expect(html).toContain("Maize – Soybean");
    expect(html).toContain("Bare-soil days");
    expect(html).toContain("65 days");
    expect(html).toContain("Seasonal water shortfall");
    expect(html).toContain("110 mm");
    expect(html).toContain("Alternatives");
    expect(html).toContain("Spring Canola – Grain Sorghum w/ Rye");
  });

  it("renders the provenance disclosure note", () => {
    const html = renderToStaticMarkup(
      <UBCComparisonView analysis={mockAnalysis} lowWater={false} onToggle={() => {}} />
    );

    expect(html).toContain("Modelled rotation comparison");
    expect(html).toContain("NASA POWER daily weather 1991–2024");
    expect(html).toContain("SoilGrids soil estimates at 250 m");
    expect(html).toContain("Illustrative, not measured at this farm");
  });

  it("renders the limited irrigation water toggle", () => {
    const html = renderToStaticMarkup(
      <UBCComparisonView analysis={mockAnalysis} lowWater={true} onToggle={() => {}} />
    );

    expect(html).toContain("Limited irrigation water");
    expect(html).toContain('aria-label="Limited irrigation water"');
  });
});
