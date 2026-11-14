"""TerrainPackage metadata and assets.

Resolution order (Prompt 33):
  1. data/packages/<terrain_id>/  — real packages built by the scan pipeline
  2. packages/contracts/fixtures/terrain/<terrain_id>/  — mock fixtures

Fixture-only code is kept for the demo path until the scan pipeline (BE-03)
starts writing real packages.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from app.core.config import REPO_ROOT
from app.core.errors import not_found
from app.providers.fixtures import store

log = logging.getLogger("fieldtwin.services.terrain")

# Real packages built by the packaging module land here.
_PACKAGES_DIR = REPO_ROOT / "data" / "packages"


# ---------------------------------------------------------------------------
# Helpers — look up a file in real packages then fixtures
# ---------------------------------------------------------------------------

def _real_pkg_dir(terrain_id: str) -> Path | None:
    """Return the real package directory if it exists, else None."""
    d = _PACKAGES_DIR / terrain_id
    if (d / "terrain.json").exists():
        return d
    return None


def _require(terrain_id: str) -> tuple[Path | None, str]:
    """Return (real_dir, fixture_prefix) for terrain_id.

    Raises ApiError("NOT_FOUND") if neither real package nor fixture exists.
    """
    real = _real_pkg_dir(terrain_id)
    if real:
        return real, ""

    # Fall back to fixtures.
    fixture_prefix = f"terrain/{terrain_id}"
    if store().exists(f"{fixture_prefix}/terrain.json"):
        return None, fixture_prefix

    raise not_found("terrain", terrain_id)


# ---------------------------------------------------------------------------
# Public API called by routers/terrain.py
# ---------------------------------------------------------------------------

def get_terrain(terrain_id: str) -> dict:
    real, fp = _require(terrain_id)
    if real:
        return json.loads((real / "terrain.json").read_text())
    return store().json(f"{fp}/terrain.json")


def asset_path(terrain_id: str, filename: str) -> Path:
    """filename: heightmap.png | normal.png | texture.jpg | layers/<name>.png"""
    real, fp = _require(terrain_id)
    if real:
        p = real / filename
        if p.exists():
            return p
        raise not_found("asset", f"{terrain_id}/{filename}")
    try:
        return store().path(f"{fp}/{filename}")
    except FileNotFoundError as e:
        raise not_found("asset", f"{terrain_id}/{filename}") from e


def get_layers(terrain_id: str) -> dict:
    real, fp = _require(terrain_id)
    if real:
        layers_path = real / "layers.json"
        if layers_path.exists():
            return json.loads(layers_path.read_text())
    return store().json(f"{fp}/layers.json")


def get_insights(terrain_id: str) -> list[dict]:
    real, fp = _require(terrain_id)
    if real:
        insights_path = real / "insights.json"
        if insights_path.exists():
            return json.loads(insights_path.read_text())
        return []   # real packages may not have insights yet
    return store().json(f"{fp}/insights.json")


def get_provenance(terrain_id: str) -> dict:
    real, fp = _require(terrain_id)
    if real:
        prov_path = real / "provenance.json"
        if prov_path.exists():
            return json.loads(prov_path.read_text())
        # Build a minimal provenance dict from terrain.json
        terrain = get_terrain(terrain_id)
        return {
            "terrain_id": terrain_id,
            "sources": terrain.get("sources", []),
            "quality_flags": terrain.get("quality_flags", []),
            "created_at": terrain.get("created_at", ""),
        }
    return store().json(f"{fp}/provenance.json")


def require_terrain(terrain_id: str) -> None:
    _require(terrain_id)
