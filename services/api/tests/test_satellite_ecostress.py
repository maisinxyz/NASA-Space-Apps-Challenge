"""EA4: ECOSTRESS ETdaily masks, granule iteration, and a local window. No network."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "seed_satellite"))

import ecostress  # noqa: E402
import sample  # noqa: E402
import series  # noqa: E402


def test_clear_land_mean_drops_cloud_water_fill_and_nan():
    et = np.array([
        [2.0, np.nan, 4.0],
        [-0.5, 9.0, 8.0],
        [3.0, 3.0, 100.0],
    ])
    cloud = np.array([
        [0, 0, 1],
        [0, 255, 0],
        [0, 0, 0],
    ], dtype=np.uint8)
    water = np.array([
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 0],
    ], dtype=np.uint8)
    east = np.array([
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [10_000.0, 10_000.0, 10_000.0],
    ])
    north = np.zeros((3, 3))
    mean, count = ecostress.scene_et_mean(et, cloud, water, east, north, radius_m=150)
    # Kept: 2.0 and -0.5. NaN, cloud 1, cloud fill 255, water 1, and the far pixel are out.
    assert count == 2
    assert mean == 0.75


def test_higher_product_iteration_replaces_the_same_acquisition():
    low = {"title": "ECOv003_L3T_JET_44992_008_18SUJ_20260612T114528_01", "time_start": "2026-06-12T11:45:28.222Z"}
    high = {"title": "ECOv003_L3T_JET_44992_008_18SUJ_20260612T114528_02", "time_start": "2026-06-12T11:45:28.222Z"}
    other = {"title": "ECOv003_L3T_JET_44992_007_18SUJ_20260612T114436_01", "time_start": "2026-06-12T11:44:36.252Z"}
    odd = {"title": "not-the-documented-pattern", "time_start": "2026-06-12T00:00:00Z"}
    kept, dropped = ecostress.prefer_granules([low, other, high, odd])
    titles = [item["title"] for item in kept]
    assert dropped == 1
    assert "ECOv003_L3T_JET_44992_008_18SUJ_20260612T114528_02" in titles
    assert low["title"] not in titles
    assert other["title"] in titles
    assert odd["title"] in titles


def test_weekly_mean_uses_the_scene_date_and_leaves_empty_weeks_null():
    rows = series.weekly_from_observations(
        [(date(2025, 1, 3), 1.5), (date(2025, 1, 4), 2.5)],
        [2025],
        ndigits=4,
    )
    assert rows[0]["values"][0] == 2.0
    assert rows[0]["n_obs"][0] == 2
    assert rows[0]["values"][1] is None
    assert rows[0]["n_obs"][1] == 0


def test_local_geotiff_et_window(tmp_path: Path):
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import transform

    lon, lat = -76.8844, 39.0319
    xs, ys = transform("EPSG:4326", "EPSG:32618", [lon], [lat])
    x0, y0 = float(xs[0]), float(ys[0])
    # Cell (2, 2) is centred on the point. Corner centres are 140 m on both axes, outside 150 m.
    transform_aff = from_origin(x0 - 175.0, y0 + 175.0, 70.0, 70.0)
    et = np.full((5, 5), 3.0, dtype=np.float32)
    cloud = np.zeros((5, 5), dtype=np.uint8)
    water = np.zeros((5, 5), dtype=np.uint8)
    et[0, 2] = np.nan
    cloud[2, 0] = 1
    water[2, 4] = 1
    for name, arr in (("et.tif", et), ("cloud.tif", cloud), ("water.tif", water)):
        with rasterio.open(
            tmp_path / name, "w", driver="GTiff", width=5, height=5, count=1,
            dtype=arr.dtype, crs="EPSG:32618", transform=transform_aff,
        ) as dst:
            dst.write(arr, 1)
    opened = [sample.read_window(str(tmp_path / name), lon, lat, 150) for name in ("et.tif", "cloud.tif", "water.tif")]
    assert all(item is not None for item in opened)
    mean, count = ecostress.scene_et_mean(
        opened[0]["data"], opened[1]["data"], opened[2]["data"],
        opened[0]["east_m"], opened[0]["north_m"], 150,
    )
    # 13 centres fall inside 150 m. The NaN, cloud, and water pixels are three of those.
    assert count == 10
    assert mean == 3.0
