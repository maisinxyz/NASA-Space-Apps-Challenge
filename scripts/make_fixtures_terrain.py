"""Generate MOCK terrain, frame, risk and diff fixtures (Prompt 03). Deterministic.

Run: make fixtures   (or: uv run --project packages/contracts python scripts/make_fixtures_terrain.py)
Writes into packages/contracts/fixtures/terrain/ and fixtures/simulations/sim_mock_001/.
"""

from __future__ import annotations

import json
import sys
from itertools import permutations
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "packages" / "contracts"
sys.path.insert(0, str(CONTRACTS))

from fixtures_lib import encoding as enc  # noqa: E402
from fixtures_lib import ftw1  # noqa: E402
from fixtures_lib import mock_sim  # noqa: E402
from fixtures_lib import terrain as T  # noqa: E402

FIXTURES = CONTRACTS / "fixtures"
CREATED_AT = "2026-11-14T00:00:00Z"  # fixed for determinism

TEXTURE_PX = 512
COVER_RGB = {
    enc.COVER_OTHER: (150, 142, 128),
    enc.COVER_VEGETATION: (92, 128, 64),
    enc.COVER_BARE: (110, 84, 58),
    enc.COVER_WATER: (70, 96, 110),
    enc.NODATA: (40, 40, 40),
}


def make_texture(t: T.MockTerrain, normals: np.ndarray) -> np.ndarray:
    rng = np.random.default_rng(T.SEED + 1)
    rgb = np.zeros((T.SIZE, T.SIZE, 3), dtype=np.float64)
    for cls, color in COVER_RGB.items():
        rgb[t.cover == cls] = color
    # "Field" rectangles: alternating crop shades on vegetated cells.
    rows, cols = np.mgrid[0 : T.SIZE, 0 : T.SIZE]
    field = ((rows // 64) + (cols // 48)) % 3
    veg = t.cover == enc.COVER_VEGETATION
    for k, shift in enumerate([(0, 0, 0), (25, 20, -5), (-15, 10, 10)]):
        sel = veg & (field == k)
        rgb[sel] += shift
    # Crop-row stripes and noise.
    rgb[veg] += (np.sin(cols * 1.3)[veg] * 6)[:, None]
    rgb += rng.normal(0, 5, rgb.shape)
    # Hillshade from the normal map (light from north-west).
    n = normals.astype(np.float64) / 255.0 * 2 - 1
    light = np.array([-0.5, 0.5, 0.7])
    light /= np.linalg.norm(light)
    shade = np.clip(n @ light, 0, 1)
    rgb *= (0.6 + 0.5 * shade)[..., None]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    return np.array(img.resize((TEXTURE_PX, TEXTURE_PX), Image.Resampling.BILINEAR))


def terrain_package(t: T.MockTerrain, zmin: float, zmax: float) -> dict:
    base = f"/api/v1/terrain/{t.id}"
    bbox = T.bbox_wgs84()
    return {
        "id": t.id,
        "name": t.name,
        "site_id": None,
        "bbox_wgs84": bbox,
        "crs": "EPSG:32611",
        "grid": {"width": T.SIZE, "height": T.SIZE, "cell_size_m": T.CELL_SIZE_M, "nodata_fraction": 0.0},
        "elevation": {"min_m": round(zmin, 6), "max_m": round(zmax, 6), "model": "DTM", "vertical_datum": "to_verify"},
        "assets": {
            "heightmap": f"{base}/heightmap.png",
            "normal_map": f"{base}/normal.png",
            "texture": f"{base}/texture.jpg",
            "layers": {name: f"{base}/layers/{name}.png" for name in ("slope", "flow_accumulation", "depressions", "cover_class")},
        },
        "texture": {
            "bounds_wgs84": bbox,
            "source": "user_upload",
            "resolution_m": round(T.SIZE * T.CELL_SIZE_M / TEXTURE_PX, 3),
            "license": "mock (generated, no license restrictions)",
            "attribution": "Procedurally generated mock texture",
        },
        "sources": [
            {
                "name": "Procedural mock terrain (fixtures_lib.terrain)",
                "role": "elevation",
                "resolution_m": T.CELL_SIZE_M,
                "license": "mock (generated, no license restrictions)",
                "url": "packages/contracts/fixtures_lib/terrain.py",
                "basis": "assumed",
            }
        ],
        "quality_flags": ["mock_data", "texture_alignment_assumed"],
        "created_at": CREATED_AT,
    }


def write_terrain(t: T.MockTerrain) -> dict:
    out = FIXTURES / "terrain" / t.id
    v, zmin, zmax = enc.encode_heightmap(t.z)
    enc.save_png16(out / "heightmap.png", v)
    normals = enc.encode_normals(t.z, T.CELL_SIZE_M)
    enc.save_png8(out / "normal.png", normals)
    Image.fromarray(make_texture(t, normals)).save(out / "texture.jpg", quality=85, comment=enc.MOCK_COMMENT.encode())

    nodata = t.cover == enc.NODATA
    slope = enc.slope_degrees(t.z, T.CELL_SIZE_M)
    acc = T.flow_accumulation(t.z)
    dep = T.depression_depth(t.z)
    layers = out / "layers"
    enc.save_png8(layers / "slope.png", enc.encode_continuous(slope, "slope"))
    enc.save_png8(layers / "flow_accumulation.png", enc.encode_continuous(np.log10(acc), "flow_accumulation"))
    enc.save_png8(layers / "depressions.png", enc.encode_continuous(dep, "depressions"))
    enc.save_png8(layers / "cover_class.png", t.cover)

    pkg = terrain_package(t, zmin, zmax)
    (out / "terrain.json").write_text(json.dumps(pkg, indent=2) + "\n")
    print(f"  {t.id}: z {zmin:.2f}-{zmax:.2f} m, max depression {dep.max():.2f} m, nodata cover {int(nodata.sum())} cells")
    return {"slope": slope, "acc": acc, "dep": dep}


def write_simulation(t: T.MockTerrain, a: dict) -> None:
    out = FIXTURES / "simulations" / mock_sim.SIM_ID
    peaks = {}
    for rot in mock_sim.ROTATIONS:
        depth = mock_sim.depth_frames_mm(rot, a["dep"], a["acc"], t.cover)
        frames, max_depth = ftw1.encode_depths(depth)
        ftw1.write_ftw1(out / "frames" / f"{rot}.bin", frames, max_depth)
        decoded = ftw1.read_ftw1(out / "frames" / f"{rot}.bin").depth_mm()
        peaks[rot] = mock_sim.peak_depth_mm(decoded)
        enc.save_png8(out / "risk" / f"{rot}.png", mock_sim.risk_index(rot, a["slope"], a["acc"], t.cover))
        print(f"  {rot}: max depth {max_depth:.1f} mm")
    mask = t.cover == enc.NODATA
    for ra, rb in permutations(mock_sim.ROTATIONS, 2):
        b, _ = mock_sim.encode_diff(peaks[rb] - peaks[ra], mask)
        enc.save_png8(out / "diff" / f"{ra}__{rb}.png", b)


def main() -> None:
    print("Writing mock terrain fixtures...")
    analyses = {}
    terrains = {}
    for make in T.ALL_TERRAINS:
        t = make()
        terrains[t.id] = t
        analyses[t.id] = write_terrain(t)
    print("Writing mock simulation fixtures...")
    write_simulation(terrains[mock_sim.TERRAIN_ID], analyses[mock_sim.TERRAIN_ID])
    total = sum(p.stat().st_size for p in FIXTURES.rglob("*") if p.is_file())
    print(f"Done. fixtures/ total {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
