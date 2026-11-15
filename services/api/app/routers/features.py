from fastapi import APIRouter

from app.core.types import ScenarioQuery, SiteIdPath
from app.features.pipeline import resolve_scenario
from app.services import features as svc

router = APIRouter(tags=["sites"])


@router.get("/sites/{site_id}/features")
def get_features(site_id: SiteIdPath, scenario: ScenarioQuery = "baseline"):
    return svc.feature_table(site_id, resolve_scenario(scenario))


@router.get("/sites/{site_id}/hazard-calendar")
def get_hazard_calendar(site_id: SiteIdPath, scenario: ScenarioQuery = "baseline"):
    return svc.hazard_calendar(site_id, scenario)


@router.get("/sites/{site_id}/hazards")
def get_hazards(site_id: SiteIdPath):
    return svc.hazard_catalog(site_id)


@router.get("/sites/{site_id}/zones")
def get_zones(site_id: SiteIdPath):
    return svc.zones(site_id)
