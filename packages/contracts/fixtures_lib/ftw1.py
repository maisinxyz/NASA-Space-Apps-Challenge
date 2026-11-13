"""FTW1 water-depth frame file (PRD §6.4). Binary, little-endian.

bytes 0-3    magic "FTW1"
bytes 4-5    u16 width
bytes 6-7    u16 height
bytes 8-9    u16 frame_count
byte  10     u8  dtype (1 = uint8)
byte  11     u8  reserved
bytes 12-15  f32 max_depth_mm (value 255 maps to this depth)
bytes 16-... frame_count * width * height bytes, frames in time order

depth_mm = byte * max_depth_mm / 255
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

MAGIC = b"FTW1"
DTYPE_UINT8 = 1
HEADER = struct.Struct("<4sHHHBBf")  # 16 bytes
assert HEADER.size == 16


@dataclass(frozen=True)
class Ftw1:
    width: int
    height: int
    frame_count: int
    max_depth_mm: float
    frames: np.ndarray  # uint8, shape (frame_count, height, width)

    def depth_mm(self) -> np.ndarray:
        return self.frames.astype(np.float32) * (self.max_depth_mm / 255.0)


def encode_depths(depth_mm: np.ndarray) -> tuple[np.ndarray, float]:
    """Quantize float depths (frames, h, w) to uint8 bytes plus max_depth_mm."""
    max_depth = float(np.max(depth_mm)) if depth_mm.size else 0.0
    if max_depth <= 0:
        return np.zeros(depth_mm.shape, dtype=np.uint8), 0.0
    # Round-trip through float32 so the header value matches what readers see.
    max_depth = float(np.float32(max_depth))
    q = np.clip(np.rint(depth_mm / max_depth * 255.0), 0, 255).astype(np.uint8)
    return q, max_depth


def to_bytes(frames: np.ndarray, max_depth_mm: float) -> bytes:
    if frames.dtype != np.uint8 or frames.ndim != 3:
        raise ValueError("frames must be uint8 with shape (frame_count, height, width)")
    frame_count, height, width = frames.shape
    for v in (width, height, frame_count):
        if not 0 < v <= 0xFFFF:
            raise ValueError("width, height and frame_count must fit in u16 and be > 0")
    header = HEADER.pack(MAGIC, width, height, frame_count, DTYPE_UINT8, 0, max_depth_mm)
    return header + np.ascontiguousarray(frames).tobytes(order="C")


def from_bytes(data: bytes) -> Ftw1:
    if len(data) < HEADER.size:
        raise ValueError("file shorter than FTW1 header")
    magic, width, height, frame_count, dtype, _reserved, max_depth = HEADER.unpack_from(data, 0)
    if magic != MAGIC:
        raise ValueError(f"bad magic {magic!r}")
    if dtype != DTYPE_UINT8:
        raise ValueError(f"unsupported dtype {dtype}")
    expected = HEADER.size + frame_count * width * height
    if len(data) != expected:
        raise ValueError(f"expected {expected} bytes, got {len(data)}")
    frames = np.frombuffer(data, dtype=np.uint8, offset=HEADER.size).reshape(frame_count, height, width)
    return Ftw1(width, height, frame_count, float(max_depth), frames.copy())


def write_ftw1(path: str | Path, frames: np.ndarray, max_depth_mm: float) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_bytes(to_bytes(frames, max_depth_mm))


def read_ftw1(path: str | Path) -> Ftw1:
    return from_bytes(Path(path).read_bytes())
