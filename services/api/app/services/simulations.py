"""Simulations. Fixture-backed (BE-08/09 replace this). Every request maps to sim_mock_001."""

from pathlib import Path

from app.core.errors import ApiError, not_found
from app.providers.fixtures import MOCK_SIM_ID, store
from app.services.crops import require_rotations
from app.services.terrain import require_terrain
from app.services.weather import require_storm


def run_simulation(terrain_id: str, storm_id: str, rotation_ids: list[str]) -> tuple[dict, bool]:
    """Return (status, cached)."""
    require_terrain(terrain_id)
    require_storm(terrain_id, storm_id)
    require_rotations(terrain_id, rotation_ids)
    status = get_simulation(MOCK_SIM_ID)
    status["results"] = {rid: res for rid, res in status["results"].items() if rid in rotation_ids}
    return status, status["cached"]


def get_simulation(sim_id: str) -> dict:
    if sim_id != MOCK_SIM_ID:
        raise not_found("simulation", sim_id)
    return store().json(f"simulations/{sim_id}/status.json")


def _asset(sim_id: str, rel: str) -> Path:
    get_simulation(sim_id)
    try:
        return store().path(f"simulations/{sim_id}/{rel}")
    except FileNotFoundError as e:
        raise not_found("asset", f"{sim_id}/{rel}") from e


def frames_path(sim_id: str, rotation_id: str) -> Path:
    return _asset(sim_id, f"frames/{rotation_id}.bin")


def risk_path(sim_id: str, rotation_id: str) -> Path:
    return _asset(sim_id, f"risk/{rotation_id}.png")


def get_evidence(sim_id: str) -> dict:
    get_simulation(sim_id)
    return store().json(f"simulations/{sim_id}/evidence.json")


def _diff_key(sim_id: str, a: str, b: str) -> str:
    if a == b:
        raise ApiError("INVALID_INPUT", "a and b must be different rotations.", "Pick two different rotations.")
    results = get_simulation(sim_id)["results"]
    for rid in (a, b):
        if rid not in results:
            raise not_found("rotation", rid)
    return f"simulations/{sim_id}/diff/{a}__{b}"


def diff_stats(sim_id: str, a: str, b: str) -> dict:
    return store().json(_diff_key(sim_id, a, b) + ".json")


def diff_png(sim_id: str, a: str, b: str) -> Path:
    return store().path(_diff_key(sim_id, a, b) + ".png")
