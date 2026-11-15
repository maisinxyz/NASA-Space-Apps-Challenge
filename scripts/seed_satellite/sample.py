"""NDVI and Fmask for one HLS window. No network.

Band names, scale, fill, and Fmask bits are from the HLS User Guide V2
(https://lpdaac.usgs.gov/documents/1698/HLS_User_Guide_V2.pdf, Table 6, Table 7,
and Table 9, read 2026-11-15) and the S30 product page
(https://hls.gsfc.nasa.gov/products-description/s30/, saturation flag 12000).

Table 9, least significant bit first:
bit 0 cirrus, reserved and unused in HLS V2.0;
bit 1 cloud; bit 2 adjacent to cloud/shadow; bit 3 cloud shadow;
bit 4 snow/ice; bit 5 water;
bits 6-7 aerosol, and 11 (both bits set) is high aerosol.
The algorithms page says high-aerosol pixels are not recommended:
https://hls.gsfc.nasa.gov/algorithms/
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import numpy as np

FILL = -9999
SCALE = 0.0001
# S30 product page saturation flag. Applied to L30 as well: a stored value of
# 12000 is reflectance 1.2, which the L30 table does not list as a valid code.
# TODO(verify) an L30 saturation flag in the user guide tables.
SATURATION = 12000
# Bits 1 through 5. Bit 0 is reserved and is not masked.
CLEAR_BITS = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)
HIGH_AEROSOL = (1 << 6) | (1 << 7)
FMASK_FILL = 255
RADIUS_M = 150.0


def fmask_clear(qa: np.ndarray) -> np.ndarray:
    """True where the pixel is not fill, not cloud/shadow/snow/water/adjacent, and not high aerosol."""
    values = np.asarray(qa)
    not_fill = values != FMASK_FILL
    flagged = (values & CLEAR_BITS) != 0
    high = (values & HIGH_AEROSOL) == HIGH_AEROSOL
    return not_fill & ~flagged & ~high


def scene_ndvi_mean(
    red: np.ndarray,
    nir: np.ndarray,
    qa: np.ndarray,
    east_m: np.ndarray,
    north_m: np.ndarray,
    radius_m: float = RADIUS_M,
) -> tuple[float | None, int]:
    """Mean NDVI of clear pixels whose centres lie inside ``radius_m``.

    Returns ``(mean, n_pixels)``. ``None`` and 0 when no pixel qualifies.
    Reflectance scale 0.0001 cancels in the ratio. Fill, saturation, a
    non-positive sum, and NDVI outside [-1, 1] are dropped. Nothing is filled.
    """
    red_a = np.asarray(red)
    nir_a = np.asarray(nir)
    qa_a = np.asarray(qa)
    east = np.asarray(east_m, dtype=np.float64)
    north = np.asarray(north_m, dtype=np.float64)
    if red_a.shape != nir_a.shape or red_a.shape != qa_a.shape or red_a.shape != east.shape:
        raise ValueError("red, nir, qa, and coordinates must share a shape")
    clear = fmask_clear(qa_a)
    usable = (
        clear
        & (red_a != FILL)
        & (nir_a != FILL)
        & (red_a >= 0)
        & (nir_a >= 0)
        & (red_a < SATURATION)
        & (nir_a < SATURATION)
    )
    inside = (east * east + north * north) <= float(radius_m) * float(radius_m)
    red_f = red_a.astype(np.float64)
    nir_f = nir_a.astype(np.float64)
    denom = nir_f + red_f
    ok = usable & inside & (denom > 0)
    if not np.any(ok):
        return None, 0
    ndvi = (nir_f[ok] - red_f[ok]) / denom[ok]
    ndvi = ndvi[(ndvi >= -1.0) & (ndvi <= 1.0)]
    if ndvi.size == 0:
        return None, 0
    return float(ndvi.mean()), int(ndvi.size)


def href_named(hrefs: list[str], suffix: str) -> str | None:
    """One HTTPS granule file whose filename ends with ``suffix``.

    ``suffix`` includes the dot, for example ``.B04.tif`` or ``.B8A.tif``.
    """
    found = []
    for href in hrefs:
        name = Path(urlparse(href).path).name
        if name.endswith(suffix):
            found.append(href)
    if len(found) != 1:
        return None
    return found[0]


def read_window(path: str, lon: float, lat: float, radius_m: float, gdal_config: dict | None = None) -> dict | None:
    """Read a small window around the point. Coordinates come back in metres relative to the point.

    ``path`` may be a local file or a URL. ``gdal_config`` is passed to
    ``rasterio.Env`` and is not logged. Returns None when the point is outside
    the raster. Projected CRS units are treated as metres (HLS tiles are UTM).
    A geographic CRS is converted with the same 111320 m/degree sphere already
    used in ``app.features.zones`` (assumed; Snyder 1987 is cited there).
    """
    import math

    import rasterio
    from rasterio.transform import xy
    from rasterio.warp import transform as warp
    from rasterio.windows import Window

    config = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF",
    }
    if gdal_config:
        config.update(gdal_config)
    with rasterio.Env(**config):
        with rasterio.open(path) as src:
            if src.crs is None:
                raise ValueError("raster has no CRS")
            xs, ys = warp("EPSG:4326", src.crs, [lon], [lat])
            x0, y0 = float(xs[0]), float(ys[0])
            px = abs(float(src.transform.a)) or 1.0
            py = abs(float(src.transform.e)) or 1.0
            projected = bool(src.crs.is_projected)
            if projected:
                rad_x, rad_y = float(radius_m), float(radius_m)
            else:
                rad_y = float(radius_m) / 111320.0
                rad_x = float(radius_m) / (111320.0 * max(math.cos(math.radians(lat)), 0.2))
            row, col = src.index(x0, y0)
            half_c = int(math.ceil(rad_x / px)) + 1
            half_r = int(math.ceil(rad_y / py)) + 1
            c0 = max(int(col) - half_c, 0)
            r0 = max(int(row) - half_r, 0)
            c1 = min(int(col) + half_c + 1, src.width)
            r1 = min(int(row) + half_r + 1, src.height)
            if c1 <= c0 or r1 <= r0:
                return None
            window = Window(c0, r0, c1 - c0, r1 - r0)
            data = src.read(1, window=window)
            transform = src.window_transform(window)
            rows = np.arange(data.shape[0])
            cols = np.arange(data.shape[1])
            cc, rr = np.meshgrid(cols, rows)
            east, north = xy(transform, rr, cc, offset="center")
            # rasterio.transform.xy flattens array inputs. The order matches C-order ravel.
            east_a = np.asarray(east, dtype=np.float64).reshape(data.shape)
            north_a = np.asarray(north, dtype=np.float64).reshape(data.shape)
            if projected:
                east_m = east_a - x0
                north_m = north_a - y0
            else:
                m_lon = 111320.0 * max(math.cos(math.radians(lat)), 0.2)
                east_m = (east_a - x0) * m_lon
                north_m = (north_a - y0) * 111320.0
            return {"data": data, "east_m": east_m, "north_m": north_m}
