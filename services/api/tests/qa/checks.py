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


def missing_fields(doc: dict, paths: list[str]) -> list[str]:
    """Paths named in PRD section 12. A final null is allowed. An empty list fails a `[]` step."""

    missing = []
    for path in paths:
        if not _has_path(doc, path):
            missing.append(path)
    return missing


def _has_path(doc: dict, path: str) -> bool:
    current = doc
    for part in path.split("."):
        if not isinstance(current, dict):
            return False
        key = part[:-2] if part.endswith("[]") else part
        if key not in current:
            return False
        current = current[key]
        if part.endswith("[]"):
            if not isinstance(current, list) or not current:
                return False
            current = current[0]
    return True


# Response fields section 12 tells the UI to read. Request-only names are not listed.
FORECAST_FIELDS = (
    "support_sentence",
    "disclaimer",
    "data_mode",
    "scenario",
    "scenario.ramp",
    "request_hash",
    "sources[].license",
    "sources[].attribution",
    "climate_outlook.seasonal_temperature",
    "climate_outlook.heat_stress_days",
    "climate_outlook.frost_windows.last_spring_frost",
    "climate_outlook.frost_windows.first_fall_frost",
    "climate_outlook.frost_windows.frost_free_season_days",
    "climate_outlook.rainfall",
    "climate_outlook.et_and_soil_moisture",
    "climate_outlook.water_balance",
    "climate_outlook.groundwater",
    "exposure.vulnerable_seasons",
    "exposure.bare_field_windows",
    "exposure.zones",
    "exposure.resolution_notes",
    "fields[].strategies[].plan",
    "fields[].strategies[].trajectories",
    "fields[].strategies[].scorecard",
    "fields[].strategies[].farm_fit.water_vs_quota",
    "fields[].strategies[].farm_fit.forage_suitability",
    "fields[].strategies[].farm_fit.operational_fit",
    "fields[].strategies[].farm_fit.market_fit",
    "fields[].strategies[].estimates.yield_t_ha",
    "fields[].strategies[].estimates.forage_yield_t_ha",
    "fields[].strategies[].estimates.soil_loss_t_ha_yr",
    "fields[].strategies[].estimates.n_fertilizer_need_kg_ha",
    "fields[].strategies[].estimates.n_fertilizer_saved_kg_ha",
    "fields[].strategies[].estimates.income_estimate",
    "fields[].strategies[].evidence_card",
    "fields[].strategies[].review_flags",
    "farm_rollup.strategies",
    "comparison.rank_by_priority",
    "comparison.rank_stability",
    "uncertainty.layers[].native_resolution_m",
    "uncertainty.layers[].record_years",
    "uncertainty.layers[].confidence",
    "uncertainty.layers[].resolution_note",
    "uncertainty.layers[].needs_local_validation",
    "uncertainty.station_bias",
    "assumptions",
    "warnings",
)

CLIMATE_FIELDS = (
    "scenario",
    "data_mode",
    "seasonal_temperature",
    "heat_stress_days",
    "frost_windows.last_spring_frost",
    "frost_windows.first_fall_frost",
    "frost_windows.frost_free_season_days",
    "rainfall",
    "et_and_soil_moisture",
    "water_balance",
    "groundwater",
    "sources[].license",
    "sources[].attribution",
)

EXPOSURE_FIELDS = (
    "vulnerable_seasons",
    "bare_field_windows",
    "zones",
    "resolution_notes",
    "caveats",
    "data_mode",
)

SENSITIVITY_FIELDS = (
    "axes.rain_scale_pct",
    "axes.temp_offset_c",
    "cells[].per_strategy",
    "rank_stability.share_first_by_strategy",
)


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
