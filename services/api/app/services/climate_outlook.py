"""Cached climate outlook. The dict is read-only; the same request returns the same object."""

from __future__ import annotations

from functools import lru_cache

from app.twin.climate import build_climate_outlook


@lru_cache(maxsize=32)
def climate_outlook(site_id: str, scenario: str = "baseline") -> dict:
    return build_climate_outlook(site_id, scenario)
