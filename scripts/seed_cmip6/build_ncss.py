"""Build data/seed/<site>/cmip6_delta.json.gz from NASA NEX-GDDP-CMIP6 by point subsetting. Seed build only.

No bulk download: the NCCS THREDDS NetCDF Subset Service (NCSS) returns one grid point for one file as a small CSV
(about 366 rows for a year, no login). Catalog, dataset paths and the NCSS parameters were read from
https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6/catalog.xml and tested 2026-11-15.
Dataset: NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6), 0.25 degree, daily
``tasmax``, ``tasmin``, ``pr`` (https://www.nccs.nasa.gov/data-collections/nex-gddp-cmip6/).

Delta definition (what ``app.twin.climate.season_deltas`` reads): for each meteorological season, the model's mean
over FUTURE_YEARS minus (or divided by) its mean over BASELINE_YEARS, one number per model. The file stores the
median and the min/max of the model ensemble as p50 / p10 / p90 (the spread of a few models, not a probability).
The engine ramps the value from year 1 to year 10, so FUTURE_YEARS are centred on year 10 of the horizon.

Licence: the AWS registry says CC0 and one file's ``cmip6_license`` attribute says CC-BY-SA 4.0
(see docs/progress/FT-EB4.md). The stricter terms are followed: the sidecar credits NASA NEX-GDDP-CMIP6 and the
CMIP6 modelling groups, and the derived seasonal numbers are marked CC-BY-SA 4.0. TODO(verify) with NCCS.

    services/api/.venv/Scripts/python.exe scripts/seed_cmip6/build_ncss.py --sites site_ubc_farm site_kpu_langley
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "data" / "seed"
CACHE = ROOT / "data" / "cache" / "cmip6_ncss"  # git-ignored
THREDDS = "https://ds.nccs.nasa.gov/thredds"
GDDP = "AMES/NEX/GDDP-CMIP6"
UA = "FieldTwin-NASA-SpaceApps/1.0 (student project)"

# Assumed choices, not published recommendations. TODO(verify) with a climate scientist.
BASELINE_YEARS = range(1995, 2015)  # last 20 years of the historical run (it ends 2014)
FUTURE_YEARS = range(2031, 2041)  # ten years centred on year 10 of a 2026 start
SCENARIOS = {"ssp245": "ssp245", "ssp585": "ssp585"}  # keys the engine maps from the contract presets
CANDIDATE_MODELS = ["ACCESS-CM2", "ACCESS-ESM1-5", "BCC-CSM2-MR", "CMCC-ESM2", "CNRM-CM6-1", "CanESM5", "MRI-ESM2-0", "NorESM2-LM"]
WANT_MODELS = 4
VARS = ("tasmax", "tasmin", "pr")
SEASONS = {"winter": (12, 1, 2), "spring": (3, 4, 5), "summer": (6, 7, 8), "fall": (9, 10, 11)}


def _get(url: str, timeout: int = 90) -> bytes:
    last: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 404):
                raise
            last = exc
        except Exception as exc:  # network blips
            last = exc
        time.sleep(2**attempt)
    raise RuntimeError(f"GET failed after retries: {url.split('?')[0]} ({last})")


def _catalog(path: str) -> tuple[list[str], list[str]]:
    """(child catalog names, dataset urlPaths) of one THREDDS catalog."""
    text = _get(f"{THREDDS}/catalog/{path}/catalog.xml").decode("utf-8", "ignore")
    return re.findall(r'xlink:href="([^"/]+)/catalog\.xml"', text), re.findall(r'urlPath="([^"]+)"', text)


def season_of(month: int) -> str:
    return next(name for name, months in SEASONS.items() if month in months)


def seasonal_means(rows: list[tuple[date, float]]) -> dict[str, float]:
    """Mean per meteorological season. December belongs to the following winter only by month, which is fine for a mean."""
    acc: dict[str, list[float]] = defaultdict(list)
    for day, value in rows:
        acc[season_of(day.month)].append(value)
    return {s: sum(v) / len(v) for s, v in acc.items() if v}


def model_delta(base: dict[str, dict[str, float]], fut: dict[str, dict[str, float]]) -> dict[str, dict[str, float]]:
    """Per season: temperature change (degC, mean of tasmax and tasmin changes) and precipitation change (percent)."""
    out: dict[str, dict[str, float]] = {}
    for season in SEASONS:
        try:
            t = ((fut["tasmax"][season] - base["tasmax"][season]) + (fut["tasmin"][season] - base["tasmin"][season])) / 2
            p = (fut["pr"][season] / base["pr"][season] - 1.0) * 100.0
        except (KeyError, ZeroDivisionError):
            continue
        out[season] = {"temp_delta_c": t, "precip_delta_pct": p}
    return out


def ensemble(deltas: list[dict[str, dict[str, float]]]) -> dict[str, dict[str, dict[str, float]]]:
    """Median (p50) and min/max (p10/p90 labels) across models, rounded to 3 decimals."""
    out: dict[str, dict[str, dict[str, float]]] = {}
    for season in SEASONS:
        cell: dict[str, dict[str, float]] = {}
        for key in ("temp_delta_c", "precip_delta_pct"):
            vals = sorted(d[season][key] for d in deltas if season in d)
            if vals:
                cell[key] = {"p10": round(vals[0], 3), "p50": round(statistics.median(vals), 3), "p90": round(vals[-1], 3), "n_models": len(vals)}
        if cell:
            out[season] = cell
    return out


def _year_series(path: str, var: str, lat: float, lon: float, year: int) -> list[tuple[date, float]]:
    """One variable, one year, one grid point, as (day, value) with temperatures in degC and rain in mm/day."""
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / f"{path.rsplit('/', 1)[-1]}__{lat:.4f}_{lon:.4f}.csv"
    if key.is_file():
        text = key.read_text(encoding="utf-8")
    else:
        east = lon % 360.0  # files use 0-360 longitude
        url = (
            f"{THREDDS}/ncss/grid/{path}?var={var}&latitude={lat}&longitude={east}"
            f"&time_start={year}-01-01T00:00:00Z&time_end={year}-12-31T23:59:59Z&accept=csv"
        )
        text = _get(url).decode("utf-8", "ignore")
        key.write_text(text, encoding="utf-8")
    rows = list(csv.reader(io.StringIO(text)))
    out: list[tuple[date, float]] = []
    for r in rows[1:]:
        if len(r) < 5:
            continue
        v = float(r[4])
        if var == "pr":
            v *= 86400.0  # kg m-2 s-1 -> mm/day
        else:
            v -= 273.15  # K -> degC
        out.append((date.fromisoformat(r[0][:10]), v))
    return out


def _dataset_paths(model: str, scenario: str) -> dict[str, dict[int, str]] | None:
    """{var: {year: urlPath}} for one model and scenario, or None when a variable is missing."""
    try:
        members, _ = _catalog(f"{GDDP}/{model}/{scenario}")
    except urllib.error.HTTPError:
        return None
    if not members:
        return None
    ripf = sorted(members)[0]
    out: dict[str, dict[int, str]] = {}
    for var in VARS:
        try:
            _, paths = _catalog(f"{GDDP}/{model}/{scenario}/{ripf}/{var}")
        except urllib.error.HTTPError:
            return None
        by_year: dict[int, str] = {}
        for p in sorted(paths):  # later names (v2.0) win over earlier ones
            m = re.search(r"_(\d{4})(?:_v[\d.]+)?\.nc$", p)
            if m:
                by_year[int(m.group(1))] = p
        out[var] = by_year
    return out


def _means(paths: dict[str, dict[int, str]], years: range, lat: float, lon: float, pool: ThreadPoolExecutor) -> dict[str, dict[str, float]]:
    jobs = [(var, y, paths[var][y]) for var in VARS for y in years if y in paths[var]]
    need = len(VARS) * len(years)
    if len(jobs) < need:
        raise RuntimeError(f"missing years: {need - len(jobs)} of {need}")
    results = list(pool.map(lambda j: (j[0], _year_series(j[2], j[0], lat, lon, j[1])), jobs))
    per_var: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for var, rows in results:
        per_var[var].extend(rows)
    return {var: seasonal_means(rows) for var, rows in per_var.items()}


def build_site(site_id: str, lat: float, lon: float, workers: int) -> dict:
    scenarios: dict[str, dict] = {}
    used: dict[str, list[str]] = {s: [] for s in SCENARIOS}
    per_scn: dict[str, list[dict]] = {s: [] for s in SCENARIOS}
    pool = ThreadPoolExecutor(max_workers=workers)
    kept = 0
    for model in CANDIDATE_MODELS:
        if kept >= WANT_MODELS:
            break
        try:
            hist = _dataset_paths(model, "historical")
            futs = {s: _dataset_paths(model, scn) for s, scn in SCENARIOS.items()}
            if hist is None or any(v is None for v in futs.values()):
                print(f"  skip {model}: no historical/ssp245/ssp585 set with {VARS}", flush=True)
                continue
            base = _means(hist, BASELINE_YEARS, lat, lon, pool)
            ready = {s: model_delta(base, _means(futs[s], FUTURE_YEARS, lat, lon, pool)) for s in SCENARIOS}
        except Exception as exc:
            print(f"  skip {model}: {exc}", flush=True)
            continue
        for s in SCENARIOS:
            per_scn[s].append(ready[s])
            used[s].append(model)
        kept += 1
        print(f"  {site_id} {model} done ({kept}/{WANT_MODELS})", flush=True)
    pool.shutdown()
    if kept == 0:
        raise RuntimeError("no model produced a delta")
    for s in SCENARIOS:
        scenarios[s] = ensemble(per_scn[s])
    return {"scenarios": scenarios, "models": used}


def write_seed(site_id: str, lat: float, lon: float, built: dict) -> None:
    folder = SEED / site_id
    doc = {
        "site_id": site_id,
        "layer": "cmip6_delta",
        "product": {"short_name": "NEX-GDDP-CMIP6", "version": "v2.0 files via NCCS THREDDS NCSS"},
        "native_resolution_m": 25000,
        "point": {"lat": lat, "lon": lon},
        "baseline_years": [BASELINE_YEARS.start, BASELINE_YEARS.stop - 1],
        "future_years": [FUTURE_YEARS.start, FUTURE_YEARS.stop - 1],
        "definition": "Per season: mean of (tasmax change, tasmin change) in degC, and percent change of mean daily pr. Future window minus baseline window, per model; p50 is the median over models and p10/p90 are the lowest/highest model, not probabilities.",
        "basis": "modeled",
        "models": built["models"],
        "scenarios": built["scenarios"],
        "retrieved_on": date.today().isoformat(),
    }
    with gzip.open(folder / "cmip6_delta.json.gz", "wt", encoding="utf-8") as fh:
        json.dump(doc, fh, sort_keys=True, separators=(",", ":"))
    meta = {
        "source_name": "NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6)",
        "source_url": "https://www.nccs.nasa.gov/data-collections/nex-gddp-cmip6/",
        "access": f"{THREDDS}/ncss/grid/{GDDP}/<model>/<scenario>/<variant>/<var>/<file>.nc (point subset, CSV)",
        "product_version": doc["product"]["version"],
        "license": "CC BY-SA 4.0 for these combined deltas; sampled NCCS v2.0 input files report CC BY-SA 4.0 for temperature and CC BY 4.0 for precipitation.",
        "resolution_spatial": "0.25 degrees",
        "resolution_temporal": "daily",
        "attribution": "NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6), NASA Center for Climate Simulation, and the CMIP6 modelling groups listed in `models`.",
        "native_resolution_m": 25000,
        "retrieved_on": date.today().isoformat(),
        "processing_notes": "Point subset of the 0.25 degree grid cell containing the site; no bias correction beyond NEX's own. Seasonal deltas of a few models are scenario context, not a forecast.",
    }
    (folder / "cmip6_delta.meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    gap = folder / "cmip6_delta.gap.json"
    if gap.is_file():
        gap.unlink()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sites", nargs="+", default=["site_ubc_farm", "site_kpu_langley"])
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args(argv)
    sys.path.insert(0, str(ROOT / "services" / "api"))
    from app.features.config import CURATED_SITES

    for site_id in args.sites:
        info = CURATED_SITES[site_id]
        lat, lon = float(info["lat"]), float(info["lon"])
        print(f"{site_id}: {lat}, {lon}", flush=True)
        built = build_site(site_id, lat, lon, args.workers)
        write_seed(site_id, lat, lon, built)
        print(f"{site_id}: wrote cmip6_delta.json.gz from {len(built['models']['ssp245'])} models", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
