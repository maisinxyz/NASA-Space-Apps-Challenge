"""Deterministic procedural mock terrains and simple hydrology for fixtures.

Everything here is MOCK: simple approximations to exercise the contract, not real analysis.
Grid convention: row 0 = north edge, col 0 = west edge.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass

import numpy as np

from . import encoding as enc

SIZE = 256
CELL_SIZE_M = 2.0
SEED = 20261114

# Mock location near the PRD's Okanagan example. 256 cells * 2 m = 512 m per side.
ORIGIN_LON, ORIGIN_LAT = -119.6, 49.1  # south-west corner
_M_PER_DEG_LAT = 111_132.0
_M_PER_DEG_LON = 111_320.0 * np.cos(np.radians(ORIGIN_LAT + 0.0023))

BOWL_DEPTH_M = 2.0  # terr_mock_bowl: exact depth of its single depression
BOWL_RADIUS_CELLS = 60
TILT_DZ_DEAST = 0.05  # terr_mock_tilted: m per m east
TILT_DZ_DNORTH = 0.02  # m per m north
TILT_BASE_M = 300.0


@dataclass(frozen=True)
class MockTerrain:
    id: str
    name: str
    z: np.ndarray  # float64 elevations (m), shape (SIZE, SIZE)
    cover: np.ndarray  # uint8 cover_class


def bbox_wgs84() -> list[float]:
    side = SIZE * CELL_SIZE_M
    return [
        ORIGIN_LON,
        ORIGIN_LAT,
        round(ORIGIN_LON + side / _M_PER_DEG_LON, 6),
        round(ORIGIN_LAT + side / _M_PER_DEG_LAT, 6),
    ]


def cell_to_lonlat(row: float, col: float) -> tuple[float, float]:
    """Center of a cell in WGS84 (approximate, mock)."""
    x_m = (col + 0.5) * CELL_SIZE_M
    y_m = (SIZE - row - 0.5) * CELL_SIZE_M
    return (round(ORIGIN_LON + x_m / _M_PER_DEG_LON, 6), round(ORIGIN_LAT + y_m / _M_PER_DEG_LAT, 6))


def _grids() -> tuple[np.ndarray, np.ndarray]:
    rows, cols = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    return rows, cols


def _gauss(rows, cols, r0, c0, sigma):
    return np.exp(-((rows - r0) ** 2 + (cols - c0) ** 2) / (2 * sigma**2))


# Hills: features used by insights/evidence fixtures.
HILLS_BOWL_CENTER = (70, 190)
HILLS_BARE_PATCH = (150, 175, 30, 75)  # row0, row1, col0, col1
HILLS_ROAD_ROWS = (200, 203)
HILLS_YARD = (215, 245, 200, 240)


def make_hills() -> MockTerrain:
    rng = np.random.default_rng(SEED)
    rows, cols = _grids()
    # Gentle tilt down toward the south so the valley drains off the south edge.
    z = 320.0 + 0.04 * (SIZE - rows) + 0.01 * cols
    for _ in range(9):
        r0, c0 = rng.uniform(0, SIZE, 2)
        amp = rng.uniform(3.0, 10.0)
        sigma = rng.uniform(18.0, 45.0)
        z += amp * _gauss(rows, cols, r0, c0, sigma)
    # Sinuous valley running north -> south.
    center = 110 + 22 * np.sin(rows / 38.0)
    z -= 7.0 * np.exp(-((cols - center) ** 2) / (2 * 11.0**2))
    # Closed bowl.
    z -= 3.5 * _gauss(rows, cols, *HILLS_BOWL_CENTER, 13.0)

    cover = np.full((SIZE, SIZE), enc.COVER_VEGETATION, dtype=np.uint8)
    r0, r1, c0, c1 = HILLS_BARE_PATCH
    cover[r0:r1, c0:c1] = enc.COVER_BARE
    cover[HILLS_ROAD_ROWS[0] : HILLS_ROAD_ROWS[1], :] = enc.COVER_OTHER
    r0, r1, c0, c1 = HILLS_YARD
    cover[r0:r1, c0:c1] = enc.COVER_OTHER
    bowl = _gauss(rows, cols, *HILLS_BOWL_CENTER, 13.0)
    cover[bowl > 0.75] = enc.COVER_WATER
    cover[:6, :6] = enc.NODATA
    return MockTerrain("terr_mock_hills", "Mock hills with valley and bowl (mock)", z, cover)


def make_tilted() -> MockTerrain:
    rows, cols = _grids()
    x_m = cols * CELL_SIZE_M
    y_m = (SIZE - 1 - rows) * CELL_SIZE_M
    z = TILT_BASE_M + TILT_DZ_DEAST * x_m + TILT_DZ_DNORTH * y_m
    cover = np.full((SIZE, SIZE), enc.COVER_VEGETATION, dtype=np.uint8)
    cover[100:140, 100:160] = enc.COVER_BARE
    return MockTerrain("terr_mock_tilted", "Mock tilted plane (mock)", z, cover)


def make_bowl() -> MockTerrain:
    rows, cols = _grids()
    r2 = (rows - SIZE // 2) ** 2 + (cols - SIZE // 2) ** 2
    frac = np.clip(1.0 - r2 / BOWL_RADIUS_CELLS**2, 0.0, None)
    z = 300.0 - BOWL_DEPTH_M * frac
    cover = np.full((SIZE, SIZE), enc.COVER_VEGETATION, dtype=np.uint8)
    cover[30:60, 30:90] = enc.COVER_BARE
    return MockTerrain("terr_mock_bowl", "Mock single bowl (mock)", z, cover)


ALL_TERRAINS = (make_hills, make_tilted, make_bowl)

_NEIGHBORS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def priority_flood(z: np.ndarray, eps: float = 0.0) -> np.ndarray:
    """Fill depressions (Barnes et al. priority-flood). With eps > 0, flats get a tiny gradient."""
    h, w = z.shape
    filled = z.copy()
    seen = np.zeros(z.shape, dtype=bool)
    heap: list[tuple[float, int, int]] = []
    for r in range(h):
        for c in (0, w - 1):
            heap.append((filled[r, c], r, c))
            seen[r, c] = True
    for c in range(1, w - 1):
        for r in (0, h - 1):
            heap.append((filled[r, c], r, c))
            seen[r, c] = True
    heapq.heapify(heap)
    while heap:
        e, r, c = heapq.heappop(heap)
        for dr, dc in _NEIGHBORS:
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w and not seen[rr, cc]:
                seen[rr, cc] = True
                filled[rr, cc] = max(filled[rr, cc], e + eps)
                heapq.heappush(heap, (filled[rr, cc], rr, cc))
    return filled


def depression_depth(z: np.ndarray) -> np.ndarray:
    return np.clip(priority_flood(z) - z, 0.0, None)


def flow_accumulation(z: np.ndarray) -> np.ndarray:
    """D8 upslope cell count (including the cell itself) on an epsilon-filled surface."""
    f = priority_flood(z, eps=1e-5)
    h, w = f.shape
    padded = np.pad(f, 1, constant_values=np.inf)
    best_drop = np.zeros_like(f)
    receiver = np.full(f.shape, -1, dtype=np.int64)
    idx = np.arange(h * w).reshape(h, w)
    padded_idx = np.pad(idx, 1, constant_values=-1)
    for dr, dc in _NEIGHBORS:
        nb = padded[1 + dr : 1 + dr + h, 1 + dc : 1 + dc + w]
        drop = (f - nb) / np.hypot(dr, dc)
        better = drop > best_drop
        best_drop[better] = drop[better]
        receiver[better] = padded_idx[1 + dr : 1 + dr + h, 1 + dc : 1 + dc + w][better]
    acc = np.ones(h * w, dtype=np.float64)
    rec = receiver.ravel()
    for i in np.argsort(-f.ravel(), kind="stable"):
        if rec[i] >= 0:
            acc[rec[i]] += acc[i]
    return acc.reshape(h, w)
