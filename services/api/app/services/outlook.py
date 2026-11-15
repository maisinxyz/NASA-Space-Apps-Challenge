"""Typical calendar months from the historical POWER record."""

from calendar import monthrange
from datetime import UTC, date, datetime
from functools import lru_cache

import numpy as np

from app.core.errors import ApiError
from app.features import config as C
from app.features import pipeline as P
from app.services.features import base
from app.twin.types import SUPPORT_SENTENCE

MAX_MONTHS = 12


def _next_month(today: date) -> date:
    year, month = divmod(today.year * 12 + today.month, 12)
    return date(year, month + 1, 1)


def outlook(site_id: str, months: int = MAX_MONTHS, scenario: str = "baseline") -> dict:
    """Return cached climatology starting next calendar month in UTC."""

    return _outlook(site_id, months, scenario, _next_month(datetime.now(UTC).date()))


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
def _outlook(site_id: str, months: int, scenario: str, start: date) -> dict:
    daily, _, _, _ = base(site_id)
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
    for lead in range(months):
        rows.append({
            "month": month.strftime("%Y-%m"),
            "kind": "climatology",
            **{
                key: _number(samples, unit, basis, lead)
                for (key, unit, basis), samples in zip(metrics, historical[month.month], strict=True)
            },
        })
        month = _next_month(month)
    return {
        "site_id": site_id,
        "start_month": start.strftime("%Y-%m"),
        "kind": "climatology",
        "data_mode": "limited_data",
        "months": rows,
        "sources": [dict(C.POWER_SOURCE)],
        "support_sentence": SUPPORT_SENTENCE,
    }
