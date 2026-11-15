"""Shared request types mirroring packages/contracts/openapi.yaml."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import Path, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


def _id(prefix: str) -> str:
    return rf"^{prefix}_[A-Za-z0-9_-]+$"


SiteIdPath = Annotated[str, Path(pattern=_id("site"))]
ScanIdPath = Annotated[str, Path(pattern=_id("scan"))]
TerrainIdPath = Annotated[str, Path(pattern=_id("terr"))]
SimIdPath = Annotated[str, Path(pattern=_id("sim"))]
RotationIdPath = Annotated[str, Path(pattern=_id("rot"))]
TerrainIdQuery = Annotated[str, Query(pattern=_id("terr"))]
RotationIdQuery = Annotated[str, Query(pattern=_id("rot"))]
Scenario = Literal["baseline", "wetter_winters", "drier_summers", "both"]
ScenarioQuery = Annotated[Scenario, Query()]

TerrainId = Annotated[str, Field(pattern=_id("terr"))]
StormId = Annotated[str, Field(pattern=_id("storm"))]
RotationId = Annotated[str, Field(pattern=_id("rot"))]
CropId = Annotated[str, Field(pattern=_id("crop"))]
NoteId = Annotated[str, Field(pattern=_id("note"))]

LayerName = Literal["slope", "flow_accumulation", "depressions", "cover_class"]
Basis = Literal["measured", "derived", "modeled", "assumed"]

IMMUTABLE = "public, max-age=31536000, immutable"


def asset(path, media_type: str) -> FileResponse:
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": IMMUTABLE})


class SimulationOptions(BaseModel):
    grid_max: int = Field(256, ge=16)
    frames: int = Field(60, ge=1)
    soil_group: Literal["A", "B", "C", "D"] = "B"
    soil_group_basis: Basis = "assumed"


class SimulationRequest(BaseModel):
    terrain_id: TerrainId
    storm_id: StormId
    rotation_ids: list[RotationId] = Field(min_length=1, max_length=3)
    options: SimulationOptions = SimulationOptions()


class RotationStep(BaseModel):
    year: int = Field(ge=1)
    crop_id: CropId


class EditedRotation(BaseModel):
    base_rotation_id: RotationId | None = None
    name: str
    sequence: list[RotationStep] = Field(min_length=1)


class ValidateRequest(BaseModel):
    terrain_id: TerrainId
    rotation: EditedRotation


class NoteCreate(BaseModel):
    terrain_id: TerrainId
    anchor: tuple[Annotated[float, Field(ge=-180, le=180)], Annotated[float, Field(ge=-90, le=90)]]
    body: str = Field(min_length=1, max_length=2000)
    parent_id: NoteId | None = None
    author: str | None = Field(None, max_length=80)


# ---------- v1.1 rotation analysis (backend rotation PRD §9) ----------
Criterion = Literal["nutrient_cycling", "erosion_risk", "organic_matter", "pest_disruption", "water_use", "forage_potential", "market_suitability"]
Season = Literal["spring", "summer", "fall", "winter"]
MAX_CYCLE_YEARS = 5  # assumed: keeps the alternative search interactive


class RotationSlotIn(BaseModel):
    year_index: int = Field(ge=1, le=MAX_CYCLE_YEARS)
    season: Season
    crop_id: Annotated[str, Field(pattern=r"^(crop_[A-Za-z0-9_-]+|fallow)$")]


class ScenarioIn(BaseModel):
    model_config = {"extra": "forbid"}
    preset: Scenario = "baseline"
    rain_scale_pct: float | None = None
    temp_offset_c: float | None = None
    rain_scale_by_season: dict[Season, float] | None = None


class ConstraintsIn(BaseModel):
    model_config = {"extra": "forbid"}
    low_water: bool = False
    no_specialty_equipment: bool = False
    no_local_market: bool = False


class RotationAnalysisIn(BaseModel):
    model_config = {"extra": "forbid"}
    existing_rotation: Literal["preset"] | Annotated[list[RotationSlotIn], Field(min_length=1)] = "preset"
    criteria_selected: list[Criterion] | None = None
    weights: dict[Criterion, Annotated[float, Field(ge=0)]] | None = None
    weight_preset: Literal["water", "income", "soil_structure", "erosion", "forage"] | None = None
    constraints: ConstraintsIn = ConstraintsIn()
    allowed_crops: list[CropId] | None = None
    scenario: Scenario | ScenarioIn = "baseline"
    location: tuple[Annotated[float, Field(ge=-180, le=180)], Annotated[float, Field(ge=-90, le=90)]] | None = None
