from fastapi import APIRouter, Query

from app.core.types import RotationAnalysisIn, ScenarioQuery, SiteIdPath
from app.rotation import traits
from app.services import rotation as svc

router = APIRouter(tags=["crops"])


@router.post("/sites/{site_id}/rotation-analysis")
def analyze_rotations(site_id: SiteIdPath, body: RotationAnalysisIn):
    return svc.public(svc.analyze(site_id, body.model_dump(exclude_none=True)))


@router.get("/sites/{site_id}/compare")
def compare_rotations(site_id: SiteIdPath, rotations: str = Query(...), scenario: ScenarioQuery = "baseline"):
    return svc.compare(site_id, [r for r in rotations.split(",") if r], scenario)


@router.get("/glossary")
def list_glossary():
    return traits.glossary()
