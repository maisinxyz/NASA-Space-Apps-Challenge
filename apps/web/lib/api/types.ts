// Friendly aliases over the generated contract types. Regenerate schema.d.ts with `pnpm types`.
import type { components } from "./schema";

type S = components["schemas"];

export type Basis = S["Basis"];
export type BasisOrRelative = S["BasisOrRelative"];
export type Health = S["Health"];
export type Site = S["Site"];
export type TerrainPackage = S["TerrainPackage"];
export type LayerName = S["LayerName"];
export type LayerCatalog = S["LayerCatalog"];
export type LayerLegend = S["LayerLegend"];
export type Provenance = S["Provenance"];
export type Insight = S["Insight"];
export type EvidenceCard = S["EvidenceCard"];
export type EvidenceBundle = S["EvidenceBundle"];
export type WeatherSummary = S["WeatherSummary"];
export type TrendSeries = S["TrendSeries"];
export type Storm = S["Storm"];
export type CropTemplate = S["CropTemplate"];
export type Rotation = S["Rotation"];
export type ValidateRequest = S["ValidateRequest"];
export type ValidateResult = S["ValidateResult"];
export type SimulationRequest = S["SimulationRequest"];
export type SimulationStatus = S["SimulationStatus"];
export type RotationResult = S["RotationResult"];
export type Metrics = S["Metrics"];
export type DiffStats = S["DiffStats"];
export type ScanCreated = S["ScanCreated"];
export type ScanStatus = S["ScanStatus"];
export type ProgressEvent = S["ProgressEvent"];
export type ProgressStage = S["ProgressStage"];
export type Note = S["Note"];
export type NoteCreate = S["NoteCreate"];
export type ErrorCode = S["ErrorCode"];
export type ErrorBody = S["ErrorBody"];

// v1.2 forecast (docs/backend-forecast-prd.md §6)
export type Scenario = S["Scenario"];
export type ClimateOutlook = S["ClimateOutlook"];
export type ForecastExposure = S["ForecastExposure"];
export type CropCatalog = S["CropCatalog"];
export type CropTraitV2 = S["CropTraitV2"];
export type ForecastRequest = S["ForecastRequest"];
export type Forecast = S["Forecast"];
export type ForecastFieldResult = S["ForecastFieldResult"];
export type SensitivityGrid = S["SensitivityGrid"];
export type YearSeries = S["YearSeries"];
