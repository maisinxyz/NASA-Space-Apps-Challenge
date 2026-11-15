"""EA2: HLS NDVI math, week means, and seed files. No network and no real token."""

from __future__ import annotations

import gzip
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "seed_satellite"))

import sample  # noqa: E402
import series  # noqa: E402


def test_fmask_bits_and_ndvi_ratio():
    qa = np.array([0, 1 << 1, 1 << 5, 255, 64, 192, 100], dtype=np.uint8)
    clear = sample.fmask_clear(qa)
    assert clear.tolist() == [True, False, False, False, True, False, False]
    red = np.array([[1000, -9999], [12000, 1000]])
    nir = np.array([[3000, 3000], [3000, 3000]])
    mask = np.zeros((2, 2), dtype=np.uint8)
    east = np.array([[0.0, 0.0], [0.0, 10_000.0]])
    north = np.zeros((2, 2))
    mean, count = sample.scene_ndvi_mean(red, nir, mask, east, north, radius_m=150)
    assert count == 1
    assert mean == 0.5
    # (0.3 - 0.1) / (0.3 + 0.1) = 0.5. The far pixel is outside the radius.
    # Fill and saturation are inside the radius and are dropped.


def test_href_named_requires_one_band_file():
    hrefs = [
        "https://data.lpdaac.earthdatacloud.nasa.gov/tile/HLS.L30.T10UDV.2024158.v2.0.B04.tif",
        "https://data.lpdaac.earthdatacloud.nasa.gov/tile/HLS.L30.T10UDV.2024158.v2.0.B05.tif",
        "https://data.lpdaac.earthdatacloud.nasa.gov/tile/HLS.L30.T10UDV.2024158.v2.0.Fmask.tif",
        "https://data.lpdaac.earthdatacloud.nasa.gov/tile/HLS.S30.T10UDV.2024153.v2.0.B8A.tif",
    ]
    assert sample.href_named(hrefs, ".B04.tif").endswith(".B04.tif")
    assert sample.href_named(hrefs, ".B8A.tif").endswith(".B8A.tif")
    assert sample.href_named(hrefs, ".B06.tif") is None


def test_weekly_means_fold_day_366_and_do_not_fill():
    observations = [
        (date(2024, 1, 1), 0.2),
        (date(2024, 1, 2), 0.4),
        (date(2024, 12, 31), 0.8),
    ]
    rows = series.weekly_from_observations(observations, [2024, 2025], ndigits=4)
    assert [row["year"] for row in rows] == [2024, 2025]
    assert rows[0]["values"][0] == 0.3
    assert rows[0]["n_obs"][0] == 2
    assert rows[0]["values"][51] == 0.8
    assert rows[0]["n_obs"][51] == 1
    assert rows[0]["values"][10] is None
    assert rows[0]["n_obs"][10] == 0
    assert all(value is None and count == 0 for value, count in zip(rows[1]["values"], rows[1]["n_obs"]))
    assert series.weeks_with_data(rows) == 2


def test_gap_file_strips_a_secret_and_series_removes_the_gap(tmp_path: Path):
    secret = "unit-test-token"
    meta = {
        "source_name": "HLS",
        "source_url": "https://doi.org/10.5067/HLS/HLSL30.002",
        "product_version": "2.0",
        "retrieved_on": "2026-11-15",
        "license": "Public domain (CC0)",
        "attribution": "NASA HLS",
        "resolution_spatial": "30 m",
        "resolution_temporal": "weekly",
        "processing_notes": f"rejected {secret}",
    }
    series.write_gap(
        "site_ubc_farm", "ndvi", reason=f"bearer {secret} was rejected",
        candidates=[{"short_name": "HLSL30", "version": "2.0"}], meta=meta,
        root=tmp_path, secret=secret,
    )
    gap = json.loads((tmp_path / "site_ubc_farm" / "ndvi.gap.json").read_text(encoding="utf-8"))
    assert gap["data_mode"] == "limited_data"
    assert gap["weekly"] is None
    assert secret not in json.dumps(gap)
    stored = json.loads((tmp_path / "site_ubc_farm" / "ndvi.meta.json").read_text(encoding="utf-8"))
    assert secret not in stored["processing_notes"]
    doc = {"site_id": "site_ubc_farm", "layer": "ndvi", "weekly": []}
    series.write_series("site_ubc_farm", "ndvi", doc, meta, root=tmp_path)
    assert not (tmp_path / "site_ubc_farm" / "ndvi.gap.json").is_file()
    with gzip.open(tmp_path / "site_ubc_farm" / "ndvi.json.gz", "rt", encoding="utf-8") as handle:
        assert json.load(handle)["layer"] == "ndvi"


def test_local_geotiff_window_mean(tmp_path: Path):
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import transform

    lon, lat = -123.238, 49.2517
    xs, ys = transform("EPSG:4326", "EPSG:32610", [lon], [lat])
    x0, y0 = float(xs[0]), float(ys[0])
    transform_aff = from_origin(x0 - 75.0, y0 + 75.0, 30.0, 30.0)
    red = np.full((5, 5), 1000, dtype=np.int16)
    nir = np.full((5, 5), 3000, dtype=np.int16)
    qa = np.zeros((5, 5), dtype=np.uint8)
    qa[0, 0] = 1 << 1
    red[0, 1] = -9999
    for name, arr in (("red.tif", red), ("nir.tif", nir), ("qa.tif", qa)):
        with rasterio.open(
            tmp_path / name, "w", driver="GTiff", width=5, height=5, count=1,
            dtype=arr.dtype, crs="EPSG:32610", transform=transform_aff,
        ) as dst:
            dst.write(arr, 1)
    opened = [sample.read_window(str(tmp_path / name), lon, lat, 150) for name in ("red.tif", "nir.tif", "qa.tif")]
    assert all(item is not None for item in opened)
    mean, count = sample.scene_ndvi_mean(
        opened[0]["data"], opened[1]["data"], opened[2]["data"],
        opened[0]["east_m"], opened[0]["north_m"], 150,
    )
    assert count == 23
    assert abs(mean - 0.5) < 1e-9
