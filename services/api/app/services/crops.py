"""Crop library and rotations. Fixture-backed (BE-07 replaces this)."""

from app.core.errors import not_found
from app.providers.fixtures import DEFAULT_TERRAIN, store
from app.services.terrain import require_terrain


def list_crops() -> list[dict]:
    return store().json("crops.json")


def rotation_presets(terrain_id: str) -> list[dict]:
    require_terrain(terrain_id)
    rel = f"rotations/{terrain_id}.json"
    return store().json(rel if store().exists(rel) else f"rotations/{DEFAULT_TERRAIN}.json")


def require_rotations(terrain_id: str, rotation_ids: list[str]) -> None:
    known = {r["id"] for r in rotation_presets(terrain_id)}
    for rid in rotation_ids:
        if rid not in known:
            raise not_found("rotation", rid)


def validate_rotation(terrain_id: str, sequence: list[dict]) -> dict:
    """Placeholder checks until BE-07: unknown crops and same-family consecutive years.

    Season-window checks and the returned `rotation` (decision #23) are not implemented yet.
    """
    require_terrain(terrain_id)
    crops = {c["id"]: c for c in list_crops()}
    warnings = []
    for step in sequence:
        if step["crop_id"] not in crops:
            warnings.append({"code": "unknown_crop", "message": f"Unknown crop '{step['crop_id']}'.", "year": step["year"]})
    families_by_year: dict[int, set[str]] = {}
    for step in sequence:
        if step["crop_id"] in crops:
            families_by_year.setdefault(step["year"], set()).add(crops[step["crop_id"]]["family"])
    years = sorted(families_by_year)
    for prev, cur in zip(years, years[1:]):
        if cur == prev + 1:
            for fam in sorted(families_by_year[prev] & families_by_year[cur]):
                warnings.append(
                    {"code": "same_family_consecutive", "message": f"{fam} in consecutive years {prev} and {cur}.", "year": cur}
                )
    return {"valid": not any(w["code"] == "unknown_crop" for w in warnings), "warnings": warnings}
