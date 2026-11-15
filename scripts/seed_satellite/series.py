"""Write weekly seed series, sidecars, and gap records.

A gap record is not a measurement. A series file is gzip JSON with a stable
mtime so the same document is the same bytes. The Earthdata token is removed
if it ever appears in a reason string. Nothing here calls the network.
"""

from __future__ import annotations

import gzip
import json
from datetime import date
from pathlib import Path

from edl import WEEKS, week_of

SEED = Path(__file__).resolve().parents[2] / "data" / "seed"
RETRIEVED_ON = "2026-11-15"
# Shared bound for pulls that read one file per scene or per day.
# A 2016-2025 pull did not fit the two-connection cap. Earlier years are not filled.
SERIES_YEAR_START = 2023
SERIES_YEAR_END = 2025


def scrub(text: str, secret: str | None) -> str:
    """Remove a secret from text that might be written to disk."""
    if secret and text:
        return text.replace(secret, "[redacted]")
    return text


def weekly_from_observations(
    observations: list[tuple[date, float]],
    years: list[int],
    *,
    ndigits: int,
    how: str = "mean",
) -> list[dict]:
    """Aggregate scene or day values in each week. An empty week is null with n_obs 0.

    ``how="mean"`` is the unweighted mean. ``how="sum"`` adds the days and does
    not scale a partial week up to seven days. ``n_obs`` counts scenes or days,
    not pixels. Days 358-366 share week 51 via ``edl.week_of``. Years are the
    years that were searched, including a year whose every week is null.
    Nothing is interpolated.
    """
    if how not in {"mean", "sum"}:
        raise ValueError("how must be mean or sum")
    buckets: dict[tuple[int, int], list[float]] = {}
    allowed = set(years)
    for when, value in observations:
        if when.year not in allowed:
            continue
        buckets.setdefault((when.year, week_of(when)), []).append(float(value))
    rows = []
    for year in years:
        values: list[float | None] = []
        n_obs: list[int] = []
        for week in range(WEEKS):
            found = buckets.get((year, week))
            if not found:
                values.append(None)
                n_obs.append(0)
                continue
            total = sum(found)
            values.append(round(total if how == "sum" else total / len(found), ndigits) + 0.0)
            n_obs.append(len(found))
        rows.append({"year": int(year), "values": values, "n_obs": n_obs})
    return rows


def weeks_with_data(weekly: list[dict]) -> int:
    total = 0
    for row in weekly:
        total += sum(1 for value, count in zip(row["values"], row["n_obs"]) if value is not None and count > 0)
    return total


def _gzip_json(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(doc, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    with gzip.GzipFile(filename="", mode="wb", fileobj=path.open("wb"), mtime=0) as handle:
        handle.write(payload)


def write_series(site_id: str, layer: str, doc: dict, meta: dict, root: Path = SEED) -> Path:
    """Write ``<layer>.json.gz`` and its sidecar, and delete ``<layer>.gap.json``."""
    out = root / site_id
    path = out / f"{layer}.json.gz"
    _gzip_json(path, doc)
    (out / f"{layer}.meta.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    gap = out / f"{layer}.gap.json"
    if gap.is_file():
        gap.unlink()
    return path


def write_gap(
    site_id: str,
    layer: str,
    *,
    reason: str,
    candidates: list[dict],
    meta: dict,
    root: Path = SEED,
    secret: str | None = None,
) -> Path:
    """Write a gap record. An existing series file is left in place."""
    reason = scrub(reason, secret)
    meta = {key: scrub(str(value), secret) if isinstance(value, str) else value for key, value in meta.items()}
    out = root / site_id
    series = out / f"{layer}.json.gz"
    if series.is_file():
        return series
    out.mkdir(parents=True, exist_ok=True)
    doc = {
        "data_mode": "limited_data",
        "available": False,
        "site_id": site_id,
        "product": layer,
        "weekly": None,
        "scene_count": None,
        "candidates": candidates,
        "reason": reason,
    }
    path = out / f"{layer}.gap.json"
    path.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    (out / f"{layer}.meta.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    return path
