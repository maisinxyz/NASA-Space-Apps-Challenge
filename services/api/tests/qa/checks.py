"""Shared checks for the forecast QA harness. No network. No invented series."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.core.config import REPO_ROOT

SEED = REPO_ROOT / "data" / "seed"
BASIS = {"measured", "derived", "modeled", "assumed", "relative"}
CONFIDENCE = {"high", "medium", "low"}
# Absolute estimates named in PRD section 9. Each YearSeries point needs p10 and p90.
ABSOLUTE_SERIES = (
    "yield_t_ha",
    "forage_yield_t_ha",
    "soil_loss_t_ha_yr",
    "n_fertilizer_need_kg_ha",
    "n_fertilizer_saved_kg_ha",
)


def walk_numbers(obj, path: str = ""):
    if isinstance(obj, dict) and {"value", "unit", "basis", "confidence"} <= obj.keys():
        yield path or "<root>", obj
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield from walk_numbers(value, f"{path}.{key}" if path else str(key))
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            yield from walk_numbers(value, f"{path}[{index}]")


def number_problems(doc: dict) -> list[str]:
    problems = []
    for path, number in walk_numbers(doc):
        if not str(number.get("unit") or "").strip():
            problems.append(f"{path}: missing unit")
        if number.get("basis") not in BASIS:
            problems.append(f"{path}: basis {number.get('basis')!r}")
        if number.get("confidence") not in CONFIDENCE:
            problems.append(f"{path}: confidence {number.get('confidence')!r}")
    return problems


def source_problems(sources: list) -> list[str]:
    problems = []
    for index, source in enumerate(sources or []):
        if not str(source.get("license") or "").strip():
            problems.append(f"sources[{index}]: missing license")
        if not str(source.get("attribution") or "").strip():
            problems.append(f"sources[{index}]: missing attribution")
    return problems


def series_range_problems(series: dict, path: str) -> list[str]:
    problems = []
    for point in series.get("points") or []:
        if "p10" not in point or "p90" not in point:
            problems.append(f"{path} year {point.get('year')}: missing p10/p90")
    return problems


def canonical_json(doc: dict) -> str:
    return json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def station_daily_path(site_id: str) -> Path | None:
    """A daily station file if one was stored. Gap records do not count."""

    folder = SEED / site_id
    for name in ("station_daily.json", "station_daily.json.gz"):
        path = folder / name
        if path.is_file():
            return path
    return None


def mean_bias(power: np.ndarray, station: np.ndarray) -> float | None:
    """Mean of POWER minus station on finite pairs. None when no pair exists. Not a filled substitute."""

    left = np.asarray(power, dtype=np.float64)
    right = np.asarray(station, dtype=np.float64)
    if left.shape != right.shape or left.size == 0:
        return None
    both = np.isfinite(left) & np.isfinite(right)
    if not both.any():
        return None
    return float((left[both] - right[both]).mean())
