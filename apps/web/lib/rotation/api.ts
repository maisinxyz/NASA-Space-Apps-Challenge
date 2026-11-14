// Rotation decision-support API calls (PRD §14 proposed endpoints). Mock mode serves lib/rotation/draft-fixtures.ts;
// live mode calls the proposed paths, which 404 until Backend B ships them (B7/B9).
// SWAP: when v1.1 fixtures exist, replace the mock branches with `mock("<fixture>.json")` reads like lib/api/client.ts.
import { isMock, live, postJson } from "@/lib/api/client";

import type { FeatureTable, GlossaryEntry, HazardCalendar, HazardCatalog, RotationAnalysis, RotationAnalysisRequest, ScenarioInput, ZoneCollection } from "./draft-types";
import { MOCK_ROTATIONS, mockFeatureTable, mockHazardCalendar, mockHazards, mockScenarioEcho, mockZones, MOCK_GLOSSARY } from "./draft-fixtures";
import { normalizeWeights, rerank } from "./rank";

const site = (id: string) => `/sites/${encodeURIComponent(id)}`;
const scenarioQuery = (s: ScenarioInput) => new URLSearchParams({ scenario: s.preset, rain_scale_pct: String(s.rain_scale_pct), temp_offset_c: String(s.temp_offset_c) }).toString();
const resolved = <T>(v: T) => Promise.resolve(structuredClone(v));

export function postRotationAnalysis(siteId: string, req: RotationAnalysisRequest): Promise<RotationAnalysis> {
  if (!isMock) return live(`${site(siteId)}/rotation-analysis`, postJson(req));
  // Mock: drop alternatives that use a crop outside allowed_crops, then rank with the farmer's weights.
  const allowed = new Set(req.allowed_crops);
  const kept = MOCK_ROTATIONS.filter((r) => r.is_existing || allowed.size === 0 || r.sequence.every((s) => allowed.has(s.crop_id)));
  const ranked = rerank(kept, req.weights, req.criteria_selected) ?? kept;
  return resolved<RotationAnalysis>({
    site_id: siteId,
    engine_version: "draft-mock",
    data_mode: "mock",
    scenario: mockScenarioEcho(req.scenario),
    limited_data: true,
    rotations: ranked,
    weights_applied: normalizeWeights(req.weights, req.criteria_selected) ?? {},
    warnings: kept.length < 3 ? [{ code: "NO_FEASIBLE_ALTERNATIVES", message: "Fewer than two alternatives fit your allowed crops." }] : [],
    request_echo: req,
    disclaimer: MOCK_ROTATIONS[0].evidence_card.support_not_replace,
  });
}

export const getFeatures = (siteId: string, s: ScenarioInput): Promise<FeatureTable> =>
  isMock ? resolved(mockFeatureTable(siteId, s)) : live(`${site(siteId)}/features?${scenarioQuery(s)}`);

export const getHazardCalendar = (siteId: string, s: ScenarioInput): Promise<HazardCalendar> =>
  isMock ? resolved(mockHazardCalendar(siteId, s)) : live(`${site(siteId)}/hazard-calendar?${scenarioQuery(s)}`);

export const getHazards = (siteId: string): Promise<HazardCatalog> => (isMock ? resolved(mockHazards(siteId)) : live(`${site(siteId)}/hazards`));

export const getZones = (siteId: string): Promise<ZoneCollection> => (isMock ? resolved(mockZones(siteId)) : live(`${site(siteId)}/zones`));

export const getGlossary = (): Promise<GlossaryEntry[]> => (isMock ? resolved(MOCK_GLOSSARY) : live("/glossary"));
