"""Farm co-pilot endpoint; forecast values are always built on the server."""
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing import Annotated

from app.services import copilot

router = APIRouter(tags=["copilot"])


class Selected(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["field", "flag", "strategy"]
    id: str = Field(min_length=1, max_length=200)


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    preset: Literal["baseline", "drier_summers", "wetter_winters", "both"] = "baseline"
    rain_scale_pct: float | None = None
    temp_offset_c: float | None = None
    rain_scale_by_season: dict[Literal["winter", "spring", "summer", "fall"], float] | None = None


class Snapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    farm_id: str = Field(min_length=1, max_length=200)
    site_id: str = Field(pattern=r"^site_[A-Za-z0-9_-]+$")
    field_id: str | None
    horizon: Literal["years", "months"]
    time_index: int = Field(ge=0)
    scenario: Scenario
    strategy_id: str | None = Field(pattern=r"^rot_[A-Za-z0-9_-]+$")
    selected: Selected | None


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(max_length=4000)]


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    snapshot: Snapshot
    history: list[Message] = Field(default_factory=list, max_length=6)


@router.post("/copilot/chat")
def post_chat(body: ChatRequest, request: Request):
    return copilot.chat(body.model_dump(exclude_none=True), request.client.host if request.client else "unknown")
