"""Weather trends and storms. Fixture-backed (BE-06 replaces this with NASA POWER)."""

from app.core.errors import not_found
from app.providers.fixtures import DEFAULT_TERRAIN, store
from app.services.terrain import require_terrain


def get_summary(lat: float, lon: float) -> dict:
    # Mock: one summary for every location.
    return store().json("weather/summary.json")


def list_storms(terrain_id: str) -> list[dict]:
    require_terrain(terrain_id)
    rel = f"storms/{terrain_id}.json"
    return store().json(rel if store().exists(rel) else f"storms/{DEFAULT_TERRAIN}.json")


def require_storm(terrain_id: str, storm_id: str) -> None:
    if storm_id not in {s["id"] for s in list_storms(terrain_id)}:
        raise not_found("storm", storm_id)
