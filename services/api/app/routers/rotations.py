from fastapi import APIRouter

from app.core.types import TerrainIdQuery, ValidateRequest
from app.services import crops as svc

router = APIRouter(tags=["crops"])


@router.get("/rotations/presets")
def list_rotation_presets(terrain_id: TerrainIdQuery):
    return svc.rotation_presets(terrain_id)


@router.post("/rotations/validate")
def validate_rotation(body: ValidateRequest):
    return svc.validate_rotation(body.terrain_id, [s.model_dump() for s in body.rotation.sequence])
