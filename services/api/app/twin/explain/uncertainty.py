"""Uncertainty table from seed sidecars. A missing resolution is omitted, not invented."""

from __future__ import annotations

import gzip
import json
from functools import lru_cache

import numpy as np

from app.core.config import REPO_ROOT
from app.features import config as C
from app.features import pipeline as P
from app.features import seeds
from app.features.pipeline import weekly_seed_grid

SEED = REPO_ROOT / "data" / "seed"

# Assumed cuts. TODO(verify) against a field-size rule and a cloud-screen rule before treating them as measured.
_COARSE_M = 1000.0
_FEW_SCENES = 0.5
_HIGH_YEARS = 5
_HIGH_COVERAGE = 0.7
_MEDIUM_COVERAGE = 0.3

# Candidate products named in the gap files. Their titles are not a retrieved resolution.
# native_resolution_m stays off the row until a sidecar stores a number.


def _meta(site_id: str, stem: str) -> dict | None:
    path = SEED / site_id / f"{stem}.meta.json"
    if not path.is_file():
        return None
    doc = json.loads(path.read_text(encoding="utf-8"))
    return doc if isinstance(doc, dict) else None


def _record_years(meta: dict | None) -> str:
    if not meta:
        return "none"
    notes = str(meta.get("processing_notes") or "")
    if "1991-01-01" in notes and "2024-12-31" in notes:
        return "1991-2024"
    retrieved = meta.get("retrieved_on")
    if isinstance(retrieved, str) and retrieved.strip():
        return retrieved.strip()
    return "none"


def _weekly_file(site_id: str, name: str) -> dict | None:
    """Weekly seed. ``imerg`` has no loader in ``seeds.py``, so this reads the gzip itself."""

    if name == "imerg":
        path = SEED / site_id / "imerg.json.gz"
        if not path.is_file():
            return None
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            doc = json.load(handle)
        if not isinstance(doc, dict) or not isinstance(doc.get("weekly"), list):
            return None
        return doc
    loader = {
        "ndvi": seeds.load_ndvi,
        "smap": seeds.load_smap,
        "ecostress": seeds.load_ecostress,
        "grace": seeds.load_grace,
    }.get(name)
    if loader is None:
        return None
    return loader(site_id)


def _coverage(doc: dict) -> tuple[list[int], float | None]:
    years, _grid = weekly_seed_grid(doc)
    if not years:
        return [], None
    total = 0
    seen = 0
    for row in doc.get("weekly") or []:
        if not isinstance(row, dict):
            continue
        values = row.get("values")
        obs = row.get("n_obs")
        if not isinstance(values, list) or len(values) != C.WEEKS:
            continue
        if not isinstance(obs, list) or len(obs) != C.WEEKS:
            return years, None
        for week, count in enumerate(obs):
            total += 1
            try:
                if values[week] is not None and int(count) > 0:
                    seen += 1
            except (TypeError, ValueError):
                return years, None
    if total == 0:
        return years, None
    return years, seen / total


def _confidence(n_years: int, coverage: float | None) -> str:
    """Rises only when a series is actually stored. The cuts are assumed."""

    if coverage is None or n_years < 2:
        return "low"
    if n_years >= _HIGH_YEARS and coverage >= _HIGH_COVERAGE:
        return "high"
    if coverage >= _MEDIUM_COVERAGE:
        return "medium"
    return "low"


def _resolution_m(doc: dict) -> float | None:
    value = doc.get("native_resolution_m")
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        return None
    return float(value)


def _span(years: list[int]) -> str:
    if not years:
        return "none"
    if years[0] == years[-1]:
        return str(years[0])
    return f"{years[0]}-{years[-1]}"


def _corr_bias(left: np.ndarray, right: np.ndarray) -> tuple[float | None, float | None, int]:
    mask = np.isfinite(left) & np.isfinite(right)
    n = int(mask.sum())
    if n < 2:
        return None, None, n
    a = left[mask]
    b = right[mask]
    bias = float(np.mean(a - b))
    az = a - np.mean(a)
    bz = b - np.mean(b)
    denom = float(np.sqrt(np.sum(az * az) * np.sum(bz * bz)))
    if denom == 0:
        return None, bias, n
    return float(np.sum(az * bz) / denom), bias, n


def _fmt_check(name: str, value: float | None, unit: str, n: int) -> str:
    if value is None:
        return f"{name} was not computed ({n} overlapping weeks)."
    return f"{name} {value:.3f} {unit}, basis derived, confidence low, n={n} weeks"


@lru_cache(maxsize=8)
def _engine_weeks(site_id: str) -> dict[int, dict[str, np.ndarray]] | None:
    """Rainfed weekly bucket for the preset's first crop. None when soil or weather is missing.

    Coefficients in ``water.py`` are unchanged. Each year starts at profile capacity,
    which is the engine default. Irrigation is off so the run does not assume a schedule.
    """

    from app.rotation.config import DEFAULT_PRESET, SITE_PRESETS
    from app.services.features import base, site_info
    from app.twin.catalog import load_catalog
    from app.twin.config import taw_mm_per_m
    from app.twin.types import IrrigationCfg, PlanYear, Slot, SoilProps, State, WeatherYear
    from app.twin.water import run_water_year, year_profile

    summary = seeds.load_soil(site_id)
    if summary is None:
        return None
    try:
        daily = base(site_id)[0]
        info = site_info(site_id)
    except (KeyError, TypeError, ValueError):
        return None
    years, rain = P.weekly(daily, daily.v[P.RAIN], "sum")
    _, tmax = P.weekly(daily, daily.v[P.TMAX], "max")
    _, tmin = P.weekly(daily, daily.v[P.TMIN], "min")
    _, et0 = P.weekly(daily, P.et0_hargreaves(daily), "sum")
    preset = SITE_PRESETS.get(site_id, DEFAULT_PRESET)
    crop_id = next((main for _year, main, _off in preset["slots"] if main != "fallow"), None)
    if crop_id is None:
        return None
    catalog = load_catalog()
    plan_year = PlanYear(1, (Slot(1, "summer", crop_id),))
    profile = year_profile(plan_year, catalog, float(info["lat"]))
    soil = SoilProps(
        taw_mm_per_m(float(summary["sand_pct"]), float(summary["silt_pct"]), float(summary["clay_pct"])),
        float(summary["sand_pct"]),
        float(summary["silt_pct"]),
        float(summary["clay_pct"]),
        float(summary["soc_g_per_kg"]) / 10.0,
    )
    state = State(0.0, 0.0, 100.0, 0.0, {})
    depth_m = max(float(np.max(profile.root_m)), 1e-6)
    out: dict[int, dict[str, np.ndarray]] = {}
    for index, year in enumerate(years):
        weather = WeatherYear(int(year), tmax[index], tmin[index], rain[index], et0[index])
        result = run_water_year(
            plan_year, weather, soil, state, IrrigationCfg(False),
            catalog=catalog, lat=float(info["lat"]), profile=profile,
        )
        out[int(year)] = {
            "vwc": np.asarray(result.storage_end_mm, dtype=np.float64) / (depth_m * 1000.0),
            "etc": np.asarray(result.etc_mm, dtype=np.float64),
            "rain": np.asarray(result.rain_mm, dtype=np.float64),
        }
    return out


def _aligned(engine: dict[int, dict[str, np.ndarray]] | None, doc: dict, key: str) -> tuple[np.ndarray, np.ndarray]:
    years, grid = weekly_seed_grid(doc)
    if engine is None or not years:
        return np.zeros(0), np.zeros(0)
    left, right = [], []
    for row, year in enumerate(years):
        series = engine.get(int(year))
        if series is None:
            continue
        left.append(series[key])
        right.append(grid[row])
    if not left:
        return np.zeros(0), np.zeros(0)
    return np.concatenate(left), np.concatenate(right)


def _hindcast_sentence(engine: dict | None, doc: dict, kind: str) -> str:
    if kind == "imerg":
        left, right = _aligned(engine, doc, "rain")
        unit = doc.get("unit") if isinstance(doc.get("unit"), str) else ""
        corr, bias, n = _corr_bias(left, right)
        text = "POWER weekly rain versus IMERG. " + _fmt_check("correlation", corr, "1", n)
        if unit in {"mm", "mm/week", "mm/wk"}:
            text += " " + _fmt_check("bias (POWER minus IMERG)", bias, unit, n)
        else:
            text += " Bias was not converted because the IMERG unit is not millimetres per week."
        return text + " Basis derived."
    if engine is None:
        return "The weekly bucket was not run because soil or weather was missing. No coefficient was changed."
    if kind == "smap":
        left, right = _aligned(engine, doc, "vwc")
        corr, bias, n = _corr_bias(left, right)
        return (
            "Engine root-zone storage divided by that run's deepest root, versus SMAP. "
            "Rainfed, preset crop, each year starts full. Water-model coefficients were not changed. "
            + _fmt_check("correlation", corr, "1", n) + " "
            + _fmt_check("bias (engine minus SMAP)", bias, "m3/m3", n)
        )
    left, right = _aligned(engine, doc, "etc")
    unit = doc.get("unit") if isinstance(doc.get("unit"), str) else ""
    corr, bias, n = _corr_bias(left, right)
    text = (
        "Modeled crop ET versus ECOSTRESS. Rainfed preset crop. Water-model coefficients were not changed. "
        + _fmt_check("correlation", corr, "1", n)
    )
    if unit in {"mm", "mm/week", "mm/wk"}:
        text += " " + _fmt_check("bias (engine minus ECOSTRESS)", bias, "mm", n)
    else:
        text += " Bias was not converted because the ECOSTRESS unit is not millimetres per week."
    return text


def _series_layer(site_id: str, name: str, doc: dict, extra: str) -> dict | None:
    resolution = _resolution_m(doc)
    years, coverage = _coverage(doc)
    if resolution is None or not years:
        return None
    cover = "n_obs was not stored." if coverage is None else f"n_obs coverage {coverage:.2f} of year-weeks (derived)."
    return {
        "layer": name,
        "native_resolution_m": resolution,
        "record_years": _span(years),
        "confidence": _confidence(len(set(years)), coverage),
        "resolution_note": f"{cover} {extra}".strip(),
        "needs_local_validation": True,
    }


def quality_issues(site_id: str) -> list[dict]:
    """Data-quality notes for layers that exist. Missing layers stay on ``gap_notes``."""

    issues = []
    for name in ("ndvi", "smap", "ecostress", "grace", "imerg"):
        doc = _weekly_file(site_id, name)
        if doc is None:
            continue
        resolution = _resolution_m(doc)
        _years, coverage = _coverage(doc)
        if resolution is None:
            issues.append({
                "layer": name,
                "rule": "resolution_not_stored",
                "text": f"{name} is stored, and native_resolution_m was not, so no metre value was invented.",
            })
        elif resolution >= _COARSE_M:
            issues.append({
                "layer": name,
                "rule": "coarse_pixel",
                "text": (
                    f"{name} native resolution is {resolution:.0f} m, which is at least {_COARSE_M:.0f} m. "
                    "That cut is assumed. The value is one pixel, not a map inside the field."
                ),
            })
        if name in {"ndvi", "ecostress"} and coverage is not None and coverage < _FEW_SCENES:
            issues.append({
                "layer": name,
                "rule": "few_cloud_free_scenes",
                "text": (
                    f"{name} has n_obs on {coverage:.0%} of its year-weeks. "
                    f"Below {_FEW_SCENES:.0%} is treated as few cloud-free scenes. That cut is assumed."
                ),
            })
    from app.features.zones import read_elevation

    dem, _which = read_elevation(site_id)
    if dem is not None and dem.get("bare_earth") is False:
        issues.append({
            "layer": "dem",
            "rule": "non_bare_earth",
            "text": "The elevation surface is not bare earth. Canopy or buildings may raise it.",
        })
    return issues


def uncertainty_layers(site_id: str) -> list[dict]:
    """Layers that already have a sourced resolution in metres.

    POWER uses the 55 km figure published on ``POWER_SOURCE``. SoilGrids uses 250 m
    when ``soil.json`` is present. Satellite gap files say the resolution was not
    retrieved, so those products are not given a made-up metre value.
    """

    layers = []
    power_meta = _meta(site_id, "power_daily")
    layers.append({
        "layer": "nasa_power",
        "native_resolution_m": float(C.POWER_SOURCE["resolution_m"]),
        "record_years": _record_years(power_meta) if power_meta else "1991-2024",
        "confidence": "medium",
        "resolution_note": C.POWER_RESOLUTION_NOTE,
        "needs_local_validation": True,
    })
    if seeds.load_soil(site_id) is not None:
        layers.append({
            "layer": "soilgrids",
            "native_resolution_m": float(C.SOILGRIDS_SOURCE["resolution_m"]),
            "record_years": _record_years(_meta(site_id, "soil")),
            "confidence": "low",
            "resolution_note": C.SOILGRIDS_RESOLUTION_NOTE,
            "needs_local_validation": True,
        })
    weekly = {name: _weekly_file(site_id, name) for name in ("ndvi", "smap", "ecostress", "grace", "imerg")}
    engine = _engine_weeks(site_id) if any(weekly[name] is not None for name in ("smap", "ecostress", "imerg")) else None
    notes = {
        "ndvi": "NDVI record. Not scored against the water bucket.",
        "smap": _hindcast_sentence(engine, weekly["smap"], "smap") if weekly["smap"] else "",
        "ecostress": _hindcast_sentence(engine, weekly["ecostress"], "ecostress") if weekly["ecostress"] else "",
        "grace": "Regional context only. This layer was not scored against the field water balance.",
        "imerg": _hindcast_sentence(engine, weekly["imerg"], "imerg") if weekly["imerg"] else "",
    }
    for name, doc in weekly.items():
        if doc is None:
            continue
        row = _series_layer(site_id, name, doc, notes[name])
        if row is not None:
            layers.append(row)
    from app.features.zones import read_elevation

    dem, _which = read_elevation(site_id)
    if dem is not None:
        resolution = _resolution_m(dem)
        if resolution is None:
            cell = dem.get("res_m")
            if isinstance(cell, (int, float)) and not isinstance(cell, bool) and cell > 0:
                resolution = float(cell)
        if resolution is not None:
            bare = dem.get("bare_earth")
            if bare is False:
                bare_note = "The surface is not bare earth. Canopy or buildings may raise it."
                dem_confidence = "low"
            elif bare is True:
                bare_note = "The product says this grid is bare earth."
                dem_confidence = "medium"
            else:
                bare_note = "The product did not say whether the surface is bare earth."
                dem_confidence = "low"
            layers.append({
                "layer": "dem",
                "native_resolution_m": resolution,
                "record_years": "one grid",
                "confidence": dem_confidence,
                "resolution_note": f"Cell size {resolution:.0f} m. One elevation grid, no weekly n_obs. {bare_note}",
                "needs_local_validation": True,
            })
    return layers


def station_bias(site_id: str) -> dict | None:
    """POWER minus a daily station series. None when the station file was not stored.

    UBC Farm's ``station_gap.json`` says the ECCC product was not copied into the
    repo. This function does not fill a bias from the climate normals page.
    """

    gap = SEED / site_id / "station_gap.json"
    if gap.is_file():
        doc = json.loads(gap.read_text(encoding="utf-8"))
        if isinstance(doc, dict) and doc.get("status") == "not_included":
            return None
    daily = None
    for name in ("station_daily.json", "station_daily.json.gz"):
        path = SEED / site_id / name
        if path.is_file():
            daily = path
            break
    if daily is None:
        return None
    # A stored daily file would be differenced here. No curated site has one yet,
    # and this branch does not invent the column layout.
    _ = daily
    return None


def gap_notes(site_id: str) -> list[str]:
    """One sentence per satellite product whose loader returns None."""

    named = (
        ("ndvi", seeds.load_ndvi, "No NDVI seed is stored."),
        ("smap", seeds.load_smap, "No SMAP seed is stored. A field moisture map was not produced."),
        ("ecostress", seeds.load_ecostress, "No ECOSTRESS seed is stored."),
        ("grace", seeds.load_grace, "No GRACE-FO seed is stored."),
        ("dem", seeds.load_dem, "No DEM seed is stored. Zones are not drawn from an elevation grid."),
    )
    notes = []
    for _name, loader, sentence in named:
        if loader(site_id) is None:
            notes.append(sentence)
    return notes
