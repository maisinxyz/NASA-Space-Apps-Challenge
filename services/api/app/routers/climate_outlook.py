"""GET /sites/{site_id}/climate-outlook. W9 registers this router in app/main.py."""

from fastapi import APIRouter

from app.core.types import ScenarioQuery, SiteIdPath
from app.services.climate_outlook import climate_outlook

router = APIRouter(tags=["forecast"])


@router.get("/sites/{site_id}/climate-outlook")
def get_climate_outlook(site_id: SiteIdPath, scenario: ScenarioQuery = "baseline"):
    return climate_outlook(site_id, scenario)
