"""Group 1 climate outlook from the existing POWER daily series.

Decision D2 (2026-11-15): NASA NEX-GDDP-CMIP6 publishes daily ``pr``, ``tasmax`` and
``tasmin`` on a 0.25 degree grid that includes UBC Farm. The license statements do
not agree (see ``docs/progress/FT-W3.md``), so no delta seed is stored and this
module does not apply ``cmip6_delta``. The scenario is ``history_resample``:
observed years, shifted by the preset, with a linear ramp from year 0 to year 10
on the heat-stress series. Observed Theil-Sen trends are context only.
"""

from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats

from app.core.errors import ApiError
from app.features import config as C
from app.features import pipeline as P
from app.features import seeds
from app.rotation.config import DEFAULT_PRESET, SITE_PRESETS
from app.services.features import base, computed
from app.twin.catalog import load_catalog
from app.twin.types import (
    BASIS_VALUES,
    CONFIDENCE_VALUES,
    ENSEMBLE_MEMBERS,
    HORIZON_YEARS_DEFAULT,
    SEASONS,
    member_seed,
    request_hash,
)

# Two-sided significance level for the Mann-Kendall flag. A convention, not a
# measurement. TODO(verify) with the team before treating 0.05 as agreed.
SIGNIFICANCE_ALPHA = 0.05
# history_resample until a verified per-year delta file exists. Do not switch
# this without the license note in docs/progress/FT-W3.md.
CLIMATE_SOURCE = "history_resample"
# Northern last-spring / first-fall split. Southern hemisphere uses 1 January,
# six months from 1 July, the same shift as pipeline.season_months.
# TODO(verify) this calendar split. The 0 degC day itself is THRESHOLDS["frost_c"].
# 32 F (0 degC) is the freeze used by NCEI:
# https://www.ncei.noaa.gov/news/last-spring-freeze
# https://www.ncei.noaa.gov/news/when-expect-first-fall-freeze
_FROST_SPLIT_MONTH_NORTH = 7


def theil_sen_mann_kendall(years: np.ndarray, values: np.ndarray) -> tuple[float, float]:
    """Theil-Sen slope per year and a two-sided Mann-Kendall p-value.

    Slope is ``scipy.stats.theilslopes`` (the median of pairwise slopes).
    Mann-Kendall S and the tie-corrected variance follow Gilbert (1987),
    Statistical Methods for Environmental Pollution Monitoring. The normal
    approximation uses a continuity correction. TODO(verify) a stable URL for
    that formula. Returns ``(nan, 1.0)`` when fewer than 3 finite points exist.
    """

    mask = np.isfinite(values) & np.isfinite(years)
    x = np.asarray(years, dtype=np.float64)[mask]
    y = np.asarray(values, dtype=np.float64)[mask]
    order = np.argsort(x, kind="mergesort")
    x, y = x[order], y[order]
    if x.size < 3:
        return float("nan"), 1.0
    slope = float(stats.theilslopes(y, x)[0])
    return slope, _mann_kendall_p(y)


def _mann_kendall_p(y: np.ndarray) -> float:
    n = int(y.size)
    s = 0.0
    for i in range(n - 1):
        s += float(np.sign(y[i + 1 :] - y[i]).sum())
    _, counts = np.unique(y, return_counts=True)
    ties = counts[counts > 1].astype(np.float64)
    var = (n * (n - 1) * (2 * n + 5) - float(np.sum(ties * (ties - 1) * (2 * ties + 5)))) / 18.0
    if var <= 0 or s == 0:
        return 1.0
    z = (s - math.copysign(1.0, s)) / math.sqrt(var)
    return float(2.0 * stats.norm.sf(abs(z)))


def preset_crop_ids(site_id: str) -> list[str]:
    """Crops in the site's existing-rotation preset, fallow removed, first-seen order.

    ``GET /climate-outlook`` has no crops query. This is the same preset exposure
    uses when ``crops`` is omitted. UBC Farm is not in ``SITE_PRESETS``.
    """

    preset = SITE_PRESETS.get(site_id, DEFAULT_PRESET)
    ids: list[str] = []
    for _year, main, off in preset["slots"]:
        for cid in (main, off):
            if cid != "fallow" and cid not in ids:
                ids.append(cid)
    return ids


def heat_limits(crop_ids: list[str]) -> list[tuple[str, float]]:
    """Catalog heat limits. A null limit is skipped. Nothing is substituted."""

    by_id = {crop["id"]: crop for crop in load_catalog()["crops"]}
    out: list[tuple[str, float]] = []
    for cid in crop_ids:
        crop = by_id.get(cid)
        if crop is None:
            continue
        limit = crop.get("heat_limit_c")
        if limit is None:
            continue
        out.append((cid, float(limit)))
    return out


def frost_dates_for_year(month: np.ndarray, tmin: np.ndarray, frost_c: float, lat: float) -> tuple[int | None, int | None]:
    """Last spring frost and first fall frost as day-of-year, or None when that half has no frost day.

    A frost day is ``tmin <= frost_c`` (the feature-pipeline rule). Northern
    hemisphere: before 1 July, and on or after 1 July. Southern hemisphere: on
    or after 1 July, and before 1 July. ``month`` and ``tmin`` are one year, in
    day order. Day-of-year is the 1-based position in that array.
    """

    if month.size == 0 or month.shape != tmin.shape:
        return None, None
    cold = np.isfinite(tmin) & (tmin <= frost_c)
    if lat >= 0:
        spring = month < _FROST_SPLIT_MONTH_NORTH
    else:
        spring = month >= _FROST_SPLIT_MONTH_NORTH
    spring_idx = np.flatnonzero(cold & spring)
    fall_idx = np.flatnonzero(cold & ~spring)
    last_spring = int(spring_idx[-1]) + 1 if spring_idx.size else None
    first_fall = int(fall_idx[0]) + 1 if fall_idx.size else None
    return last_spring, first_fall


def build_climate_outlook(site_id: str, scenario_name: str = "baseline") -> dict:
    """ClimateOutlook for one curated (or located) site and one scenario preset."""

    daily, power_mode, _soil, info = base(site_id)
    scenario = P.resolve_scenario(scenario_name)
    adjusted = P.apply_scenario(daily, scenario)
    thresholds = P.baseline_thresholds(daily)
    frost_c = float(thresholds["frost_c"])
    extreme_mm = float(thresholds["extreme_rain_mm"])
    years = np.array(sorted(set(int(y) for y in daily.year.tolist())), dtype=np.int64)
    baseline_weekly = computed(site_id, P.resolve_scenario("baseline"))

    seasonal_temperature = _seasonal_temperature(daily, adjusted, years, info["lat"])
    heat = _heat_stress(site_id, daily, years, scenario, info["lat"])
    frost = _frost_windows(daily, adjusted, years, frost_c, info["lat"])
    rainfall = _rainfall(daily, adjusted, years, info["lat"], extreme_mm)
    et = _et_trend(daily, years)
    smap = _optional_weekly(seeds.load_smap(site_id), _gap_note(site_id, "smap", "No SMAP seed is stored for this site. The root-zone anomaly is null."))
    ecostress = _optional_number(seeds.load_ecostress(site_id), _gap_note(site_id, "ecostress", "No ECOSTRESS seed is stored for this site. The ET cross-check is null."))
    water = _water_balance(daily, adjusted, years, info["lat"], baseline_weekly)
    grace_doc = seeds.load_grace(site_id)
    optional_missing = smap["available"] is False or ecostress["available"] is False or grace_doc is None
    return {
        "site_id": site_id,
        "scenario": {**scenario, "ramp": {"shape": "linear", "years": HORIZON_YEARS_DEFAULT, "basis": "assumed"}},
        "data_mode": "limited_data" if optional_missing else power_mode,
        "seasonal_temperature": seasonal_temperature,
        "heat_stress_days": heat,
        "frost_windows": frost,
        "rainfall": rainfall,
        "et_and_soil_moisture": {"et0_trend": et, "smap_root_zone_anomaly": smap, "ecostress_et": ecostress},
        "water_balance": water,
        "groundwater": _groundwater(site_id, grace_doc),
        "sources": [dict(C.POWER_SOURCE)],
    }


def _seasonal_temperature(daily: P.Daily, adjusted: P.Daily, years: np.ndarray, lat: float) -> dict:
    out: dict = {
        "significance_alpha": _number(SIGNIFICANCE_ALPHA, "1", "assumed", "low"),
    }
    for season in SEASONS:
        observed = _seasonal_stat(daily, daily.v[P.T2M], years, season, lat, how="mean")
        slope, p = theil_sen_mann_kendall(observed[:, 0], observed[:, 1])
        scenario_values = _seasonal_stat(adjusted, adjusted.v[P.T2M], years, season, lat, how="mean")
        out[season] = {
            "observed": _trend(slope, p, "degC/year", "derived"),
            "scenario_mean": _dist_number(scenario_values[:, 1], "degC", "derived", "medium"),
        }
    return out


def _trend(slope: float, p: float, unit: str, basis: str) -> dict:
    if not math.isfinite(slope) or not math.isfinite(p):
        raise ApiError("DATA_SOURCE_UNAVAILABLE", "Not enough years to estimate a trend.", "The daily seed is missing a season.")
    p_out = round(p, 6) + 0.0
    return {
        "slope": _number(slope, unit, basis, "medium", nd=4),
        "mk_p_value": _number(p_out, "1", "derived", "medium", nd=6),
        "significant": bool(p_out < SIGNIFICANCE_ALPHA),
    }


def _heat_stress(site_id: str, daily: P.Daily, years: np.ndarray, scenario: dict, lat: float) -> list[dict]:
    """Days at or above the catalog heat limit. Year 1 is 1/10 of the preset offset; year 10 is the full offset."""

    del lat  # heat days use the daily maximum, not a seasonal window
    limits = heat_limits(preset_crop_ids(site_id))
    if not limits:
        return []
    by_year = [daily.v[P.TMAX][daily.year == int(y)] for y in years]
    horizon = HORIZON_YEARS_DEFAULT
    offsets = [float(scenario["temp_offset_c"]) * (year / horizon) for year in range(1, horizon + 1)]
    digest = request_hash({
        "climate_source": CLIMATE_SOURCE,
        "horizon_years": horizon,
        "members": ENSEMBLE_MEMBERS,
        "product": "climate_outlook",
        "scenario": scenario,
        "site_id": site_id,
    })
    picks = np.empty((ENSEMBLE_MEMBERS, horizon), dtype=np.int64)
    for member in range(ENSEMBLE_MEMBERS):
        rng = np.random.default_rng(member_seed(digest, member))
        picks[member] = rng.choice(len(by_year), size=horizon, replace=True)
    series: list[dict] = []
    for crop_id, limit in limits:
        table = _heat_table(by_year, limit, offsets)
        points = []
        for year_index in range(horizon):
            member_counts = table[picks[:, year_index], year_index]
            p10, p50, p90 = (round(float(v), 3) + 0.0 for v in np.percentile(member_counts, [10, 50, 90]))
            points.append({"year": year_index + 1, "p50": p50, "p10": p10, "p90": p90})
        series.append({
            "crop_id": crop_id,
            "heat_limit_c": _number(limit, "degC", "assumed", "low"),
            "days": {
                "metric": "heat_stress_days",
                "unit": "days",
                "basis": "derived",
                "confidence": "low",
                "needs_local_review": True,
                "points": points,
            },
        })
    return series


def _heat_table(by_year: list[np.ndarray], limit: float, offsets: list[float]) -> np.ndarray:
    table = np.zeros((len(by_year), len(offsets)), dtype=np.float64)
    for i, tmax in enumerate(by_year):
        finite = tmax[np.isfinite(tmax)]
        for j, offset in enumerate(offsets):
            table[i, j] = float(np.count_nonzero(finite >= (limit - offset)))
    return table


def _frost_windows(daily: P.Daily, adjusted: P.Daily, years: np.ndarray, frost_c: float, lat: float) -> dict:
    base_spring, base_fall, base_len = _frost_sample(daily, years, frost_c, lat)
    scen_spring, scen_fall, scen_len = _frost_sample(adjusted, years, frost_c, lat)
    n_years = int(years.size)
    spring_shift = _paired_shift(base_spring, scen_spring)
    fall_shift = _paired_shift(base_fall, scen_fall)
    return {
        "last_spring_frost": {
            "baseline_doy": _dist_number(base_spring, "doy", "derived", _sample_confidence(base_spring, n_years), center="median"),
            "scenario_shift_days": _dist_number(spring_shift, "days", "derived", _sample_confidence(spring_shift, n_years), center="median"),
        },
        "first_fall_frost": {
            "baseline_doy": _dist_number(base_fall, "doy", "derived", _sample_confidence(base_fall, n_years), center="median"),
            "scenario_shift_days": _dist_number(fall_shift, "days", "derived", _sample_confidence(fall_shift, n_years), center="median"),
        },
        "frost_free_season_days": {
            "baseline": _dist_number(base_len, "days", "derived", _sample_confidence(base_len, n_years), center="median"),
            "scenario": _dist_number(scen_len, "days", "derived", _sample_confidence(scen_len, n_years), center="median"),
        },
    }


def _frost_sample(daily: P.Daily, years: np.ndarray, frost_c: float, lat: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """NaN where that year has no frost in the half. Index i is ``years[i]`` so a scenario shift stays paired."""

    spring = np.full(years.size, np.nan)
    fall = np.full(years.size, np.nan)
    length = np.full(years.size, np.nan)
    for i, year in enumerate(years):
        sel = daily.year == int(year)
        order = np.argsort(daily.doy[sel], kind="mergesort")
        month = daily.month[sel][order]
        tmin = daily.v[P.TMIN][sel][order]
        if not np.isfinite(tmin).all():
            continue
        last_spring, first_fall = frost_dates_for_year(month, tmin, frost_c, lat)
        if last_spring is not None:
            spring[i] = last_spring
        if first_fall is not None:
            fall[i] = first_fall
        if last_spring is not None and first_fall is not None:
            length[i] = first_fall - last_spring
    return spring, fall, length


def _paired_shift(baseline: np.ndarray, scenario: np.ndarray) -> np.ndarray:
    both = np.isfinite(baseline) & np.isfinite(scenario)
    if not both.any():
        return np.asarray([], dtype=np.float64)
    return scenario[both] - baseline[both]


def _rainfall(daily: P.Daily, adjusted: P.Daily, years: np.ndarray, lat: float, extreme_mm: float) -> dict:
    totals = {}
    for season in SEASONS:
        base_vals = _seasonal_stat(daily, daily.v[P.RAIN], years, season, lat, how="sum")[:, 1]
        scen_vals = _seasonal_stat(adjusted, adjusted.v[P.RAIN], years, season, lat, how="sum")[:, 1]
        totals[season] = {
            "baseline": _dist_number(base_vals, "mm", "derived", "medium"),
            "scenario": _dist_number(scen_vals, "mm", "derived", "medium"),
        }
    base_extreme = _annual_extreme_days(daily, years, extreme_mm)
    scen_extreme = _annual_extreme_days(adjusted, years, extreme_mm)
    base_events = _annual_multi_day_events(daily, years, extreme_mm)
    scen_events = _annual_multi_day_events(adjusted, years, extreme_mm)
    return {
        "seasonal_totals": totals,
        "extreme_rain_days": {
            "baseline": _dist_number(base_extreme, "days/year", "derived", "medium"),
            "scenario": _dist_number(scen_extreme, "days/year", "derived", "medium"),
        },
        "multi_day_events": {
            "baseline": _dist_number(base_events, "events/year", "derived", "low"),
            "scenario": _dist_number(scen_events, "events/year", "derived", "low"),
        },
    }


def _annual_extreme_days(daily: P.Daily, years: np.ndarray, extreme_mm: float) -> np.ndarray:
    """Days at or above the baseline wet-day p95. The threshold is not recomputed under the scenario."""

    counts = []
    rain = daily.v[P.RAIN]
    for year in years:
        sel = daily.year == int(year)
        vals = rain[sel]
        if not np.isfinite(vals).all():
            continue
        counts.append(float(np.count_nonzero(vals >= extreme_mm)))
    return np.asarray(counts, dtype=np.float64)


def multi_day_event_count(rain: np.ndarray, extreme_mm: float) -> int:
    """One event is a run of overlapping windows whose total is at least ``multi_day_factor`` times ``extreme_mm``.

    The window length and factor are the assumed values in ``features.config.THRESHOLDS``.
    A window that contains a missing day does not qualify. Windows do not cross a year boundary;
    pass one year at a time.
    """

    window = int(C.THRESHOLDS["multi_day_window"])
    factor = float(C.THRESHOLDS["multi_day_factor"])
    if rain.size < window:
        return 0
    events = 0
    inside = False
    limit = factor * extreme_mm
    for i in range(rain.size - window + 1):
        chunk = rain[i : i + window]
        qualifies = bool(np.isfinite(chunk).all() and float(chunk.sum()) >= limit)
        if qualifies and not inside:
            events += 1
            inside = True
        elif not qualifies:
            inside = False
    return events


def _annual_multi_day_events(daily: P.Daily, years: np.ndarray, extreme_mm: float) -> np.ndarray:
    counts = []
    rain = daily.v[P.RAIN]
    for year in years:
        sel = daily.year == int(year)
        order = np.argsort(daily.doy[sel], kind="mergesort")
        vals = rain[sel][order]
        if not np.isfinite(vals).all():
            continue
        counts.append(float(multi_day_event_count(vals, extreme_mm)))
    return np.asarray(counts, dtype=np.float64)


def _et_trend(daily: P.Daily, years: np.ndarray) -> dict:
    et0 = P.et0_hargreaves(daily)
    totals = []
    used_years = []
    for year in years:
        sel = daily.year == int(year)
        vals = et0[sel]
        if not np.isfinite(vals).all():
            continue
        used_years.append(int(year))
        totals.append(float(vals.sum()))
    slope, p = theil_sen_mann_kendall(np.asarray(used_years, dtype=np.float64), np.asarray(totals, dtype=np.float64))
    return _trend(slope, p, "mm/year", "modeled")


def _water_balance(daily: P.Daily, adjusted: P.Daily, years: np.ndarray, lat: float, baseline_weekly) -> dict:
    """Weekly values are the baseline feature-table mean of rain minus reference ET0.

    Seasonal totals are daily sums of that same difference, baseline against the
    full preset (the year-10 end of the ramp). This is not the field water bucket.
    Irrigation, crop ET, runoff and drainage are the W6a engine and are not filled in here.
    """

    weekly = P._r(P._stats(baseline_weekly.grids["water_balance_mm"])["mean"])
    base_et = P.et0_hargreaves(daily)
    scen_et = P.et0_hargreaves(adjusted)
    base_bal = daily.v[P.RAIN] - base_et
    scen_bal = adjusted.v[P.RAIN] - scen_et
    seasonal = {}
    for season in SEASONS:
        seasonal[season] = {
            "baseline": _dist_number(_seasonal_stat(daily, base_bal, years, season, lat, how="sum")[:, 1], "mm", "modeled", "medium"),
            "scenario": _dist_number(_seasonal_stat(adjusted, scen_bal, years, season, lat, how="sum")[:, 1], "mm", "modeled", "medium"),
        }
    return {"unit": "mm", "basis": "modeled", "confidence": "medium", "weekly_mm": weekly, "seasonal": seasonal}


def _groundwater(site_id: str, doc: dict | None) -> dict:
    note = _gap_note(site_id, "grace", "No GRACE or GRACE-FO seed is stored for this site. Groundwater is regional context and is not scored. No trend is filled in.")
    trend = None
    available = False
    if isinstance(doc, dict):
        trend = _passthrough_number(doc.get("trend"))
        available = trend is not None
        file_note = doc.get("resolution_note")
        if available and isinstance(file_note, str) and file_note.strip():
            note = file_note
        elif doc is not None and trend is None:
            note = "A GRACE file is present but it has no trend number with unit, basis and confidence. No trend is filled in."
    return {"available": available, "scored": False, "resolution_note": note, "trend": trend}


def _optional_weekly(doc: dict | None, missing_note: str) -> dict:
    if not isinstance(doc, dict):
        return {"available": False, "resolution_note": missing_note, "weekly": None}
    weekly = doc.get("anomaly_weekly")
    note = doc.get("resolution_note")
    usable = (
        isinstance(weekly, list)
        and len(weekly) == 52
        and all(v is None or isinstance(v, (int, float)) for v in weekly)
        and isinstance(note, str)
        and note.strip()
    )
    if not usable:
        return {
            "available": False,
            "resolution_note": "A SMAP file is present but it has no anomaly_weekly series of 52 values with a resolution_note. The anomaly was not calculated from another quantity.",
            "weekly": None,
        }
    return {
        "available": True,
        "resolution_note": note,
        "weekly": [None if v is None else round(float(v), 3) + 0.0 for v in weekly],
    }


def _optional_number(doc: dict | None, missing_note: str) -> dict:
    if not isinstance(doc, dict):
        return {"available": False, "resolution_note": missing_note, "value": None}
    value = _passthrough_number(doc.get("value"))
    note = doc.get("resolution_note")
    if value is None or not isinstance(note, str) or not note.strip():
        return {
            "available": False,
            "resolution_note": "An ECOSTRESS file is present but it has no value number with unit, basis, confidence and a resolution_note. No cross-check was filled in.",
            "value": None,
        }
    return {"available": True, "resolution_note": note, "value": value}


def _passthrough_number(obj: object) -> dict | None:
    if not isinstance(obj, dict):
        return None
    if obj.get("basis") not in BASIS_VALUES or obj.get("confidence") not in CONFIDENCE_VALUES:
        return None
    unit = obj.get("unit")
    value = obj.get("value")
    if not isinstance(unit, str) or not unit or isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return _number(float(value), unit, str(obj["basis"]), str(obj["confidence"]))


def _gap_note(site_id: str, product: str, fallback: str) -> str:
    path = seeds.SEED_DIR / site_id / f"{product}.gap.json"
    if not path.is_file():
        return fallback
    reason = json_reason(path)
    return reason or fallback


def json_reason(path) -> str:
    try:
        reason = json.loads(path.read_text(encoding="utf-8")).get("reason")
    except (OSError, ValueError):
        return ""
    return reason.strip() if isinstance(reason, str) else ""


def _seasonal_stat(daily: P.Daily, values: np.ndarray, years: np.ndarray, season: str, lat: float, how: str) -> np.ndarray:
    """Column 0 is the year, column 1 is the seasonal mean or sum. Years with a missing day are dropped."""

    months = P.season_months(season, lat)
    rows = []
    for year in years:
        sel = (daily.year == int(year)) & np.isin(daily.month, months)
        chunk = values[sel]
        if chunk.size == 0 or not np.isfinite(chunk).all():
            continue
        stat = float(chunk.mean() if how == "mean" else chunk.sum())
        rows.append((int(year), stat))
    if not rows:
        raise ApiError("DATA_SOURCE_UNAVAILABLE", f"No complete {season} values in the daily series.", "Check the POWER seed for this site.")
    return np.asarray(rows, dtype=np.float64)


def _sample_confidence(values: np.ndarray, n_years: int) -> str:
    finite = int(np.isfinite(values).sum()) if values.size else 0
    if finite == 0:
        raise ApiError("DATA_SOURCE_UNAVAILABLE", "No frost date in the daily series.", "The frost window is not filled with a placeholder date.")
    return "medium" if finite == n_years else "low"


def _dist_number(values: np.ndarray, unit: str, basis: str, confidence: str, center: str = "mean") -> dict:
    finite = np.asarray(values, dtype=np.float64)
    finite = finite[np.isfinite(finite)]
    if finite.size == 0:
        raise ApiError("DATA_SOURCE_UNAVAILABLE", "A climate statistic had no finite years.", "The number is omitted rather than filled.")
    p10, p50, p90 = (float(v) for v in np.percentile(finite, [10, 50, 90]))
    central = p50 if center == "median" else float(finite.mean())
    return _number(central, unit, basis, confidence, p10=p10, p50=p50, p90=p90)


def _number(value: float, unit: str, basis: str, confidence: str, p10: float | None = None, p50: float | None = None, p90: float | None = None, nd: int = 3) -> dict:
    out = {"value": round(float(value), nd) + 0.0, "unit": unit, "basis": basis, "confidence": confidence}
    if p10 is not None:
        out["p10"] = round(float(p10), nd) + 0.0
        out["p50"] = round(float(p50 if p50 is not None else value), nd) + 0.0
        out["p90"] = round(float(p90), nd) + 0.0
    return out
