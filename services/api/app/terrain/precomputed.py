"""PrecomputedSource — reads a curated site's pre-built GeoTIFF from data/seed/.

This is the adapter used in OFFLINE mode and for the demo (PRD BE-01 / Prompt 29).

Expected layout
---------------
    data/seed/<site_id>/elevation.tif   — single-band float32 GeoTIFF in any
                                          projected or geographic CRS; must cover
                                          the site bbox.

If the file is not present, raises ApiError("TERRAIN_COVERAGE_MISSING") with a
helpful hint so the seed script can be called.

Implements the TerrainSource protocol.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from app.core.errors import ApiError
from app.terrain.grid_utils import (
    choose_grid_size,
    fill_nodata,
    make_utm_transform,
    reproject_and_resample,
    utm_epsg_for_bbox,
)
from app.terrain.types import ElevationGrid, SourceInfo

log = logging.getLogger("fieldtwin.terrain.precomputed")

# Version tag baked into provenance / content hashes; bump when seed data changes.
SOURCE_VERSION = "precomputed-v1"


class PrecomputedSource:
    """Serve elevation from a pre-built GeoTIFF in data/seed/<site_id>/.

    Parameters
    ----------
    seed_dir : Path
        Path to the ``data/seed/`` directory (or the directory that contains
        per-site sub-directories).  Defaults to ``<repo_root>/data/seed``.
    """

    def __init__(self, seed_dir: Path | None = None) -> None:
        if seed_dir is None:
            # Resolve relative to this file: services/api/app/terrain/precomputed.py
            # → go up 5 levels → repo root → data/seed
            here = Path(__file__).resolve()
            seed_dir = here.parents[4] / "data" / "seed"
        self._seed_dir = Path(seed_dir)

    # ------------------------------------------------------------------
    # TerrainSource protocol
    # ------------------------------------------------------------------

    def fetch(
        self,
        bbox_wgs84: tuple[float, float, float, float],
        target_cell_m: float,
        *,
        site_id: str | None = None,
    ) -> ElevationGrid:
        """Load, reproject, and resample the seed GeoTIFF for *site_id*.

        Parameters
        ----------
        bbox_wgs84 : (minLon, minLat, maxLon, maxLat)
        target_cell_m : desired ground-sample distance; the grid side cap
            (≤ 512 cells) is enforced by choose_grid_size.
        site_id : sub-directory name under seed_dir; if None the method looks
            for the first ``elevation.tif`` whose extent overlaps the bbox.

        Raises
        ------
        ApiError("TERRAIN_COVERAGE_MISSING") if the file is missing or the
            bbox does not intersect the raster.
        """
        import rasterio
        from rasterio.crs import CRS
        from rasterio.enums import Resampling

        tif_path = self._find_tif(site_id, bbox_wgs84)
        log.info("PrecomputedSource: loading %s", tif_path)

        with rasterio.open(tif_path) as src:
            native_m = self._native_resolution_m(src)
            # Determine CRS and native model from file metadata.
            model = src.tags().get("model", "DTM").upper()
            vertical_datum = src.tags().get("vertical_datum", "to_verify")

        # Choose output grid size (longest side ≤ 512).
        dst_crs = utm_epsg_for_bbox(bbox_wgs84)
        width, height, cell_m = choose_grid_size(
            bbox_wgs84, native_resolution_m=max(native_m, target_cell_m)
        )
        dst_transform, _utm_bounds = make_utm_transform(bbox_wgs84, dst_crs, width, height)

        # Read and reproject.
        with rasterio.open(tif_path) as src:
            src_nodata = src.nodata if src.nodata is not None else -9999.0
            # Read first band as float32.
            raw = src.read(1, out_dtype=np.float32)
            raw_nodata = (raw == src_nodata) if src.nodata is not None else np.zeros(raw.shape, dtype=bool)
            raw[raw_nodata] = src_nodata  # ensure sentinel is consistent

            data, nd_mask = reproject_and_resample(
                src_array=raw,
                src_crs=src.crs.to_string(),
                src_transform=src.transform,
                dst_crs=dst_crs,
                dst_width=width,
                dst_height=height,
                dst_transform=dst_transform,
                nodata_value=float(src_nodata),
            )

        # Fill small nodata gaps; raises if too sparse.
        filled, remaining_nd = fill_nodata(data, nd_mask)

        return ElevationGrid(
            z=filled.astype(np.float32),
            nodata=remaining_nd,
            crs=dst_crs,
            cell_size_m=cell_m,
            transform=tuple(dst_transform)[:6],
            source=SourceInfo(
                name=f"PrecomputedSource:{tif_path.name}",
                role="elevation",
                resolution_m=native_m,
                license="see data/seed/<site_id>/LICENSE or attribution.txt",
                url=str(tif_path),
                basis="measured",
            ),
            model=model,
            vertical_datum=vertical_datum,
            quality_flags=[],
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _find_tif(
        self,
        site_id: str | None,
        bbox_wgs84: tuple[float, float, float, float],
    ) -> Path:
        """Locate an elevation.tif; raise ApiError if not found."""
        if site_id:
            candidate = self._seed_dir / site_id / "elevation.tif"
            if candidate.exists():
                return candidate
            raise ApiError(
                "TERRAIN_COVERAGE_MISSING",
                f"No pre-built elevation file for site '{site_id}'.",
                hint=f"Run `make seed` to build data/seed/{site_id}/elevation.tif.",
            )

        # Scan all sub-directories for a tif that overlaps the bbox.
        candidates = sorted(self._seed_dir.glob("*/elevation.tif"))
        if not candidates:
            raise ApiError(
                "TERRAIN_COVERAGE_MISSING",
                "No seed elevation files found.",
                hint="Run `make seed` to build the curated-site data.",
            )

        for path in candidates:
            if self._tif_overlaps(path, bbox_wgs84):
                log.debug("PrecomputedSource: auto-selected %s", path)
                return path

        raise ApiError(
            "TERRAIN_COVERAGE_MISSING",
            "No pre-built elevation file covers this location.",
            hint="Use a curated site or run a live scan.",
        )

    @staticmethod
    def _tif_overlaps(
        tif_path: Path,
        bbox_wgs84: tuple[float, float, float, float],
    ) -> bool:
        """Return True if tif_path's extent overlaps bbox_wgs84."""
        try:
            import rasterio
            from rasterio.crs import CRS
            from rasterio.warp import transform_bounds

            with rasterio.open(tif_path) as src:
                bounds = transform_bounds(
                    src.crs, CRS.from_epsg(4326),
                    src.bounds.left, src.bounds.bottom,
                    src.bounds.right, src.bounds.top,
                )
            min_lon, min_lat, max_lon, max_lat = bbox_wgs84
            # Axis-aligned intersection check
            return not (
                bounds[2] < min_lon or bounds[0] > max_lon
                or bounds[3] < min_lat or bounds[1] > max_lat
            )
        except Exception:
            return False

    @staticmethod
    def _native_resolution_m(src) -> float:
        """Estimate native pixel size in metres."""
        try:
            if src.crs and src.crs.is_projected:
                return float(abs(src.transform.a))   # cell width in metres
            # Geographic CRS: convert degrees to metres at mid latitude
            lat = (src.bounds.bottom + src.bounds.top) / 2.0
            return float(abs(src.transform.a)) * 111_320.0 * abs(np.cos(np.radians(lat)))
        except Exception:
            return 30.0  # NASADEM-grade fallback
