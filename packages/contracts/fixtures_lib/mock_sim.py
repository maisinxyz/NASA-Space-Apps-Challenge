"""Fake (MOCK) water animation, risk grid, and diff grid for sim_mock_001 on terr_mock_hills.

Not a simulation: shapes are chosen so water gathers in the valley and bowl, with less water
under rotations that keep more cover. Real logic arrives with BE-08.
"""

from __future__ import annotations

import numpy as np

from . import encoding as enc

SIM_ID = "sim_mock_001"
TERRAIN_ID = "terr_mock_hills"
STORM_ID = "storm_mock_1"
FRAME_COUNT = 60
STEP_MINUTES = 72  # 60 frames x 72 min = a 72-hour storm window
ROTATIONS = ("rot_existing", "rot_cover", "rot_forage")
# Relative water / erosion multiplier per rotation (more cover -> less).
ROTATION_FACTOR = {"rot_existing": 1.0, "rot_cover": 0.62, "rot_forage": 0.45}
PONDED_THRESHOLD_MM = 10.0
DIFF_CHANGED_MM = 1.0


def frame_times_min() -> list[float]:
    return [float(i * STEP_MINUTES) for i in range(FRAME_COUNT)]


def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def depth_frames_mm(rotation: str, dep_m: np.ndarray, acc: np.ndarray, cover: np.ndarray) -> np.ndarray:
    f = ROTATION_FACTOR[rotation]
    t = np.arange(FRAME_COUNT, dtype=np.float64)
    pond_t = _smoothstep((t - 6) / 36.0) * (1.0 - 0.15 * _smoothstep((t - 45) / 14.0))
    chan_t = np.exp(-((t - 28) ** 2) / (2 * 9.0**2))
    sheet_t = np.exp(-((t - 22) ** 2) / (2 * 7.0**2))

    pond = dep_m * 1000.0 * (0.35 + 0.65 * f)  # mm, partial fill of the depression
    logacc = np.log10(acc)
    chan = 80.0 * f * np.clip((logacc - 2.0) / (logacc.max() - 2.0), 0, 1) ** 1.5
    sheet = np.where(cover == enc.COVER_BARE, 4.0, 1.5) * f

    out = (
        pond[None] * pond_t[:, None, None]
        + chan[None] * chan_t[:, None, None]
        + sheet[None] * sheet_t[:, None, None]
    )
    return out.astype(np.float32)


def risk_index(rotation: str, slope_deg: np.ndarray, acc: np.ndarray, cover: np.ndarray) -> np.ndarray:
    """Relative erosion-risk index 0-100 (uint8), 255 masked. Normalized to rot_existing's max."""

    def raw(rot):
        cf = np.where(cover == enc.COVER_BARE, 1.0, ROTATION_FACTOR[rot])
        s = np.clip(slope_deg / 15.0, 0, 1) ** 0.8
        a = 0.3 + 0.7 * np.clip(np.log10(acc) / 4.0, 0, 1)
        return s * a * cf

    base_max = raw("rot_existing").max()
    idx = np.rint(np.clip(raw(rotation) / base_max, 0, 1) * 100).astype(np.uint8)
    mask = np.isin(cover, [enc.COVER_WATER, enc.COVER_OTHER, enc.NODATA])
    idx[mask] = enc.NODATA
    return idx


def peak_depth_mm(decoded_frames_mm: np.ndarray) -> np.ndarray:
    return decoded_frames_mm.max(axis=0)


def encode_diff(diff_mm: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, float]:
    """byte = 128 + diff/max_abs*127; 128 = no change or masked."""
    max_abs = float(np.float32(np.abs(np.where(mask, 0, diff_mm)).max()))
    if max_abs == 0:
        return np.full(diff_mm.shape, 128, dtype=np.uint8), 0.0
    b = np.rint(128 + np.clip(diff_mm / max_abs, -1, 1) * 127).astype(np.uint8)
    b[mask] = 128
    return b, max_abs


def decode_diff(b: np.ndarray, max_abs_mm: float) -> np.ndarray:
    return (np.maximum(b.astype(np.float64), 1) - 128) / 127.0 * max_abs_mm
