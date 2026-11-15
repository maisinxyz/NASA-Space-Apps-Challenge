"""Seed the coastal BC demo sites from Natural Resources Canada HRDEM."""

import argparse
import math
from datetime import UTC, datetime
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
from pyproj import Transformer
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

from edl import _ensure_api_path
from series import write_series

_ensure_api_path()
from app.features.config import CURATED_SITES

SITES = ("site_ubc_farm", "site_kpu_langley")
SOURCE = "https://datacube.services.geo.ca/wrapper/ogc/elevation-hrdem-mosaic"
LICENSE = "Open Government Licence – Canada"
SIZE = 129
RESOLUTION = 10


def build(site_id: str) -> None:
    point = CURATED_SITES[site_id]
    lon, lat = point["lon"], point["lat"]
    x, y = Transformer.from_crs(4326, 3979, always_xy=True).transform(lon, lat)
    crs = "urn:ogc:def:crs:EPSG::3979"
    query = urlencode({
        "SERVICE": "WCS", "VERSION": "1.1.1", "REQUEST": "GetCoverage", "FORMAT": "image/geotiff",
        "IDENTIFIER": "dtm", "BOUNDINGBOX": f"{x-1000},{y-1000},{x+1000},{y+1000},{crs}",
        "GRIDBASECRS": crs, "GRIDOFFSETS": "10,-10",
    })
    with urlopen(f"{SOURCE}?{query}", timeout=45) as response:
        payload = response.read()
    dx = RESOLUTION / (111_320 * math.cos(math.radians(lat)))
    dy = RESOLUTION / 111_320
    origin = [lon - (SIZE // 2) * dx, lat + (SIZE // 2) * dy]
    transform = from_origin(origin[0] - dx / 2, origin[1] + dy / 2, dx, dy)
    grid = np.full((SIZE, SIZE), np.nan, dtype=np.float32)
    with MemoryFile(payload) as file, file.open() as raster:
        source = raster.read(1, masked=True).astype(np.float32).filled(np.nan)
        reproject(
            source, grid, src_transform=raster.transform, src_crs=raster.crs, src_nodata=np.nan,
            dst_transform=transform, dst_crs="EPSG:4326", dst_nodata=np.nan, resampling=Resampling.bilinear,
        )
    finite = np.isfinite(grid)
    if not finite[SIZE // 2, SIZE // 2] or finite.mean() < 0.5:
        raise ValueError(f"No usable HRDEM coverage at {site_id}.")
    retrieved = datetime.now(UTC).date().isoformat()
    elevation = [[round(float(v), 2) if np.isfinite(v) else None for v in row] for row in grid]
    doc = {
        "site_id": site_id, "elevation": elevation, "origin": origin, "shape": list(grid.shape),
        "res_m": RESOLUTION, "pixel_size_deg": [dx, dy], "crs": "EPSG:4326", "bare_earth": True,
        "product": {"short_name": "NRCan HRDEM Mosaic DTM", "version": "WCS 1.1.1"}, "retrieved_on": retrieved,
    }
    meta = {
        "source_name": "Natural Resources Canada HRDEM Mosaic Digital Terrain Model",
        "source_url": SOURCE, "product_version": "WCS 1.1.1", "retrieved_on": retrieved,
        "license": LICENSE, "attribution": "Natural Resources Canada / CanElevation",
        "resolution_spatial": "10 m analysis grid from HRDEM DTM",
        "resolution_temporal": "Static mosaic of elevation surveys",
        "processing_notes": "Requested a 10 m bare-earth coverage and resampled to a locally metric WGS84 grid. Elevations in metres, CGVD2013. Holes stay null.",
    }
    print(write_series(site_id, "dem_hrdem", doc, meta), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sites", nargs="*")
    args = parser.parse_args()
    for site in args.sites or SITES:
        if site not in SITES:
            parser.error(f"Unknown demo site: {site}")
        build(site)
