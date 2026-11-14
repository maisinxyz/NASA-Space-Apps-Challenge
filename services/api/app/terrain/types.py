"""Core data types for the terrain subsystem (BE-01, Prompt 29).

ElevationGrid
    One reprojected, resampled, gap-filled elevation raster in a local UTM CRS.
    Shape: (height, width), dtype float32, unit: metres above vertical datum.
    Nodata cells carry a companion boolean mask (True == nodata).

TerrainSource
    Protocol (structural subtyping) that every adapter must satisfy.
    fetch() converts a WGS84 bounding box into an ElevationGrid.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np


# ---------------------------------------------------------------------------
# Metadata for a single elevation source contribution
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SourceInfo:
    """Provenance for one data source (matches the PRD §6.2 sources array)."""
    name: str
    role: str = "elevation"           # "elevation" | "imagery" | "weather"
    resolution_m: float = 0.0
    license: str = ""
    url: str = ""
    basis: str = "measured"           # PRD Basis enum


# ---------------------------------------------------------------------------
# ElevationGrid — the central data object for all terrain operations
# ---------------------------------------------------------------------------

@dataclass
class ElevationGrid:
    """Single-band float32 elevation raster in a projected (UTM) CRS.

    Attributes
    ----------
    z : np.ndarray
        Shape (height, width), dtype float32.  Values in metres above the
        vertical datum.  Nodata cells may contain any value; use ``nodata``
        mask to identify them.
    nodata : np.ndarray
        Boolean mask, same shape as ``z``.  True == this cell is nodata.
    crs : str
        EPSG string of the projected CRS, e.g. ``"EPSG:32611"``.
    cell_size_m : float
        Ground sampling distance in metres (square pixels assumed).
    transform : tuple[float, ...]
        GDAL-style (west, cell_size_m, 0, north, 0, -cell_size_m) six-element
        affine transform.  Origin is the **centre** of the top-left pixel.
    source : SourceInfo
        Provenance of the elevation values.
    model : str
        ``"DTM"`` or ``"DSM"``.
    vertical_datum : str
        E.g. ``"CGVD2013"`` or ``"EGM96"`` or ``"to_verify"``.
    nodata_fraction : float
        Fraction of cells that are nodata (0.0–1.0).
    quality_flags : list[str]
        Any combination of ``"coarse_elevation"``, ``"dsm_includes_vegetation"``,
        ``"texture_alignment_assumed"``, ``"mock_data"``, etc.
    """

    z: np.ndarray                           # float32, shape (H, W)
    nodata: np.ndarray                      # bool,    shape (H, W)
    crs: str                                # e.g. "EPSG:32611"
    cell_size_m: float                      # metres per pixel (square)
    transform: tuple[float, ...]            # 6-element GDAL affine
    source: SourceInfo
    model: str = "DTM"                      # "DTM" | "DSM"
    vertical_datum: str = "to_verify"
    quality_flags: list[str] = field(default_factory=list)

    # --- derived properties -----------------------------------------------

    @property
    def height(self) -> int:
        return int(self.z.shape[0])

    @property
    def width(self) -> int:
        return int(self.z.shape[1])

    @property
    def nodata_fraction(self) -> float:
        if self.z.size == 0:
            return 1.0
        return float(self.nodata.sum()) / self.z.size

    @property
    def valid_z(self) -> np.ndarray:
        """Float32 array with nodata cells set to NaN."""
        out = self.z.astype(np.float32, copy=True)
        out[self.nodata] = np.nan
        return out

    @property
    def min_m(self) -> float:
        vals = self.z[~self.nodata]
        return float(vals.min()) if vals.size else 0.0

    @property
    def max_m(self) -> float:
        vals = self.z[~self.nodata]
        return float(vals.max()) if vals.size else 0.0


# ---------------------------------------------------------------------------
# TerrainSource — protocol every adapter must implement
# ---------------------------------------------------------------------------

class TerrainSource(Protocol):
    """Structural protocol: any class with this method signature qualifies."""

    def fetch(
        self,
        bbox_wgs84: tuple[float, float, float, float],
        target_cell_m: float,
    ) -> ElevationGrid:
        """Return an ElevationGrid covering *bbox_wgs84* at *target_cell_m*.

        Parameters
        ----------
        bbox_wgs84 : (minLon, minLat, maxLon, maxLat)
            WGS84 bounding box in decimal degrees.
        target_cell_m : float
            Desired ground-sample distance in metres.  The adapter may return
            a slightly different value (e.g. due to native resolution) but the
            longer side of the output grid must not exceed 512 cells.

        Raises
        ------
        ApiError("TERRAIN_COVERAGE_MISSING")
            If the source has no data for this bbox.
        ApiError("DATA_SOURCE_UNAVAILABLE")
            If the remote service is unreachable after retries.
        """
        ...
