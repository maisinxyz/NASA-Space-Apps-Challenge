"""Deterministic weather ensemble (PRD §5.3).

Baseline weather is the historical weekly table (n_years, 52). Each member draws
`horizon` historical years with `numpy.random.default_rng(member_seed(...))`.
The scenario is a linear ramp from year 0 (no change) to `ramp.years` (full value).
`cmip6_delta` has no per-year delta on `ScenarioApplied` yet, so both climate
sources use this ramp. Session C records a verified delta table before this changes.
"""

from __future__ import annotations

import numpy as np

from app.features.pipeline import season_months
from app.twin.types import WEEK_COUNT, ScenarioApplied, Weather

# Month (1-12) of each week's middle day on a 365-day year. Week 51 also holds days 358-365.
_MONTH_START = np.cumsum([0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30])
_DAY = np.arange(365)
_MONTH_OF_DAY = np.searchsorted(_MONTH_START, _DAY, side="right") - 1
_WEEK_OF_DAY = np.minimum(_DAY // 7, WEEK_COUNT - 1)
_WEEK_MONTH = np.zeros(WEEK_COUNT, dtype=int)
for _w in range(WEEK_COUNT):
    days = _DAY[_WEEK_OF_DAY == _w]
    _WEEK_MONTH[_w] = int(_MONTH_OF_DAY[days[len(days) // 2]]) + 1


def week_in_season(season: str, lat: float) -> np.ndarray:
    """True on the weeks whose middle day falls in that meteorological season."""
    months = season_months(season, lat)
    return np.isin(_WEEK_MONTH, months)


def _fill_weeks(grid: np.ndarray) -> np.ndarray:
    """Replace a missing week with the mean of the finite years for that week.

    Seeded POWER tables are complete. This only runs if a week is NaN, and the
    fill is the other historical years of the same week (derived), not a constant.
    """
    out = np.array(grid, dtype=np.float64, copy=True)
    for week in range(WEEK_COUNT):
        column = out[:, week]
        bad = ~np.isfinite(column)
        if not bad.any():
            continue
        finite = column[~bad]
        column[bad] = float(np.mean(finite)) if finite.size else 0.0
    return out


def build_members(
    weather: Weather,
    scenario: ScenarioApplied,
    horizon: int,
    n: int,
    req_hash: str,
    *,
    lat: float,
) -> list[Weather]:
    """`n` members, each `Weather` with shape (horizon, 52).

    `lat` is keyword-only because seasonal rain uses the same hemisphere rule as
    `features.pipeline.season_months`. Year t (1-based) is scaled by t / ramp.years.
    """
    from app.twin.types import member_seed

    if horizon < 1:
        raise ValueError("horizon must be at least 1")
    if n < 1:
        raise ValueError("n must be at least 1")
    years = weather.years
    n_hist = int(years.shape[0])
    if n_hist < 1:
        raise ValueError("weather has no historical years")
    tmax = _fill_weeks(weather.tmax)
    tmin = _fill_weeks(weather.tmin)
    rain = _fill_weeks(weather.rain)
    et0 = _fill_weeks(weather.et0)
    ramp_years = max(int(scenario.ramp.years), 1)
    members: list[Weather] = []
    for member in range(n):
        rng = np.random.default_rng(member_seed(req_hash, member))
        picked = rng.integers(0, n_hist, size=horizon)
        mt = tmax[picked].copy()
        mn = tmin[picked].copy()
        mr = rain[picked].copy()
        me = et0[picked].copy()
        labels = years[picked].astype(np.int64, copy=True)
        for row, year_index in enumerate(range(1, horizon + 1)):
            fraction = min(1.0, year_index / ramp_years)
            _apply_row(mt[row], mn[row], mr[row], me[row], scenario, fraction, lat)
        members.append(Weather(years=labels, tmax=mt, tmin=mn, rain=mr, et0=me))
    return members


def _apply_row(
    tmax: np.ndarray,
    tmin: np.ndarray,
    rain: np.ndarray,
    et0: np.ndarray,
    scenario: ScenarioApplied,
    fraction: float,
    lat: float,
) -> None:
    """In-place ramp. ET0 follows the Hargreaves temperature factor already in the feature pipeline.

    Shifting tmax and tmin by the same amount leaves sqrt(tmax-tmin) unchanged, so
    ET0 scales by (Tmean + dT + 17.8) / (Tmean + 17.8). 0.0023 and 0.408 cancel.
    """
    delta_t = float(scenario.temp_offset_c) * fraction
    pct = np.full(WEEK_COUNT, float(scenario.rain_scale_pct), dtype=np.float64)
    for season, seasonal in scenario.rain_scale_by_season.items():
        pct[week_in_season(season, lat)] = float(seasonal)
    rain *= 1.0 + pct / 100.0 * fraction
    tmean = 0.5 * (tmax + tmin)
    denom = np.maximum(tmean + 17.8, 1e-6)
    et0 *= np.maximum(tmean + delta_t + 17.8, 0.0) / denom
    tmax += delta_t
    tmin += delta_t
    np.clip(et0, 0.0, None, out=et0)
    np.maximum(rain, 0.0, out=rain)
