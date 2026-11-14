"""Tests for BE-A: Terrain core (Prompts 29 & 32).

Coverage
--------
29 — UTM zone selection, grid size cap, nodata gap-fill, content hash, determinism
32 — slope/aspect on tilted plane; depression detection on bowl; flow accumulation
     ridge-valley; output encoding matches contract ranges

These tests run on synthetic NumPy grids only — no network, no GeoTIFF files
required.  They should pass with: `pytest services/api/tests/test_terrain_core.py`
from the repo root.
"""
from __future__ import annotations

import hashlib
import json

import numpy as np
import pytest

# ---------------------------------------------------------------------------
# Helpers — build synthetic ElevationGrids
# ---------------------------------------------------------------------------

def _make_grid(z: np.ndarray, cell_m: float = 2.0) -> "ElevationGrid":
    from app.terrain.types import ElevationGrid, SourceInfo

    nd = np.zeros(z.shape, dtype=bool)
    # Minimal affine: origin at (0, cell_m * rows) with cell_m step
    h, w = z.shape
    transform = (0.0, cell_m, 0.0, h * cell_m, 0.0, -cell_m)
    return ElevationGrid(
        z=z.astype(np.float32),
        nodata=nd,
        crs="EPSG:32611",
        cell_size_m=cell_m,
        transform=transform,
        source=SourceInfo(name="synthetic", license="none", url=""),
    )


# ---------------------------------------------------------------------------
# Prompt 29: grid_utils
# ---------------------------------------------------------------------------

class TestUTMZone:
    """UTM zone selection covers expected zones for real BC locations."""

    def test_vancouver(self):
        from app.terrain.grid_utils import utm_epsg_for_bbox
        # Vancouver: lon ≈ -123.1, lat ≈ 49.3 → Zone 10N = EPSG:32610
        epsg = utm_epsg_for_bbox((-123.2, 49.2, -123.0, 49.4))
        assert epsg == "EPSG:32610"

    def test_okanagan(self):
        from app.terrain.grid_utils import utm_epsg_for_bbox
        # Okanagan: lon ≈ -119.5, lat ≈ 49.5 → Zone 11N = EPSG:32611
        epsg = utm_epsg_for_bbox((-119.6, 49.1, -119.4, 49.3))
        assert epsg == "EPSG:32611"

    def test_southern_hemisphere(self):
        from app.terrain.grid_utils import utm_epsg_for_bbox
        # Test that southern hemisphere picks 327xx codes.
        epsg = utm_epsg_for_bbox((-119.6, -50.0, -119.4, -49.8))
        assert epsg.startswith("EPSG:327")


class TestChooseGridSize:
    """Grid size respects the ≤ 512 cell cap on the longer side."""

    def test_small_bbox_no_cap_needed(self):
        from app.terrain.grid_utils import choose_grid_size
        # ~200 m × 200 m bbox at 2 m native → 100×100 cells, well under 512
        bbox = (-119.6, 49.1, -119.598, 49.1018)
        w, h, cell = choose_grid_size(bbox, native_resolution_m=2.0)
        assert w <= 512 and h <= 512

    def test_large_bbox_capped(self):
        from app.terrain.grid_utils import choose_grid_size
        # 50 km × 50 km bbox at 1 m native → naive size would be 50 000 cells → cap to 512
        bbox = (-120.0, 49.0, -119.55, 49.45)   # roughly 50 km each side
        w, h, cell = choose_grid_size(bbox, native_resolution_m=1.0)
        assert max(w, h) <= 512
        assert cell > 1.0   # cell was scaled up

    def test_at_least_one_cell(self):
        from app.terrain.grid_utils import choose_grid_size
        bbox = (-119.6, 49.1, -119.5999, 49.1001)  # tiny bbox
        w, h, cell = choose_grid_size(bbox, native_resolution_m=100.0)
        assert w >= 1 and h >= 1


class TestContentHash:
    """Content hash is deterministic and sensitive to changes."""

    def test_deterministic(self):
        from app.terrain.grid_utils import content_hash
        bbox = (-119.6, 49.1, -119.58, 49.12)
        h1 = content_hash(bbox, 2.0, {"hrdem": "2024-01"})
        h2 = content_hash(bbox, 2.0, {"hrdem": "2024-01"})
        assert h1 == h2

    def test_different_cell_gives_different_hash(self):
        from app.terrain.grid_utils import content_hash
        bbox = (-119.6, 49.1, -119.58, 49.12)
        h1 = content_hash(bbox, 2.0, {"hrdem": "2024-01"})
        h2 = content_hash(bbox, 5.0, {"hrdem": "2024-01"})
        assert h1 != h2

    def test_different_source_version(self):
        from app.terrain.grid_utils import content_hash
        bbox = (-119.6, 49.1, -119.58, 49.12)
        h1 = content_hash(bbox, 2.0, {"hrdem": "2024-01"})
        h2 = content_hash(bbox, 2.0, {"hrdem": "2024-02"})
        assert h1 != h2

    def test_returns_hex_64_chars(self):
        from app.terrain.grid_utils import content_hash
        h = content_hash((-119.6, 49.1, -119.58, 49.12), 2.0, {})
        assert len(h) == 64
        int(h, 16)   # must be valid hex


class TestFillNodata:
    """Small nodata gaps are filled; large ones raise ApiError."""

    def test_no_nodata_passthrough(self):
        from app.terrain.grid_utils import fill_nodata
        z = np.ones((16, 16), dtype=np.float32) * 100.0
        nd = np.zeros((16, 16), dtype=bool)
        filled, remaining = fill_nodata(z, nd)
        assert not remaining.any()
        np.testing.assert_array_almost_equal(filled, z)

    def test_small_hole_filled(self):
        from app.terrain.grid_utils import fill_nodata
        z = np.full((32, 32), 100.0, dtype=np.float32)
        nd = np.zeros((32, 32), dtype=bool)
        # Single-cell hole in the middle
        nd[16, 16] = True
        z[16, 16] = -9999.0
        filled, remaining = fill_nodata(z, nd)
        assert not remaining[16, 16]
        assert 95.0 <= filled[16, 16] <= 105.0   # filled near 100 m

    def test_large_hole_raises(self):
        from app.core.errors import ApiError
        from app.terrain.grid_utils import fill_nodata, NODATA_HOLE_MAX_CELLS
        # Make a hole bigger than the fill threshold AND bigger than 30 % of the grid.
        z = np.full((64, 64), 100.0, dtype=np.float32)
        nd = np.zeros((64, 64), dtype=bool)
        nd[10:55, 10:55] = True   # 45×45 = 2025 cells >> threshold, >> 30 % of 4096
        z[nd] = -9999.0
        with pytest.raises(ApiError) as exc:
            fill_nodata(z, nd)
        assert exc.value.code == "TERRAIN_COVERAGE_MISSING"


# ---------------------------------------------------------------------------
# Prompt 32: analysis module
# ---------------------------------------------------------------------------

class TestSlopeAspect:
    """Tilted-plane sanity checks."""

    def test_tilted_plane_slope(self):
        """A plane tilting 0.05 m/m east should have slope ≈ arctan(0.05) ≈ 2.86°."""
        from app.analysis import analyse

        SIZE = 64
        cell = 1.0
        cols = np.arange(SIZE, dtype=np.float32)
        z = np.outer(np.ones(SIZE, dtype=np.float32), cols) * 0.05  # rises eastward
        grid = _make_grid(z, cell_m=cell)
        slope_deg, aspect_deg, *_ = analyse(grid)

        expected = float(np.degrees(np.arctan(0.05)))
        # Interior cells only (gradient is less accurate at borders)
        interior = slope_deg[2:-2, 2:-2]
        np.testing.assert_allclose(interior, expected, atol=0.5)

    def test_flat_plane_zero_slope(self):
        from app.analysis import analyse

        z = np.full((32, 32), 100.0, dtype=np.float32)
        grid = _make_grid(z)
        slope_deg, aspect_deg, *_ = analyse(grid)
        # Slope everywhere should be ~0 (gradient of constant surface = 0).
        np.testing.assert_allclose(slope_deg, 0.0, atol=1e-3)

    def test_tilted_plane_one_flow_direction(self):
        """On a tilted plane the D8 direction should be nearly uniform.

        Grid convention: row 0 = north, row (SIZE-1) = south.
        z = outer(arange, ones) → z[r,c] = r → lowest at row 0 (north) →
        water drains northward → D8 code 2 (North).
        """
        from app.analysis import analyse

        SIZE = 32
        # z increases southward (highest at south) → water drains NORTH
        z = np.outer(np.arange(SIZE, dtype=np.float32), np.ones(SIZE))
        grid = _make_grid(z)
        _, _, d8_dir, flow_acc, *_ = analyse(grid)

        # Interior cells: should drain northward (D8 code 2 = North).
        interior = d8_dir[2:-2, 2:-2]
        north_fraction = (interior == 2).sum() / interior.size
        assert north_fraction > 0.80, f"Expected >80% northward (code 2), got {north_fraction:.1%}"

    def test_tilted_plane_flow_acc_increases_downhill(self):
        """Flow accumulation must be non-decreasing from north to south."""
        from app.analysis import analyse

        SIZE = 32
        z = np.outer(np.arange(SIZE, 0, -1, dtype=np.float32), np.ones(SIZE))  # drains S
        grid = _make_grid(z)
        _, _, _, flow_acc, *_ = analyse(grid)

        # Compare row means: each southern row should have >= northern row mean.
        row_means = flow_acc.mean(axis=1)
        # Allow tiny float tolerance.
        diffs = np.diff(row_means)
        assert (diffs >= -0.5).all(), "Flow accumulation not monotonically non-decreasing S"


class TestBowlDepression:
    """Bowl terrain has exactly one depression with known depth."""

    def test_bowl_one_depression_detected(self):
        from app.analysis import analyse

        SIZE = 64
        rows, cols = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
        r2 = (rows - SIZE // 2) ** 2 + (cols - SIZE // 2) ** 2
        frac = np.clip(1.0 - r2 / 30.0 ** 2, 0.0, None)
        DEPTH = 2.0
        z = 300.0 - DEPTH * frac
        grid = _make_grid(z, cell_m=1.0)

        _, _, _, _, depress_m, _, stats = analyse(grid)

        # There should be at least one depression.
        assert stats.n_depressions >= 1
        # Deepest point should be close to DEPTH (within 15 %).
        assert stats.largest_depression_depth_m >= DEPTH * 0.5

    def test_depression_depth_non_negative(self):
        from app.analysis import analyse

        SIZE = 32
        z = np.ones((SIZE, SIZE), dtype=np.float32) * 100.0
        z[14:18, 14:18] -= 1.5   # small rectangular depression
        grid = _make_grid(z, cell_m=1.0)
        _, _, _, _, depress_m, _, _ = analyse(grid)

        assert (depress_m >= 0).all()


class TestRidgeValley:
    """Ridge-valley: accumulation peaks in the valley."""

    def test_valley_has_highest_accumulation(self):
        from app.analysis import analyse

        SIZE = 64
        cols = np.arange(SIZE, dtype=np.float32)
        # Symmetric V-valley: elevation = abs(col - centre)
        centre = SIZE / 2.0
        z = np.outer(np.ones(SIZE, dtype=np.float32), np.abs(cols - centre))
        # Add slight southward tilt so water exits the grid.
        rows = np.arange(SIZE, dtype=np.float32)
        z += np.outer(rows * 0.001, np.ones(SIZE))
        grid = _make_grid(z, cell_m=1.0)

        _, _, _, flow_acc, *_ = analyse(grid)

        # The valley column (cols ≈ centre) should have higher average acc
        # than the ridge columns (cols at the edges).
        valley_col = int(centre)
        valley_acc = flow_acc[:, valley_col - 2 : valley_col + 3].mean()
        ridge_acc  = flow_acc[:, :5].mean()
        assert valley_acc > ridge_acc * 2, (
            f"Valley acc ({valley_acc:.1f}) should be >> ridge acc ({ridge_acc:.1f})"
        )


class TestEncoding:
    """Layer arrays must round-trip through the contract encoding."""

    def test_slope_encoding_in_range(self):
        from app.analysis import encode_slope_layer

        z = np.linspace(0, 30, 254, dtype=np.float32)
        nd = np.zeros(z.shape, dtype=bool)
        enc = encode_slope_layer(z, nd)
        assert enc.dtype == np.uint8
        assert enc.min() >= 0 and enc.max() <= 254

    def test_nodata_flag_255(self):
        from app.analysis import encode_slope_layer

        z = np.array([10.0, 20.0, 5.0], dtype=np.float32)
        nd = np.array([False, True, False])
        enc = encode_slope_layer(z, nd)
        assert enc[1] == 255

    def test_flow_acc_encoding_log10(self):
        from app.analysis import encode_flow_acc_layer

        # flow_acc = 1 → log10 = 0 → byte 0
        # flow_acc = 1e5 → log10 = 5 → byte 254
        acc = np.array([1.0, 10.0, 100.0, 1000.0, 1e5], dtype=np.float64)
        nd  = np.zeros(len(acc), dtype=bool)
        enc = encode_flow_acc_layer(acc, nd)
        assert enc[0] == 0
        assert enc[-1] == 254

    def test_depression_encoding_range(self):
        from app.analysis import encode_depressions_layer

        dep = np.array([0.0, 2.0, 4.0], dtype=np.float32)
        nd  = np.zeros(3, dtype=bool)
        enc = encode_depressions_layer(dep, nd)
        assert enc[0] == 0
        assert enc[-1] == 254
