"""Typical calendar months from the historical POWER record."""

from calendar import monthrange
from dataclasses import replace
from datetime import UTC, date, datetime
from functools import lru_cache
import os

import numpy as np

from app.core.errors import ApiError
from app.features import config as C
from app.features import pipeline as P
from app.services.features import base
from app.twin.types import SUPPORT_SENTENCE
from app.weather import seasonal

MAX_MONTHS = 12


def _next_month(today: date) -> date:
    year, month = divmod(today.year * 12 + today.month, 12)
    return date(year, month + 1, 1)


def outlook(site_id: str, months: int = MAX_MONTHS, scenario: str = "baseline") -> dict:
    """Return cached climatology starting next calendar month in UTC."""

    now = datetime.now(UTC)
    refresh = now.replace(minute=0, second=0, microsecond=0) if (
        scenario == "baseline" and os.getenv("OPEN_METEO_SEASONAL") == "1" and os.getenv("OFFLINE") != "1"
    ) else None
    return _outlook(site_id, months, scenario, _next_month(now.date()), refresh)


def _shift_weather(daily: P.Daily, month: int, temperature: float, precipitation: float) -> P.Daily:
    values = {**daily.v}
    in_month = daily.month == month
    for name in (P.T2M, P.TMAX, P.TMIN):
        values[name] = daily.v[name] + np.where(in_month, temperature, 0)
    rain = daily.v[P.RAIN].copy()
    for year in np.unique(daily.year):
        mask = (daily.year == year) & in_month
        if not mask.any() or not np.isfinite(rain[mask]).all():
            continue
        total = np.sum(rain[mask])
        adjusted = max(0.0, total + precipitation)
        rain[mask] = rain[mask] * (adjusted / total) if total > 0 else adjusted / np.count_nonzero(mask)
    values[P.RAIN] = rain
    return replace(daily, v=values)


def _historical_months(daily: P.Daily) -> dict[int, list[list[float]]]:
    # The feature engine's reference-water balance is rain minus Hargreaves ET0.
    # Summing it daily assigns all days to the correct calendar month.
    rain = daily.v[P.RAIN]
    balance = rain - P.et0_hargreaves(daily)
    tmean, tmax, tmin = (daily.v[var] for var in (P.T2M, P.TMAX, P.TMIN))
    historical = {month: [[] for _ in range(5)] for month in range(1, 13)}
    for year in np.unique(daily.year):
        for month, metrics in historical.items():
            mask = (daily.year == year) & (daily.month == month)
            if np.count_nonzero(mask) != monthrange(int(year), month)[1]:
                continue
            for values, reducer, samples in zip(
                (tmean, rain, balance, tmax, tmin),
                (
                    np.mean, np.sum, np.sum,
                    lambda v: np.count_nonzero(v >= C.THRESHOLDS["heat_c"]),
                    lambda v: np.count_nonzero(v <= C.THRESHOLDS["frost_c"]),
                ),
                metrics,
                strict=True,
            ):
                selected = values[mask]
                if np.isfinite(selected).all():
                    samples.append(float(reducer(selected)))
    return historical


def _number(samples: list[float], unit: str, basis: str, lead: int) -> dict:
    if not samples:
        raise ApiError("DATA_SOURCE_UNAVAILABLE", "POWER has no complete records for a requested calendar month.")
    # Broadening policy from the PRD: move the historical 10th/90th bounds
    # toward the historical extremes over the fixed twelve-month horizon.
    tail = 10 * (MAX_MONTHS - 1 - lead) / (MAX_MONTHS - 1)
    lower, median, upper = np.percentile(samples, (tail, 50, 100 - tail))
    return {
        "value": round(float(np.mean(samples)), 3),
        "unit": unit,
        "basis": basis,
        "confidence": "medium" if len(samples) == C.PERIOD[1].year - C.PERIOD[0].year + 1 else "low",
        "p10": round(float(lower), 3),
        "p50": round(float(median), 3),
        "p90": round(float(upper), 3),
    }


@lru_cache(maxsize=64)
def _outlook(site_id: str, months: int, scenario: str, start: date, refresh: datetime | None = None) -> dict:
    daily, _, _, info = base(site_id)
    adjusted = P.apply_scenario(daily, P.resolve_scenario(scenario))
    historical = _historical_months(adjusted)
    metrics = (
        ("temperature_mean_c", "degC", "derived"),
        ("rain_mm", "mm", "derived"),
        ("water_balance_mm", "mm", "modeled"),
        ("heat_risk", "days", "derived"),
        ("frost_risk", "days", "derived"),
    )
    rows = []
    month = start
    anomalies = seasonal.anomalies(info["lat"], info["lon"]) if refresh else {}
    for lead in range(months):
        key = month.strftime("%Y-%m")
        anomaly = anomalies.get(key)
        samples_by_metric = historical[month.month]
        if anomaly is not None:
            shifted = _shift_weather(adjusted, month.month, *anomaly)
            samples_by_metric = _historical_months(shifted)[month.month]
        rows.append({
            "month": key,
            "kind": "seasonal_forecast" if anomaly is not None else "climatology",
            **{
                metric: _number(samples, unit, "modeled" if anomaly is not None else basis, lead)
                for (metric, unit, basis), samples in zip(metrics, samples_by_metric, strict=True)
            },
        })
        month = _next_month(month)
    has_seasonal = any(row["kind"] == "seasonal_forecast" for row in rows)
    return {
        "site_id": site_id,
        "start_month": start.strftime("%Y-%m"),
        "kind": "seasonal_forecast" if has_seasonal else "climatology",
        "data_mode": "limited_data",
        "months": rows,
        "sources": [dict(C.POWER_SOURCE)] + ([dict(seasonal.SOURCE)] if has_seasonal else []),
        "support_sentence": SUPPORT_SENTENCE,
    }
