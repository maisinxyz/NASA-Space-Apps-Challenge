"""Grid utilities for terrain processing (BE-01, Prompt 29).

Key responsibilities
--------------------
1. ``utm_epsg_for_bbox``  — pick the best local UTM EPSG for a WGS84 bbox.
2. ``choose_grid_size``   — compute (width, height, cell_m) so the longer side
   is ≤ MAX_GRID_SIDE cells, honouring native resolution.
3. ``reproject_and_resample`` — rasterio-based reprojection to a local UTM grid.
4. ``fill_nodata``        — fill small gaps (interpolation), mask large ones,
   report nodata_fraction.
5. ``content_hash``       — deterministic SHA256 key for caching.

All geometry follows the convention:
    WGS84 bbox = (minLon, minLat, maxLon, maxLat)
    UTM metres  — x east, y north
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import rasterio

log = logging.getLogger("fieldtwin.terrain.grid")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_GRID_SIDE = 512          # longest side of any output grid (PRD §6.2 / BE-01)
NODATA_FILL_MAX_FRAC = 0.30  # gaps > 30 % of area → raise TERRAIN_COVERAGE_MISSING
NODATA_HOLE_MAX_CELLS = 500  # contiguous hole larger than this is NOT interpolated


# ---------------------------------------------------------------------------
# 1. UTM zone selection
# ---------------------------------------------------------------------------

def utm_epsg_for_bbox(
    bbox_wgs84: tuple[float, float, float, float],
) -> str:
    """Return the EPSG code of the local UTM zone for the centre of *bbox_wgs84*.

    Parameters
    ----------
    bbox_wgs84 : (minLon, minLat, maxLon, maxLat) in decimal degrees (WGS84).

    Returns
    -------
    str  — e.g. ``"EPSG:32611"`` (UTM zone 11N) or ``"EPSG:32711"`` (zone 11S).

    Algorithm
    ---------
    UTM zone number  = floor((lon + 180) / 6) + 1   (1–60)
    Northern codes   = 32600 + zone
    Southern codes   = 32700 + zone
    Special Norway / Svalbard cases are not needed for the BC-focused MVP but
    can be added later.  Source: EPSG registry guidance.
    """
    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    centre_lon = (min_lon + max_lon) / 2.0
    centre_lat = (min_lat + max_lat) / 2.0

    zone = int((centre_lon + 180.0) / 6.0) + 1
    if centre_lat >= 0.0:
        epsg = 32600 + zone    # Northern hemisphere
    else:
        epsg = 32700 + zone    # Southern hemisphere

    return f"EPSG:{epsg}"


# ---------------------------------------------------------------------------
# 2. Grid-size selection
# ---------------------------------------------------------------------------

def choose_grid_size(
    bbox_wgs84: tuple[float, float, float, float],
    native_resolution_m: float,
    *,
    max_side: int = MAX_GRID_SIDE,
) -> tuple[int, int, float]:
    """Choose (width, height, cell_m) for the output raster.

    Rules (from BE-01 / PRD §6.2):
    - cell_m is native_resolution_m, unless that would make either dimension
      exceed *max_side* cells.
    - If it would, we scale up cell_m so that the LONGER side == max_side.
    - Both width and height are at least 1.

    Returns
    -------
    (width, height, cell_m)
        width  — columns (east–west extent / cell_m)
        height — rows   (north–south extent / cell_m)
        cell_m — actual cell size chosen, in metres
    """
    # Approximate physical extent (metres) using the equirectangular projection
    # centred on the mid latitude.  Good to <1 % for areas up to ~200 km.
    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    centre_lat_rad = np.radians((min_lat + max_lat) / 2.0)
    metres_per_deg_lon = 111_320.0 * np.cos(centre_lat_rad)
    metres_per_deg_lat = 111_132.0

    east_m  = abs(max_lon - min_lon) * metres_per_deg_lon
    north_m = abs(max_lat - min_lat) * metres_per_deg_lat

    cell_m = float(native_resolution_m)

    # Scale up cell_m if needed so longer side ≤ max_side.
    max_extent = max(east_m, north_m)
    if cell_m > 0 and max_extent / cell_m > max_side:
        cell_m = max_extent / max_side

    width  = max(1, int(round(east_m  / cell_m)))
    height = max(1, int(round(north_m / cell_m)))

    # Clamp again (rounding can push one side over by 1).
    if max(width, height) > max_side:
        scale = max(width, height) / max_side
        width  = max(1, int(width  / scale))
        height = max(1, int(height / scale))

    return width, height, cell_m


# ---------------------------------------------------------------------------
# 3. Reproject and resample (rasterio)
# ---------------------------------------------------------------------------

def reproject_and_resample(
    src_array: np.ndarray,          # 2-D float32
    src_crs: str,                   # e.g. "EPSG:4326"
    src_transform,                  # rasterio Affine
    dst_crs: str,                   # e.g. "EPSG:32611"
    dst_width: int,
    dst_height: int,
    dst_transform,                  # rasterio Affine
    nodata_value: float = -9999.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproject *src_array* into the target CRS / grid.

    Parameters
    ----------
    src_array : float32 2-D ndarray (1-band raster)
    src_crs   : source CRS as EPSG string or WKT
    src_transform : rasterio Affine for the source
    dst_crs   : target CRS
    dst_width / dst_height : output dimensions
    dst_transform : rasterio Affine for the output
    nodata_value : value used to mark nodata in both input and output

    Returns
    -------
    (data, nodata_mask)
        data       — float32 array, shape (dst_height, dst_width)
        nodata_mask — bool array,   shape (dst_height, dst_width), True == nodata
    """
    import rasterio
    from rasterio.crs import CRS
    from rasterio.enums import Resampling
    from rasterio.transform import from_bounds, from_origin
    from rasterio.warp import reproject

    src = src_array.astype(np.float32)

    dst = np.full((dst_height, dst_width), nodata_value, dtype=np.float32)

    reproject(
        source=src,
        destination=dst,
        src_crs=CRS.from_string(src_crs),
        dst_crs=CRS.from_string(dst_crs),
        src_transform=src_transform,
        dst_transform=dst_transform,
        src_nodata=nodata_value,
        dst_nodata=nodata_value,
        resampling=Resampling.bilinear,
    )

    nodata_mask = (dst == nodata_value) | ~np.isfinite(dst)
    return dst, nodata_mask


# ---------------------------------------------------------------------------
# 4. Nodata gap-filling
# ---------------------------------------------------------------------------

def fill_nodata(
    z: np.ndarray,
    nodata: np.ndarray,
    *,
    max_hole_cells: int = NODATA_HOLE_MAX_CELLS,
    nodata_fill_max_frac: float = NODATA_FILL_MAX_FRAC,
) -> tuple[np.ndarray, np.ndarray]:
    """Fill small nodata holes by inpainting; mask large ones.

    Strategy
    --------
    - Identify connected components of nodata cells (4-connectivity).
    - Components ≤ *max_hole_cells*: fill by distance-weighted mean of the
      ``FILL_RADIUS``-cell neighbourhood of valid values (simple inpainting
      that avoids scipy.ndimage dependency on Windows where it may not ship
      with rasterio builds).  Falls back to scipy.ndimage if available.
    - Components > *max_hole_cells*: left as nodata.
    - After filling, if remaining nodata fraction > *nodata_fill_max_frac*,
      raise ``ApiError("TERRAIN_COVERAGE_MISSING")``.

    Returns
    -------
    (filled_z, remaining_nodata)
        filled_z         — float32, same shape as z
        remaining_nodata — bool mask after filling small holes
    """
    from app.core.errors import ApiError

    if not nodata.any():
        return z.astype(np.float32, copy=False), nodata.copy()

    filled = z.astype(np.float32, copy=True)
    remaining = nodata.copy()

    # -- label connected components (4-connectivity) -------------------------
    labeled, n_components = _label_components(nodata)

    for lbl in range(1, n_components + 1):
        mask = labeled == lbl
        if mask.sum() <= max_hole_cells:
            # Small hole: fill with distance-weighted average of near neighbours
            filled[mask] = _fill_hole_values(filled, mask, nodata)
            remaining[mask] = False

    # -- check total remaining nodata ----------------------------------------
    frac = float(remaining.sum()) / remaining.size
    if frac > nodata_fill_max_frac:
        raise ApiError(
            "TERRAIN_COVERAGE_MISSING",
            f"Source has {frac:.0%} nodata after gap-filling — coverage too sparse.",
            hint="Try a curated site or expand the bounding box.",
        )

    return filled, remaining


def _label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """Label connected components of True cells (4-connectivity)."""
    try:
        from scipy.ndimage import label as scipy_label  # type: ignore[import]
        labeled, n = scipy_label(mask)
        return labeled, int(n)
    except ImportError:
        pass
    # Fallback: BFS
    h, w = mask.shape
    labeled = np.zeros_like(mask, dtype=np.int32)
    n = 0
    for r in range(h):
        for c in range(w):
            if mask[r, c] and labeled[r, c] == 0:
                n += 1
                _bfs_label(mask, labeled, r, c, h, w, n)
    return labeled, n


def _bfs_label(
    mask: np.ndarray,
    labeled: np.ndarray,
    r0: int, c0: int,
    h: int, w: int,
    lbl: int,
) -> None:
    queue = [(r0, c0)]
    labeled[r0, c0] = lbl
    while queue:
        r, c = queue.pop()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w and mask[rr, cc] and labeled[rr, cc] == 0:
                labeled[rr, cc] = lbl
                queue.append((rr, cc))


def _fill_hole_values(
    z: np.ndarray,
    hole_mask: np.ndarray,
    nodata_mask: np.ndarray,
    radius: int = 5,
) -> np.ndarray:
    """Return fill values for hole cells using mean of nearby valid neighbours."""
    rows, cols = np.where(hole_mask)
    fills = np.empty(len(rows), dtype=np.float32)
    for i, (r, c) in enumerate(zip(rows, cols)):
        r_lo = max(0, r - radius)
        r_hi = min(z.shape[0], r + radius + 1)
        c_lo = max(0, c - radius)
        c_hi = min(z.shape[1], c + radius + 1)
        patch = z[r_lo:r_hi, c_lo:c_hi]
        valid_mask = ~nodata_mask[r_lo:r_hi, c_lo:c_hi]
        vals = patch[valid_mask]
        fills[i] = float(vals.mean()) if vals.size else 0.0
    return fills


# ---------------------------------------------------------------------------
# 5. Content hash for caching
# ---------------------------------------------------------------------------

def content_hash(
    bbox_wgs84: tuple[float, float, float, float],
    cell_size_m: float,
    source_versions: dict[str, str],
    *,
    precision: int = 6,
) -> str:
    """Return a deterministic SHA-256 hex digest for a (bbox, cell, sources) key.

    Parameters
    ----------
    bbox_wgs84      : (minLon, minLat, maxLon, maxLat)
    cell_size_m     : target cell size in metres
    source_versions : mapping of source-name → version/checksum string
                      (e.g. {"hrdem": "2024-01", "nasadem": "v001"})
    precision       : decimal places to round coordinate components to.

    Returns
    -------
    64-character lower-case hex string.
    """
    rounded_bbox = tuple(round(v, precision) for v in bbox_wgs84)
    rounded_cell = round(cell_size_m, 4)
    # Sort source_versions so dict ordering doesn't affect the hash.
    canonical = {
        "bbox": rounded_bbox,
        "cell_m": rounded_cell,
        "sources": dict(sorted(source_versions.items())),
    }
    payload = json.dumps(canonical, separators=(",", ":"), sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()


# ---------------------------------------------------------------------------
# 6. Build a rasterio Affine transform for a UTM output grid
# ---------------------------------------------------------------------------

def make_utm_transform(
    bbox_wgs84: tuple[float, float, float, float],
    dst_crs: str,
    dst_width: int,
    dst_height: int,
):
    """Return a rasterio Affine transform for the UTM output grid.

    The transform is derived by projecting the WGS84 bbox corners to UTM.
    Origin is the top-left corner (north-west) of the top-left pixel.
    """
    from rasterio.crs import CRS
    from rasterio.transform import from_bounds
    from rasterio.warp import transform_bounds

    min_lon, min_lat, max_lon, max_lat = bbox_wgs84
    src_crs = CRS.from_epsg(4326)
    dst_crs_obj = CRS.from_string(dst_crs)

    # Project bbox corners to UTM.
    min_x, min_y, max_x, max_y = transform_bounds(
        src_crs, dst_crs_obj,
        left=min_lon, bottom=min_lat, right=max_lon, top=max_lat,
    )

    transform = from_bounds(min_x, min_y, max_x, max_y, dst_width, dst_height)
    return transform, (min_x, min_y, max_x, max_y)
