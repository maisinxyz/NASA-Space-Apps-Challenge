"""Monthly climatology endpoint."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.types import ScenarioQuery, SiteIdPath
from app.services.outlook import MAX_MONTHS, outlook

router = APIRouter(tags=["forecast"])


@router.get("/sites/{site_id}/outlook")
def get_outlook(
    site_id: SiteIdPath,
    months: Annotated[int, Query(ge=1, le=MAX_MONTHS)] = MAX_MONTHS,
    scenario: ScenarioQuery = "baseline",
):
    return outlook(site_id, months, scenario)
