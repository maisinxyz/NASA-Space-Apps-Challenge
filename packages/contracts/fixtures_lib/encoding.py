"""Raster encodings from packages/contracts/README.md (PRD §6.2 + contract decisions)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

NODATA = 255
MOCK_COMMENT = "FieldTwin MOCK fixture - not real data"

# Physical value ranges used to encode continuous layers (bytes 0-254 linear, 255 nodata).
# Prompt 04's layers.json legends must use the same numbers.
LAYER_RANGES = {
    "slope": (0.0, 30.0),  # degrees
    "flow_accumulation": (0.0, 5.0),  # log10(upslope cells)
    "depressions": (0.0, 4.0),  # m of fill depth
}

COVER_OTHER, COVER_VEGETATION, COVER_BARE, COVER_WATER = 0, 1, 2, 3


def _mock_info() -> PngInfo:
    info = PngInfo()
    info.add_text("Comment", MOCK_COMMENT)
    return info


def encode_heightmap(z: np.ndarray) -> tuple[np.ndarray, float, float]:
    """Return (uint16 values, min_m, max_m). elevation = min + v/65535*(max-min)."""
    zmin, zmax = float(z.min()), float(z.max())
    span = zmax - zmin
    if span == 0:
        return np.zeros(z.shape, dtype=np.uint16), zmin, zmax
    v = np.rint((z - zmin) / span * 65535.0).astype(np.uint16)
    return v, zmin, zmax


def decode_heightmap(v: np.ndarray, min_m: float, max_m: float) -> np.ndarray:
    return min_m + (v.astype(np.float64) / 65535.0) * (max_m - min_m)


def save_png16(path: Path, v: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(v.astype(np.uint16)).save(path, pnginfo=_mock_info(), optimize=True)


def load_png16(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        return np.array(im, dtype=np.uint16)


def save_png8(path: Path, v: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(v.astype(np.uint8)).save(path, pnginfo=_mock_info(), optimize=True)


def encode_continuous(values: np.ndarray, layer: str, nodata_mask: np.ndarray | None = None) -> np.ndarray:
    lo, hi = LAYER_RANGES[layer]
    b = np.rint(np.clip((values - lo) / (hi - lo), 0, 1) * 254).astype(np.uint8)
    if nodata_mask is not None:
        b[nodata_mask] = NODATA
    return b


def decode_continuous(b: np.ndarray, layer: str) -> np.ndarray:
    lo, hi = LAYER_RANGES[layer]
    out = lo + b.astype(np.float64) / 254.0 * (hi - lo)
    out[b == NODATA] = np.nan
    return out


def encode_normals(z: np.ndarray, cell_size_m: float) -> np.ndarray:
    """RGB normal map: n = byte/255*2-1, R east (+col), G north (-row), B up."""
    dz_drow, dz_dcol = np.gradient(z, cell_size_m)
    dz_deast = dz_dcol
    dz_dnorth = -dz_drow
    n = np.stack([-dz_deast, -dz_dnorth, np.ones_like(z)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return np.rint((n + 1.0) / 2.0 * 255.0).astype(np.uint8)


def slope_degrees(z: np.ndarray, cell_size_m: float) -> np.ndarray:
    dz_drow, dz_dcol = np.gradient(z, cell_size_m)
    return np.degrees(np.arctan(np.hypot(dz_drow, dz_dcol)))
