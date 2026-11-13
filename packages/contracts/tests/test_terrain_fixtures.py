import json
import struct
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from fixtures_lib import encoding as enc
from fixtures_lib import ftw1, mock_sim
from fixtures_lib import terrain as T

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def _decode(terrain_id: str) -> np.ndarray:
    pkg = json.loads((FIXTURES / "terrain" / terrain_id / "terrain.json").read_text())
    v = enc.load_png16(FIXTURES / "terrain" / terrain_id / "heightmap.png")
    return enc.decode_heightmap(v, pkg["elevation"]["min_m"], pkg["elevation"]["max_m"])


@pytest.mark.parametrize("make", T.ALL_TERRAINS)
def test_heightmap_round_trip_within_1cm(make):
    t = make()
    with Image.open(FIXTURES / "terrain" / t.id / "heightmap.png") as im:
        assert im.mode.startswith("I;16")
    decoded = _decode(t.id)
    assert decoded.shape == (T.SIZE, T.SIZE)
    assert np.max(np.abs(decoded - t.z)) < 0.01


def test_tilted_plane_decodes_as_plane():
    z = _decode("terr_mock_tilted")
    rows, cols = np.mgrid[0 : T.SIZE, 0 : T.SIZE]
    x_m = cols.ravel() * T.CELL_SIZE_M
    y_m = (T.SIZE - 1 - rows.ravel()) * T.CELL_SIZE_M  # row 0 = north
    A = np.column_stack([np.ones_like(x_m), x_m, y_m])
    coef, *_ = np.linalg.lstsq(A, z.ravel(), rcond=None)
    residual = z.ravel() - A @ coef
    assert np.max(np.abs(residual)) < 0.01
    assert coef[1] == pytest.approx(T.TILT_DZ_DEAST, abs=1e-4)
    assert coef[2] == pytest.approx(T.TILT_DZ_DNORTH, abs=1e-4)


def test_bowl_depression_has_known_depth():
    b = np.array(Image.open(FIXTURES / "terrain" / "terr_mock_bowl" / "layers" / "depressions.png"))
    depth = enc.decode_continuous(b, "depressions")
    assert np.nanmax(depth) == pytest.approx(T.BOWL_DEPTH_M, abs=0.02)


def test_cover_class_uses_only_indexed_values():
    for make in T.ALL_TERRAINS:
        t = make()
        b = np.array(Image.open(FIXTURES / "terrain" / t.id / "layers" / "cover_class.png"))
        assert set(np.unique(b)) <= {0, 1, 2, 3, 255}


def test_ftw1_round_trip():
    rng = np.random.default_rng(1)
    frames = rng.integers(0, 256, size=(5, 7, 11), dtype=np.uint8)
    out = ftw1.from_bytes(ftw1.to_bytes(frames, 123.5))
    assert (out.width, out.height, out.frame_count) == (11, 7, 5)
    assert out.max_depth_mm == pytest.approx(123.5)
    assert np.array_equal(out.frames, frames)


def test_ftw1_header_bytes_match_spec():
    frames = np.zeros((3, 2, 4), dtype=np.uint8)
    data = ftw1.to_bytes(frames, 50.0)
    assert data[0:4] == b"FTW1"
    assert data[4:6] == (4).to_bytes(2, "little")  # width
    assert data[6:8] == (2).to_bytes(2, "little")  # height
    assert data[8:10] == (3).to_bytes(2, "little")  # frame_count
    assert data[10] == 1  # dtype uint8
    assert data[11] == 0  # reserved
    assert data[12:16] == struct.pack("<f", 50.0)
    assert len(data) == 16 + 3 * 2 * 4


@pytest.mark.parametrize("rot", mock_sim.ROTATIONS)
def test_fixture_frame_files(rot):
    f = ftw1.read_ftw1(FIXTURES / "simulations" / mock_sim.SIM_ID / "frames" / f"{rot}.bin")
    assert (f.width, f.height, f.frame_count) == (T.SIZE, T.SIZE, mock_sim.FRAME_COUNT)
    assert f.max_depth_mm > 0


def test_more_cover_means_less_water():
    peaks = {
        rot: ftw1.read_ftw1(FIXTURES / "simulations" / mock_sim.SIM_ID / "frames" / f"{rot}.bin").depth_mm().max(axis=0).sum()
        for rot in mock_sim.ROTATIONS
    }
    assert peaks["rot_existing"] > peaks["rot_cover"] > peaks["rot_forage"]


def test_fixture_size_budget():
    total = sum(p.stat().st_size for p in FIXTURES.rglob("*") if p.is_file())
    assert total < 15e6
