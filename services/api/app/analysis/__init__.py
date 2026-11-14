"""Terrain analysis module (BE-04, Prompt 32).

Derives hydrology and morphology layers from an ElevationGrid:

    slope_degrees   — steepness in degrees (0–90)
    aspect_degrees  — flow-facing direction (0=N, 90=E, 180=S, 270=W, −1=flat)
    d8_direction    — D8 flow-direction code (1–128, Esri convention; 0=nodata)
    flow_accumulation_cells — upslope contributing area in cells
    depression_depth_m  — ponding depth per cell after priority-flood fill
    drainage_network    — boolean mask: cells above flow accumulation threshold

Summary statistics are packaged into an AnalysisStats dataclass consumed by
the packaging step (BE-10) and the insight engine (BE-09).

Algorithm citations
-------------------
Priority-flood:  Barnes, R., Lehman, C., Mulla, D. (2014). Priority-flood: An
    optimal depression-filling and watershed-labeling algorithm for digital
    elevation models. Computers & Geosciences, 62, pp.117-127.
    https://doi.org/10.1016/j.cageo.2013.04.024

D8 flow direction: O'Callaghan, J.F., Mark, D.M. (1984). The extraction of
    drainage networks from digital elevation data. Computer Vision, Graphics,
    and Image Processing, 28(3), pp.323-344.

All computations are vectorized with NumPy; Numba is NOT used (not in the
declared stack).  Performance is adequate for grids up to 512×512.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.terrain.types import ElevationGrid


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# 8-direction neighbour offsets (row, col) → Esri D8 code
# Code: NE=1, N=2, NW=4, W=8, SW=16, S=32, SE=64, E=128
_D8_DIRS: list[tuple[int, int, int]] = [
    (-1,  1,   1),   # NE
    (-1,  0,   2),   # N
    (-1, -1,   4),   # NW
    ( 0, -1,   8),   # W
    ( 1, -1,  16),   # SW
    ( 1,  0,  32),   # S
    ( 1,  1,  64),   # SE
    ( 0,  1, 128),   # E
]
_D8_OFFSETS = [(dr, dc) for dr, dc, _ in _D8_DIRS]
_D8_CODES   = [code     for _,  _,  code in _D8_DIRS]
# Physical length for diagonal vs cardinal moves (cell_size_m units)
_D8_LENGTHS = np.array([
    np.sqrt(2), 1.0, np.sqrt(2), 1.0, np.sqrt(2), 1.0, np.sqrt(2), 1.0
], dtype=np.float64)

# Flow accumulation threshold: cells with acc > this form the drainage network.
DRAINAGE_THRESHOLD = 200   # cells (~0.2 ha at 1 m resolution; named constant)

# Layers whose physical ranges must match packages/contracts/fixtures_lib/encoding.py
LAYER_RANGE_SLOPE        = (0.0,  30.0)   # degrees
LAYER_RANGE_FLOW_ACC     = (0.0,   5.0)   # log10 upslope cells
LAYER_RANGE_DEPRESSIONS  = (0.0,   4.0)   # metres of fill depth


# ---------------------------------------------------------------------------
# Output dataclass
# ---------------------------------------------------------------------------

@dataclass
class AnalysisStats:
    """Summary statistics derived from the terrain (fed to BE-09 insights)."""

    # Slope
    mean_slope_deg: float = 0.0
    p90_slope_deg: float = 0.0          # steepest 10 % of valid cells

    # Depressions
    n_depressions: int = 0              # number of distinct depression objects
    largest_depression_area_m2: float = 0.0
    largest_depression_depth_m: float = 0.0
    largest_depression_lon: float = 0.0
    largest_depression_lat: float = 0.0

    # Drainage
    drainage_density_m_per_m2: float = 0.0   # total channel length / area
    main_channel_coords: list[tuple[float, float]] = field(default_factory=list)

    # Provenance
    nodata_fraction: float = 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyse(grid: ElevationGrid) -> tuple[
    np.ndarray,   # slope_deg   float32 (H,W)
    np.ndarray,   # aspect_deg  float32 (H,W) — −1 for flat
    np.ndarray,   # d8_dir      uint8   (H,W) — Esri codes; 0 for nodata/flat
    np.ndarray,   # flow_acc    float64 (H,W) — upslope cell count
    np.ndarray,   # depress_m   float32 (H,W) — ponding depth
    np.ndarray,   # drain_net   bool    (H,W) — True = drainage network
    AnalysisStats,
]:
    """Run the full BE-04 analysis pipeline on *grid*.

    All outputs share the same spatial extent and resolution as *grid*.
    Nodata cells in *grid.nodata* propagate through computations where
    meaningful; outputs for nodata locations are set to 0 / False / NaN
    as appropriate.

    Returns
    -------
    slope_deg, aspect_deg, d8_dir, flow_acc, depress_m, drain_net, stats
    """
    z = grid.z.astype(np.float64)
    nd = grid.nodata
    cs = float(grid.cell_size_m)

    # --- slope and aspect ---------------------------------------------------
    slope_deg, aspect_deg = _slope_aspect(z, cs, nd)

    # --- D8 flow direction (on depression-filled surface) -------------------
    filled = _priority_flood(z, nd)
    d8_dir = _d8_direction(filled, nd)

    # --- flow accumulation --------------------------------------------------
    flow_acc = _flow_accumulation(filled, d8_dir, nd)

    # --- depression depth ---------------------------------------------------
    depress_m = np.clip(filled - z, 0.0, None)
    depress_m[nd] = 0.0

    # --- drainage network ---------------------------------------------------
    drain_net = (flow_acc > DRAINAGE_THRESHOLD) & ~nd

    # --- summary statistics -------------------------------------------------
    stats = _compute_stats(
        slope_deg=slope_deg,
        depress_m=depress_m,
        flow_acc=flow_acc,
        drain_net=drain_net,
        grid=grid,
        nd=nd,
        cs=cs,
    )

    return (
        slope_deg.astype(np.float32),
        aspect_deg.astype(np.float32),
        d8_dir.astype(np.uint8),
        flow_acc,
        depress_m.astype(np.float32),
        drain_net,
        stats,
    )


# ---------------------------------------------------------------------------
# Layer encoding helpers (match packages/contracts/fixtures_lib/encoding.py)
# ---------------------------------------------------------------------------

def encode_slope_layer(slope_deg: np.ndarray, nodata: np.ndarray) -> np.ndarray:
    """Encode slope to 8-bit [0,30°] → bytes 0-254; 255 = nodata."""
    lo, hi = LAYER_RANGE_SLOPE
    b = np.rint(np.clip((slope_deg - lo) / (hi - lo), 0, 1) * 254).astype(np.uint8)
    b[nodata] = 255
    return b


def encode_flow_acc_layer(flow_acc: np.ndarray, nodata: np.ndarray) -> np.ndarray:
    """Encode log10(flow_acc) to 8-bit [0,5] → bytes 0-254; 255 = nodata."""
    lo, hi = LAYER_RANGE_FLOW_ACC
    log_acc = np.log10(np.maximum(flow_acc, 1.0))
    b = np.rint(np.clip((log_acc - lo) / (hi - lo), 0, 1) * 254).astype(np.uint8)
    b[nodata] = 255
    return b


def encode_depressions_layer(depress_m: np.ndarray, nodata: np.ndarray) -> np.ndarray:
    """Encode depression depth to 8-bit [0,4m] → bytes 0-254; 255 = nodata."""
    lo, hi = LAYER_RANGE_DEPRESSIONS
    b = np.rint(np.clip((depress_m - lo) / (hi - lo), 0, 1) * 254).astype(np.uint8)
    b[nodata] = 255
    return b


# ---------------------------------------------------------------------------
# Private computation functions
# ---------------------------------------------------------------------------

def _slope_aspect(
    z: np.ndarray,
    cell_m: float,
    nodata: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (slope_deg, aspect_deg) using NumPy gradient.

    aspect: 0=N, 90=E, 180=S, 270=W, −1=flat (gradient is zero).
    Convention: row index increases southward, col increases eastward.
    """
    # np.gradient returns (d/d_row, d/d_col)
    dz_drow, dz_dcol = np.gradient(z, cell_m, cell_m)

    # D/d_east  =  dz_dcol
    # D/d_north = -dz_drow  (row 0 is north)
    dz_east  =  dz_dcol
    dz_north = -dz_drow

    grad_mag = np.hypot(dz_east, dz_north)
    slope_deg = np.degrees(np.arctan(grad_mag))
    slope_deg[nodata] = 0.0

    # Aspect: downslope direction (direction water flows).
    flat = grad_mag < 1e-9
    aspect_rad = np.arctan2(-dz_east, dz_north)      # 0=N, π/2=W
    aspect_deg = np.degrees(aspect_rad) % 360.0       # 0–360
    aspect_deg[flat] = -1.0
    aspect_deg[nodata] = -1.0

    return slope_deg, aspect_deg


def _priority_flood(z: np.ndarray, nodata: np.ndarray) -> np.ndarray:
    """Depression-fill using Barnes et al. priority-flood.

    Reference: Barnes, R., Lehman, C., Mulla, D. (2014). Priority-flood: An
    optimal depression-filling and watershed-labeling algorithm for digital
    elevation models. Computers & Geosciences, 62, pp.117-127.
    https://doi.org/10.1016/j.cageo.2013.04.024

    Nodata cells are treated as having elevation = +∞ so they never become
    an outlet and do not fill.
    """
    import heapq

    h, w = z.shape
    filled = z.copy()
    filled[nodata] = np.inf

    seen = nodata.copy()          # nodata cells treated as "already processed"
    heap: list[tuple[float, int, int]] = []

    # Seed the heap with all border cells that are valid.
    for r in range(h):
        for c in [0, w - 1]:
            if not nodata[r, c]:
                heapq.heappush(heap, (filled[r, c], r, c))
                seen[r, c] = True
    for c in range(1, w - 1):
        for r in [0, h - 1]:
            if not nodata[r, c]:
                heapq.heappush(heap, (filled[r, c], r, c))
                seen[r, c] = True

    heapq.heapify(heap)

    while heap:
        e, r, c = heapq.heappop(heap)
        for dr, dc in _D8_OFFSETS:
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w and not seen[rr, cc]:
                seen[rr, cc] = True
                filled[rr, cc] = max(filled[rr, cc], e)
                heapq.heappush(heap, (filled[rr, cc], rr, cc))

    filled[nodata] = z[nodata]   # restore nodata to original values
    return filled


def _d8_direction(filled: np.ndarray, nodata: np.ndarray) -> np.ndarray:
    """Compute D8 flow-direction codes on the epsilon-filled surface.

    Codes follow the Esri convention:
        NE=1, N=2, NW=4, W=8, SW=16, S=32, SE=64, E=128
    Flat or nodata cells → 0.
    """
    h, w = filled.shape
    # Add tiny gradient so flats drain.
    eps = 1e-6
    rows, cols = np.mgrid[0:h, 0:w].astype(np.float64)
    # Gradient points south-east so cells near the border drain outward.
    jitter = eps * (rows + cols)
    f = filled + jitter

    d8 = np.zeros((h, w), dtype=np.uint8)
    best_slope = np.zeros((h, w), dtype=np.float64)

    for (dr, dc, code), length in zip(_D8_DIRS, _D8_LENGTHS):
        # Shift arrays using slicing to vectorize over all cells.
        r_src = slice(max(0, -dr),  h + min(0, -dr))
        c_src = slice(max(0, -dc),  w + min(0, -dc))
        r_nb  = slice(max(0,  dr),  h + min(0,  dr))
        c_nb  = slice(max(0,  dc),  w + min(0,  dc))

        drop = (f[r_src, c_src] - f[r_nb, c_nb]) / length

        # Only valid → valid transitions (no nodata in either cell).
        valid = ~nodata[r_src, c_src] & ~nodata[r_nb, c_nb] & (drop > best_slope[r_src, c_src])
        best_slope[r_src, c_src][valid] = drop[valid]
        d8[r_src, c_src][valid] = code

    d8[nodata] = 0
    return d8


def _flow_accumulation(
    filled: np.ndarray,
    d8: np.ndarray,
    nodata: np.ndarray,
) -> np.ndarray:
    """Compute upslope contributing area (cell count, including cell itself).

    Uses a topological sort (highest elevation first) to propagate counts
    downstream.  Complexity O(H·W·log(H·W)) due to argsort.
    """
    h, w = filled.shape
    acc = np.ones(h * w, dtype=np.float64)
    acc[nodata.ravel()] = 0.0

    # For each cell, find its D8 receiver index.
    receiver = np.full(h * w, -1, dtype=np.int64)
    flat_d8 = d8.ravel()
    for k, (dr, dc, code) in enumerate(_D8_DIRS):
        mask = (flat_d8 == code)
        rows_src = np.where(mask)[0] // w
        cols_src = np.where(mask)[0] %  w
        rows_nb  = rows_src + dr
        cols_nb  = cols_src + dc
        in_bounds = (
            (rows_nb >= 0) & (rows_nb < h) &
            (cols_nb >= 0) & (cols_nb < w)
        )
        idx = np.where(mask)[0][in_bounds]
        rr  = rows_nb[in_bounds]
        cc  = cols_nb[in_bounds]
        receiver[idx] = rr * w + cc

    # Process from highest to lowest elevation (stable so equal elevations are
    # processed consistently, giving deterministic output).
    order = np.argsort(-filled.ravel(), kind="stable")
    for i in order:
        if receiver[i] >= 0:
            acc[receiver[i]] += acc[i]

    return acc.reshape(h, w)


def _compute_stats(
    slope_deg: np.ndarray,
    depress_m: np.ndarray,
    flow_acc: np.ndarray,
    drain_net: np.ndarray,
    grid: ElevationGrid,
    nd: np.ndarray,
    cs: float,
) -> AnalysisStats:
    """Compute AnalysisStats from layer arrays."""
    valid_slope = slope_deg[~nd]
    mean_slope = float(valid_slope.mean()) if valid_slope.size else 0.0
    p90_slope  = float(np.percentile(valid_slope, 90)) if valid_slope.size else 0.0

    # --- Depressions (connected components above zero depth) ----------------
    depress_bool = (depress_m > 0.0) & ~nd
    n_dep, largest_area, largest_depth, largest_lon, largest_lat = (
        _depression_stats(depress_m, depress_bool, grid, cs)
    )

    # --- Drainage density ---------------------------------------------------
    total_area_m2  = float((~nd).sum()) * cs * cs
    channel_len_m  = float(drain_net.sum()) * cs
    drain_density  = channel_len_m / total_area_m2 if total_area_m2 > 0 else 0.0

    # Main channel: the spine of the drainage network (highest-flow cells).
    main_coords = _main_channel_coords(flow_acc, drain_net, grid, cs)

    return AnalysisStats(
        mean_slope_deg=mean_slope,
        p90_slope_deg=p90_slope,
        n_depressions=n_dep,
        largest_depression_area_m2=largest_area,
        largest_depression_depth_m=largest_depth,
        largest_depression_lon=largest_lon,
        largest_depression_lat=largest_lat,
        drainage_density_m_per_m2=drain_density,
        main_channel_coords=main_coords,
        nodata_fraction=float(nd.sum()) / nd.size,
    )


def _depression_stats(
    depress_m: np.ndarray,
    depress_bool: np.ndarray,
    grid: ElevationGrid,
    cs: float,
) -> tuple[int, float, float, float, float]:
    """Return (n_depressions, largest_area_m2, largest_depth_m, lon, lat)."""
    if not depress_bool.any():
        return 0, 0.0, 0.0, 0.0, 0.0

    try:
        from scipy.ndimage import label as scipy_label   # type: ignore[import]
        labeled, n = scipy_label(depress_bool)
    except ImportError:
        # Fallback: treat the whole depression mask as one object.
        n = 1
        labeled = depress_bool.astype(np.int32)

    best_area = 0.0
    best_depth = 0.0
    best_lon = 0.0
    best_lat = 0.0

    for lbl in range(1, n + 1):
        mask = labeled == lbl
        area = float(mask.sum()) * cs * cs
        depth = float(depress_m[mask].max())
        if area > best_area:
            best_area = area
            best_depth = depth
            # Centroid in grid coordinates → lon/lat (approximate)
            rows, cols = np.where(mask)
            cr = float(rows.mean())
            cc = float(cols.mean())
            best_lon, best_lat = _grid_to_lonlat(cr, cc, grid, cs)

    return n, best_area, best_depth, best_lon, best_lat


def _main_channel_coords(
    flow_acc: np.ndarray,
    drain_net: np.ndarray,
    grid: ElevationGrid,
    cs: float,
    *,
    max_points: int = 100,
) -> list[tuple[float, float]]:
    """Extract the main channel as a lon/lat polyline (up to max_points nodes).

    The main channel is defined as the cells on the drainage network with the
    highest flow accumulation, sorted from upstream to downstream.
    """
    if not drain_net.any():
        return []
    rows, cols = np.where(drain_net)
    acc_vals = flow_acc[rows, cols]

    # Sort by accumulation ascending (upstream first).
    order = np.argsort(acc_vals)
    rows, cols = rows[order], cols[order]

    # Down-sample if too many points.
    if len(rows) > max_points:
        idx = np.round(np.linspace(0, len(rows) - 1, max_points)).astype(int)
        rows, cols = rows[idx], cols[idx]

    return [_grid_to_lonlat(float(r), float(c), grid, cs) for r, c in zip(rows, cols)]


def _grid_to_lonlat(
    row: float,
    col: float,
    grid: ElevationGrid,
    cs: float,
) -> tuple[float, float]:
    """Convert fractional (row, col) to approximate WGS84 lon/lat.

    Uses the affine transform stored in grid.transform.
    transform = (x_west, cell_x, 0, y_north, 0, -cell_y)  — GDAL convention,
    origin at top-left corner.
    Centre of pixel: add 0.5 pixel offset before applying.
    Then inverts the UTM projection to WGS84.
    """
    try:
        import rasterio
        from rasterio.crs import CRS
        from rasterio.transform import Affine
        from rasterio.warp import transform as warp_transform

        t = grid.transform
        aff = Affine(t[1], t[2], t[0], t[4], t[5], t[3])
        x = t[0] + (col + 0.5) * t[1]
        y = t[3] + (row + 0.5) * t[5]  # t[5] is negative

        (lon_arr,), (lat_arr,) = warp_transform(
            CRS.from_string(grid.crs),
            CRS.from_epsg(4326),
            [x], [y],
        )
        return round(float(lon_arr), 6), round(float(lat_arr), 6)
    except Exception:
        return 0.0, 0.0
