from fastapi import APIRouter

from app.core.types import LayerName, TerrainIdPath, asset
from app.services import terrain as svc

router = APIRouter(tags=["terrain"])


@router.get("/terrain/{terrain_id}")
def get_terrain(terrain_id: TerrainIdPath):
    return svc.get_terrain(terrain_id)


@router.get("/terrain/{terrain_id}/heightmap.png")
def get_heightmap(terrain_id: TerrainIdPath):
    return asset(svc.asset_path(terrain_id, "heightmap.png"), "image/png")


@router.get("/terrain/{terrain_id}/normal.png")
def get_normal_map(terrain_id: TerrainIdPath):
    return asset(svc.asset_path(terrain_id, "normal.png"), "image/png")


@router.get("/terrain/{terrain_id}/texture.jpg")
def get_texture(terrain_id: TerrainIdPath):
    return asset(svc.asset_path(terrain_id, "texture.jpg"), "image/jpeg")


@router.get("/terrain/{terrain_id}/layers")
def get_layer_catalog(terrain_id: TerrainIdPath):
    return svc.get_layers(terrain_id)


@router.get("/terrain/{terrain_id}/layers/{name}.png")
def get_layer(terrain_id: TerrainIdPath, name: LayerName):
    return asset(svc.asset_path(terrain_id, f"layers/{name}.png"), "image/png")


@router.get("/terrain/{terrain_id}/insights")
def get_insights(terrain_id: TerrainIdPath):
    return svc.get_insights(terrain_id)


@router.get("/terrain/{terrain_id}/provenance")
def get_provenance(terrain_id: TerrainIdPath):
    return svc.get_provenance(terrain_id)
