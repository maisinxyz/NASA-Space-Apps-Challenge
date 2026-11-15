"""Feature pipeline (Backend A, backend rotation PRD §7): NASA POWER daily -> 52-week feature table.

load -> clean (missing stays NaN, never filled) -> scenario adjust -> weekly per-year grids -> climatology.
Pure numpy, no random numbers: same inputs give byte-identical JSON.

Week index: 7-day blocks from 1 January, `min((doy - 1) // 7, 51)`, so days 358-366 fold into week 51.
(Not ISO weeks: ISO week-years straddle 1 January and would split a year's days across two years.)
"""

from __future__ import annotations

import math
import warnings
from dataclasses import dataclass, replace

import numpy as np

from app.core.errors import ApiError
from app.features import config as C

RAIN, T2M, TMAX, TMIN, WROOT, WTOP = "PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "GWETROOT", "GWETTOP"
POWER_VARS = (RAIN, T2M, TMAX, TMIN, WROOT, WTOP)
FEATURE_OF_VAR = {RAIN: "rain_mm", T2M: "tmean_c", TMAX: "tmax_c", TMIN: "tmin_c", WROOT: "soil_wetness_root", WTOP: "soil_wetness_top"}


@dataclass(frozen=True)
class Daily:
    lat: float
    year: np.ndarray
    month: np.ndarray
    doy: np.ndarray
    week: np.ndarray
    v: dict  # POWER parameter -> float array, NaN = missing


def daily_from_power(result: dict, lat: float) -> Daily:
    """Validated POWER result (app.weather.power) -> aligned daily arrays."""
    params = result["parameters"]
    keys = sorted(params[T2M])
    days = np.array([f"{k[:4]}-{k[4:6]}-{k[6:]}" for k in keys], dtype="datetime64[D]")
    year_start = days.astype("datetime64[Y]")
    doy = (days - year_start.astype("datetime64[D]")).astype(int) + 1
    v = {n: np.array([np.nan if params[n].get(k) is None else float(params[n][k]) for k in keys]) for n in POWER_VARS}
    return Daily(
        lat=lat,
        year=year_start.astype(int) + 1970,
        month=days.astype("datetime64[M]").astype(int) % 12 + 1,
        doy=doy,
        week=np.minimum((doy - 1) // 7, C.WEEKS - 1),
        v=v,
    )


# ---------------------------------------------------------------- scenario (PRD §12.1)
def season_months(season: str, lat: float) -> tuple[int, ...]:
    months = C.SEASON_MONTHS_NORTH[season]
    return months if lat >= 0 else tuple((m + 5) % 12 + 1 for m in months)


def resolve_scenario(preset: str = "baseline", rain_scale_pct=None, temp_offset_c=None, rain_scale_by_season=None) -> dict:
    """Preset plus optional custom values (custom overrides preset). Raises SCENARIO_OUT_OF_RANGE."""
    if preset not in C.SCENARIO_PRESETS:
        raise ApiError("INVALID_INPUT", f"Unknown scenario '{preset}'.", f"Use one of: {', '.join(C.SCENARIO_PRESETS)}.")
    base = C.SCENARIO_PRESETS[preset]
    rain = float(base["rain_scale_pct"] if rain_scale_pct is None else rain_scale_pct)
    temp = float(base["temp_offset_c"] if temp_offset_c is None else temp_offset_c)
    seasonal = dict(base["rain_scale_by_season"] if rain_scale_by_season is None else rain_scale_by_season)
    lo, hi = C.RAIN_SCALE_RANGE
    for name, val in [("rain_scale_pct", rain), *((f"rain_scale_by_season.{k}", x) for k, x in seasonal.items())]:
        if not lo <= val <= hi:
            raise ApiError("SCENARIO_OUT_OF_RANGE", f"{name} = {val} is outside {lo} to {hi} %.", "Move the rain slider back inside the range.")
    if not C.TEMP_OFFSET_RANGE[0] <= temp <= C.TEMP_OFFSET_RANGE[1]:
        raise ApiError("SCENARIO_OUT_OF_RANGE", f"temp_offset_c = {temp} is outside {C.TEMP_OFFSET_RANGE[0]} to {C.TEMP_OFFSET_RANGE[1]} degC.", "Move the temperature slider back inside the range.")
    unknown = set(seasonal) - set(C.SEASON_MONTHS_NORTH)
    if unknown:
        raise ApiError("INVALID_INPUT", f"Unknown season(s): {', '.join(sorted(unknown))}.", "Use winter, spring, summer or fall.")
    return {
        "preset": preset,
        "rain_scale_pct": rain,
        "temp_offset_c": temp,
        "rain_scale_by_season": {k: float(seasonal[k]) for k in sorted(seasonal)},
        "label": "modeled scenario, not a forecast",
        "note": "built from observed years",
    }


def apply_scenario(d: Daily, s: dict) -> Daily:
    """Scale daily rain (seasonal values override the global one) and shift every temperature."""
    factor = np.full(d.year.shape, 1 + s["rain_scale_pct"] / 100)
    for season, pct in s["rain_scale_by_season"].items():
        factor[np.isin(d.month, season_months(season, d.lat))] = 1 + pct / 100
    v = dict(d.v)
    v[RAIN] = d.v[RAIN] * factor
    for t in (T2M, TMAX, TMIN):
        v[t] = d.v[t] + s["temp_offset_c"]
    return replace(d, v=v)


# ---------------------------------------------------------------- daily helpers
def extraterrestrial_radiation(lat_deg: float, doy: np.ndarray) -> np.ndarray:
    """Ra, MJ m-2 day-1. FAO-56 eq. 21-25: https://www.fao.org/4/x0490e/x0490e07.htm"""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    delta = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-math.tan(phi) * np.tan(delta), -1, 1))
    return 24 * 60 / np.pi * 0.0820 * dr * (ws * math.sin(phi) * np.sin(delta) + math.cos(phi) * np.cos(delta) * np.sin(ws))


def et0_hargreaves(d: Daily) -> np.ndarray:
    """Hargreaves-Samani (1985) reference ET, mm/day: 0.0023 * 0.408 * Ra * (Tmean + 17.8) * sqrt(Tmax - Tmin).

    0.408 converts MJ m-2 day-1 to mm/day. Form per Droogers & Allen 2002 (Irrigation and Drainage Systems 16:33-45)
    and https://biomet.ucdavis.edu/doc/PMmondoc.pdf . Clipped at 0 for very cold days.
    """
    ra = extraterrestrial_radiation(d.lat, d.doy)
    td = np.clip(d.v[TMAX] - d.v[TMIN], 0, None)
    return np.clip(0.0023 * 0.408 * ra * (d.v[T2M] + 17.8) * np.sqrt(td), 0, None)


def in_runs(mask: np.ndarray, n: int) -> np.ndarray:
    """True on every day that belongs to a run of at least n consecutive True days."""
    edges = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    out = np.zeros(mask.shape, bool)
    for s, e in zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)):
        if e - s >= n:
            out[s:e] = True
    return out


def _flag(mask: np.ndarray, *inputs: np.ndarray) -> np.ndarray:
    """Bool mask -> float flag, NaN where any input is missing."""
    f = mask.astype(float)
    for x in inputs:
        f[np.isnan(x)] = np.nan
    return f


def baseline_thresholds(d: Daily) -> dict:
    t = {k: v for k, v in C.THRESHOLDS.items() if k in (
        "frost_c", "heat_c", "extreme_rain_percentile", "wet_day_mm", "dry_day_mm", "dry_spell_days", "wet_ground_percentile", "vulnerable_prob")}
    rain = d.v[RAIN]
    wet = rain[rain >= t["wet_day_mm"]]
    t["extreme_rain_mm"] = round(float(np.percentile(wet, t["extreme_rain_percentile"])), 3)
    t["wet_ground_value"] = round(float(np.nanpercentile(d.v[WTOP], t["wet_ground_percentile"])), 3)
    return t


def daily_flags(d: Daily, t: dict) -> dict[str, np.ndarray]:
    rain, tmin, tmax = d.v[RAIN], d.v[TMIN], d.v[TMAX]
    known_rain = ~np.isnan(rain)
    prev_top = np.concatenate([[np.nan], d.v[WTOP][:-1]])
    w, fac = C.THRESHOLDS["multi_day_window"], C.THRESHOLDS["multi_day_factor"]
    window = np.convolve(np.nan_to_num(rain), np.ones(w), "valid") >= fac * t["extreme_rain_mm"]
    multi = np.zeros(rain.shape, bool)
    for k in range(w):
        multi[k : k + window.size] |= window
    lo, hi = C.THRESHOLDS["late_frost_doy_north" if d.lat >= 0 else "late_frost_doy_south"]
    return {
        "extreme_rain": _flag(rain >= t["extreme_rain_mm"], rain),
        "dry_spell": _flag(in_runs(known_rain & (rain < t["dry_day_mm"]), t["dry_spell_days"]), rain),
        "heavy_rain_wet_ground": _flag((rain >= t["extreme_rain_mm"]) & (prev_top >= t["wet_ground_value"]), rain, prev_top),
        "multi_day_heavy_rain": _flag(multi, rain),
        "heat_spell": _flag(in_runs(tmax >= t["heat_c"], C.THRESHOLDS["heat_spell_days"]), tmax),
        "late_frost": _flag((tmin <= t["frost_c"]) & (d.doy >= lo) & (d.doy <= hi), tmin),
    }


# ---------------------------------------------------------------- weekly grids
def weekly(d: Daily, x: np.ndarray, how: str) -> tuple[list[int], np.ndarray]:
    """Per-year x 52-week grid. A week with any missing day is NaN (never filled)."""
    years = sorted(set(d.year.tolist()))
    n = len(years) * C.WEEKS
    idx = (d.year - years[0]) * C.WEEKS + d.week
    missing = np.bincount(idx, weights=np.isnan(x), minlength=n)
    count = np.bincount(idx, minlength=n)
    if how in ("sum", "mean"):
        out = np.bincount(idx, weights=np.nan_to_num(x), minlength=n)
        if how == "mean":
            out = out / np.maximum(count, 1)
    else:
        out = np.full(n, -np.inf if how == "max" else np.inf)
        (np.maximum if how == "max" else np.minimum).at(out, idx, np.nan_to_num(x, nan=0.0))
    out[(missing > 0) | (count == 0)] = np.nan
    return years, out.reshape(len(years), C.WEEKS)


def _r(a, nd: int = 3) -> list:
    return [None if not math.isfinite(x) else round(float(x), nd) + 0.0 for x in np.asarray(a, float)]


def _stats(grid: np.ndarray) -> dict:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return {
            "mean": np.nanmean(grid, 0),
            "std": np.nanstd(grid, 0),
            "median": np.nanmedian(grid, 0),
            "p10": np.nanpercentile(grid, 10, 0),
            "p90": np.nanpercentile(grid, 90, 0),
        }


def series(grid: np.ndarray, years: list[int], unit: str, basis: str, description: str) -> dict:
    out = {"unit": unit, "basis": basis, "description": description}
    out.update({k: _r(v) for k, v in _stats(grid).items()})
    out["by_year"] = {str(y): _r(row) for y, row in zip(years, grid)}
    return out


def anomaly(grid: np.ndarray, base: np.ndarray) -> np.ndarray:
    """(x - weekly normal) / weekly std of the baseline grid; 0 where std is 0."""
    st = _stats(base)
    std = st["std"]
    z = (grid - st["mean"]) / np.where(std > 0, std, 1)
    return np.where(std > 0, z, np.where(np.isnan(grid), np.nan, 0.0))


@dataclass(frozen=True)
class Computed:
    years: list[int]
    grids: dict[str, np.ndarray]  # feature id -> grid
    hazard_grids: dict[str, np.ndarray]  # hazard kind -> weekly 0/1 flags
    thresholds: dict
    scenario: dict
    missing_fraction: dict[str, float]
    years_available: int


def compute(base: Daily, scenario: dict) -> Computed:
    """All weekly grids for one scenario. Thresholds and anomaly normals always come from the baseline."""
    t = baseline_thresholds(base)
    d = apply_scenario(base, scenario)
    years, _ = weekly(d, d.v[T2M], "mean")
    g: dict[str, np.ndarray] = {}
    for var, fid in FEATURE_OF_VAR.items():
        how = {RAIN: "sum", TMAX: "max", TMIN: "min"}.get(var, "mean")
        g[fid] = weekly(d, d.v[var], how)[1]
    g["rain_max_day_mm"] = weekly(d, d.v[RAIN], "max")[1]
    g["soil_moisture_anomaly"] = anomaly(g["soil_wetness_root"], weekly(base, base.v[WROOT], "mean")[1])
    g["et0_mm"] = weekly(d, et0_hargreaves(d), "sum")[1]
    g["water_balance_mm"] = g["rain_mm"] - g["et0_mm"]
    g["frost_prob"] = np.where(np.isnan(g["tmin_c"]), np.nan, (g["tmin_c"] <= t["frost_c"]).astype(float))
    g["heat_prob"] = np.where(np.isnan(g["tmax_c"]), np.nan, (g["tmax_c"] >= t["heat_c"]).astype(float))
    hz = {k: weekly(d, f, "max")[1] for k, f in daily_flags(d, t).items()}
    g["extreme_rain_prob"] = hz.pop("extreme_rain")
    g["dry_spell_prob"] = hz["dry_spell"]
    core = (RAIN, TMAX, TMIN)
    complete = [y for y in years if not any(np.isnan(base.v[v][base.year == y]).any() for v in core)]
    return Computed(
        years=years,
        grids=g,
        hazard_grids=hz,
        thresholds=t,
        scenario=scenario,
        missing_fraction={FEATURE_OF_VAR[v]: round(float(np.isnan(base.v[v]).mean()), 4) for v in POWER_VARS},
        years_available=len(complete),
    )


FEATURE_META = {
    "rain_mm": ("mm", "derived", "Weekly rain total (PRECTOTCORR sum)."),
    "rain_max_day_mm": ("mm", "derived", "Wettest day in the week."),
    "tmean_c": ("degC", "derived", "Weekly mean of daily mean temperature (T2M)."),
    "tmax_c": ("degC", "derived", "Weekly maximum of daily maximum temperature (T2M_MAX)."),
    "tmin_c": ("degC", "derived", "Weekly minimum of daily minimum temperature (T2M_MIN)."),
    "soil_wetness_root": ("fraction", "modeled", "Root-zone soil wetness 0-1 (GWETROOT), weekly mean."),
    "soil_wetness_top": ("fraction", "modeled", "Top-soil wetness 0-1 (GWETTOP), weekly mean."),
    "soil_moisture_anomaly": ("sigma", "derived", "Root-zone wetness minus the baseline weekly normal, in baseline standard deviations. Not adjusted by scenarios."),
    "et0_mm": ("mm", "modeled", "Weekly reference evapotranspiration, Hargreaves-Samani from temperature."),
    "water_balance_mm": ("mm", "modeled", "Weekly rain minus reference evapotranspiration."),
    "frost_prob": ("fraction", "derived", "Mean = share of years whose weekly minimum is at or below frost_c."),
    "heat_prob": ("fraction", "derived", "Mean = share of years whose weekly maximum is at or above heat_c."),
    "extreme_rain_prob": ("fraction", "derived", "Mean = share of years with at least one day at or above extreme_rain_mm."),
    "dry_spell_prob": ("fraction", "derived", "Mean = share of years in which the week is inside a dry spell (dry_spell_days in a row below dry_day_mm)."),
}


def vulnerable_weeks(table: dict, in_ground_weeks, threshold: float | None = None) -> list[dict]:
    """PRD §7.4 helper for Backend B: weeks with a crop in the ground where a hazard share exceeds the threshold.

    Returns VulnerableSeason items (one per hazard that fires), weeks ascending.
    """
    thr = table["thresholds"]["vulnerable_prob"] if threshold is None else threshold
    weeks = sorted(set(in_ground_weeks))
    out = []
    for h in ("frost_prob", "heat_prob", "dry_spell_prob", "extreme_rain_prob"):
        mean = table["features"][h]["mean"]
        hit = [w for w in weeks if mean[w] is not None and mean[w] > thr]
        if hit:
            out.append({"weeks": hit, "hazards": [h]})
    return out
