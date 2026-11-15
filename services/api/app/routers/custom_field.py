"""Custom 2D field analysis endpoint."""

from typing import Annotated, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.types import CropId, Scenario, ScenarioIn, Season
from app.services.custom_field import analyze

router = APIRouter(tags=["forecast"])


class RotationSlot(BaseModel):
    year_index: Annotated[int, Field(strict=True, ge=1)]
    season: Season
    crop_id: str = Field(pattern=r"^(crop_[A-Za-z0-9_-]+|fallow)$")


class CropSelection(BaseModel):
    crops: list[CropId]
    pinned: list[CropId] = Field(default_factory=list)
    excluded: list[CropId] = Field(default_factory=list)


class FieldAnalysisRequest(BaseModel):
    polygon: dict
    rotation: Literal["preset"] | Annotated[list[RotationSlot], Field(min_length=1)]
    scenario: Scenario | ScenarioIn
    selection: CropSelection | None = None


@router.post("/field/analyze")
def post_analyze(request: Request, body: FieldAnalysisRequest):
    client = request.client.host if request.client else "unknown"
    return analyze(body.model_dump(exclude_none=True), client)
