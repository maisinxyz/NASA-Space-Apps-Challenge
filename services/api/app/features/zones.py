"""Vulnerability zones (backend rotation PRD §12.2, A7). Derived from terrain layers, never field-measured.

Erosion risk: steep and high flow accumulation (both above the field's p80, assumed).
Frost pockets: lowest 10% of the field (assumed), where cold air would pool.
Water stress needs soil + soil-moisture anomaly on a terrain grid; no site has both yet, so it is not produced.

A curated DEM seed is separate from the terrain PNG path. Slope uses the stored cell size.
The moisture seed is one time series, so water stress is one farm outline, not a pixel map.
"""

from __future__ import annotations

import gzip
import json
import math

import numpy as np
from PIL import Image
from rasterio.features import shapes
from rasterio.transform import Affine
from scipy import ndimage

from app.features import seeds
from app.services import terrain as terrain_svc

EROSION_PCT = 80  # assumed
FROST_PCT = 10  # assumed
MIN_AREA_HA = 0.05  # assumed: drop specks
MAX_PER_KIND = 5
NOTE = "Derived from terrain and soil data, not field-measured."


def _layer(tid: str, name: str, value_range: tuple[float, float]) -> np.ndarray:
    b = np.asarray(Image.open(terrain_svc.asset_path(tid, f"layers/{name}.png")), float)
    lo, hi = value_range
    return np.where(b == 255, np.nan, lo + b / 254 * (hi - lo))


def _ranges(tid: str) -> dict[str, tuple[float, float]]:
    return {l["name"]: tuple(l["value_range"]) for l in terrain_svc.get_layers(tid)["layers"] if l.get("value_range")}


def _components(mask: np.ndarray, tf: np.ndarray, transform: Affine, cell_m: float, kind: str, label: str, basis: str) -> list[dict]:
    lab, n = ndimage.label(mask)
    zones = []
    for i in range(1, n + 1):
        comp = lab == i
        area_ha = comp.sum() * cell_m**2 / 10_000
        if area_ha < MIN_AREA_HA:
            continue
        geom = max((g for g, v in shapes(comp.astype(np.uint8), mask=comp, transform=transform) if v == 1),
                   key=lambda g: len(g["coordinates"][0]))
        dist = ndimage.distance_transform_edt(comp)
        r, c = np.unravel_index(int(np.argmax(dist)), dist.shape)  # pole of inaccessibility (cell centre)
        lon, lat = transform @ (c + 0.5, r + 0.5)
        zones.append({
            "kind": kind,
            "label": label,
            "note": NOTE,
            "outline": {"type": "Polygon", "coordinates": [[[round(x, 6), round(y, 6)] for x, y in ring] for ring in geom["coordinates"]]},
            "icon_point": [round(lon, 6), round(lat, 6)],
            "area_ha": round(float(area_ha), 3),
            "terrain_factor": round(float(np.nanmean(tf[comp])), 3),
            "field_id": None,
            "crop": None,
            "winter_exposure": None,
            "summer_exposure": None,
            "basis": basis,
        })
    zones.sort(key=lambda z: (-z["area_ha"], z["icon_point"]))
    return zones[:MAX_PER_KIND]


# Spherical degrees from metres. TODO(verify) against Snyder, J.P. 1987. Map Projections — A Working Manual.
# USGS Professional Paper 1395. https://pubs.usgs.gov/pp/1395/report.pdf
_M_PER_DEG = 111_320.0


def _read_elevation_file(path) -> dict | None:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        doc = json.load(handle)
    if not isinstance(doc, dict) or doc.get("elevation") is None:
        return None
    return doc


def read_elevation(site_id: str) -> tuple[dict | None, str]:
    """Prefer ``dem_hrdem.json.gz`` when it is stored. Otherwise ``load_dem``.

    Returns ``(None, "")`` when neither file has an elevation grid. The caller
    keeps the empty zone collection in that case.
    """

    preferred = seeds.SEED_DIR / site_id / "dem_hrdem.json.gz"
    if preferred.is_file():
        doc = _read_elevation_file(preferred)
        if doc is not None:
            return doc, "dem_hrdem"
    doc = seeds.load_dem(site_id)
    if doc is None:
        return None, ""
    return doc, "dem"


def _metres_to_degrees(lat: float, metres: float) -> tuple[float, float]:
    """East and north degree steps for one cell. Assumed spherical radius."""

    scale = max(math.cos(math.radians(lat)), 1e-6)
    return metres / (_M_PER_DEG * scale), metres / _M_PER_DEG


def zones_from_elevation(doc: dict, smap: dict | None = None) -> tuple[list[dict], list[str]]:
    """Erosion and frost polygons inside one DEM clip, plus one farm water-stress zone.

    ``smap`` is the weekly seed document. A resolution coarser than the clip, or a
    seed that is only a time series, becomes one polygon with ``resolution_note``.
    """

    caveats = [NOTE]
    elev = np.asarray(doc.get("elevation"), dtype=np.float64)
    if elev.ndim != 2 or elev.size == 0 or not np.isfinite(elev).any():
        return [], caveats + ["The elevation grid was empty, so no zones were drawn."]
    try:
        res_m = float(doc["res_m"])
        origin = doc["origin"]
        lon0, lat0 = float(origin[0]), float(origin[1])
    except (KeyError, TypeError, ValueError, IndexError):
        return [], caveats + ["The elevation grid has no cell size or origin, so no zones were drawn."]
    if not math.isfinite(res_m) or res_m <= 0:
        return [], caveats + ["The elevation cell size was not a positive number of metres, so no zones were drawn."]

    dlon, dlat = _metres_to_degrees(lat0, res_m)
    transform = Affine(dlon, 0, lon0 - dlon / 2, 0, -dlat, lat0 + dlat / 2)
    finite = np.isfinite(elev)
    gy, gx = np.gradient(np.where(finite, elev, np.nanmean(elev[finite])), res_m, res_m)
    slope = np.hypot(gx, gy)
    slope = np.where(finite, slope, np.nan)
    mean_slope = float(np.nanmean(slope))
    tf = slope / mean_slope if mean_slope > 0 else np.ones_like(slope)
    erosion = finite & (slope >= np.nanpercentile(slope, EROSION_PCT))
    frost = finite & (elev <= np.nanpercentile(elev, FROST_PCT))
    out = _components(
        erosion, tf, transform, res_m, "erosion_risk",
        "Steep cells in this elevation clip. Flow accumulation was not in the seed, so the cut is slope only.",
        "derived",
    )
    out += _components(
        frost, tf, transform, res_m, "frost_pocket",
        "Low cells in this elevation clip, a simple cold-air pocket indicator.",
        "relative",
    )
    clip_m = max(elev.shape) * res_m
    if smap is not None:
        resolution = smap.get("native_resolution_m")
        resolution_m = float(resolution) if isinstance(resolution, (int, float)) and not isinstance(resolution, bool) else None
        note = (
            "The moisture seed is one time series for the site. "
            f"The elevation clip is about {clip_m:.0f} m across. "
        )
        if resolution_m is None:
            note += "No native resolution was stored, so this is one farm value and not a pixel map."
        elif resolution_m >= clip_m:
            note += (
                f"The product resolution is {resolution_m:.0f} m, coarser than the clip. "
                "One farm-level zone. Sub-field moisture polygons were not drawn."
            )
        else:
            note += (
                f"The product resolution is {resolution_m:.0f} m. The stored seed is still one series, "
                "so one farm-level zone was returned."
            )
        moisture = _components(
            finite, np.ones_like(elev), transform, res_m, "water_stress",
            "One farm-level moisture zone from the site series.",
            "relative",
        )
        for zone in moisture[:1]:
            zone["resolution_note"] = note
            zone["terrain_factor"] = 1.0
            out.append(zone)
    bare = doc.get("bare_earth")
    if bare is False:
        caveat = "This surface is not bare earth. Canopy or buildings may raise it."
        caveats.append(caveat)
        for zone in out:
            if zone["kind"] != "water_stress":
                zone["note"] = f"{zone['note']} {caveat}"
    elif bare is None or bare == "unknown":
        caveats.append("The elevation product did not say whether the surface is bare earth.")
    for i, zone in enumerate(out):
        zone["id"] = f"zone_{zone['kind']}_{i + 1}"
    return out, caveats


def zones_from_seed(site_id: str, smap: dict | None = None) -> tuple[list[dict], list[str]] | None:
    """Zones from a stored elevation file. None when no file is stored."""

    doc, _which = read_elevation(site_id)
    if doc is None:
        return None
    return zones_from_elevation(doc, smap)


def spatial_limits(*, dem_present: bool, moisture_present: bool) -> list[str]:
    """Notes for layers that are missing or coarser than a field. No polygons are built here."""
    notes = []
    if not dem_present:
        notes.append("No elevation grid is stored. Erosion zones and frost pockets were not drawn.")
    if not moisture_present:
        notes.append(
            "No SMAP or ECOSTRESS grid is stored. No water-stress value was produced, including at farm scale."
        )
    return notes


def zones_for_terrain(tid: str) -> list[dict]:
    pkg = terrain_svc.get_terrain(tid)
    w, s, e, n = pkg["bbox_wgs84"]
    H, W = pkg["grid"]["height"], pkg["grid"]["width"]
    transform = Affine((e - w) / W, 0, w, 0, -(n - s) / H, n)  # row 0 = north edge
    ranges = _ranges(tid)
    slope = _layer(tid, "slope", ranges["slope"])
    flow = _layer(tid, "flow_accumulation", ranges["flow_accumulation"])
    # terrain_factor: relative, field mean = 1 (equal weight on slope and log flow; assumed weights)
    tf = 0.5 * slope / np.nanmean(slope) + 0.5 * flow / np.nanmean(flow)
    erosion = (slope >= np.nanpercentile(slope, EROSION_PCT)) & (flow >= np.nanpercentile(flow, EROSION_PCT))

    hm = np.asarray(Image.open(terrain_svc.asset_path(tid, "heightmap.png")), float)
    elev = pkg["elevation"]["min_m"] + hm / 65535 * (pkg["elevation"]["max_m"] - pkg["elevation"]["min_m"])
    frost = elev <= np.percentile(elev, FROST_PCT)

    cell = pkg["grid"]["cell_size_m"]
    out = _components(erosion, tf, transform, cell, "erosion_risk", "Steep path where runoff gathers: higher erosion risk", "relative")
    out += _components(frost, tf, transform, cell, "frost_pocket", "Low spot where cold air can pool: frost pocket", "relative")
    for i, z in enumerate(out):
        z["id"] = f"zone_{z['kind']}_{i + 1}"
    return out
