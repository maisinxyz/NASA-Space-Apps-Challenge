"""TerrainPackage metadata and assets. Fixture-backed (BE-01/04/10 replace this)."""

from pathlib import Path

from app.core.errors import not_found
from app.providers.fixtures import store


def _require(terrain_id: str) -> str:
    if not store().exists(f"terrain/{terrain_id}/terrain.json"):
        raise not_found("terrain", terrain_id)
    return f"terrain/{terrain_id}"


def get_terrain(terrain_id: str) -> dict:
    return store().json(f"{_require(terrain_id)}/terrain.json")


def asset_path(terrain_id: str, filename: str) -> Path:
    """filename: heightmap.png | normal.png | texture.jpg | layers/<name>.png"""
    base = _require(terrain_id)
    try:
        return store().path(f"{base}/{filename}")
    except FileNotFoundError as e:
        raise not_found("asset", f"{terrain_id}/{filename}") from e


def get_layers(terrain_id: str) -> dict:
    return store().json(f"{_require(terrain_id)}/layers.json")


def get_insights(terrain_id: str) -> list[dict]:
    return store().json(f"{_require(terrain_id)}/insights.json")


def get_provenance(terrain_id: str) -> dict:
    return store().json(f"{_require(terrain_id)}/provenance.json")


def require_terrain(terrain_id: str) -> None:
    _require(terrain_id)
