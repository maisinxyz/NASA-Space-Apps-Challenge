"""Vulnerability zones (backend rotation PRD §12.2, A7). Derived from terrain layers, never field-measured.

Erosion risk: steep and high flow accumulation (both above the field's p80, assumed).
Frost pockets: lowest 10% of the field (assumed), where cold air would pool.
Water stress needs soil + soil-moisture anomaly on a terrain grid; no site has both yet, so it is not produced.
"""

from __future__ import annotations

import numpy as np
from PIL import Image
from rasterio.features import shapes
from rasterio.transform import Affine
from scipy import ndimage

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
