"""Uncertainty table from seed sidecars. A missing resolution is omitted, not invented."""

from __future__ import annotations

import json

from app.core.config import REPO_ROOT
from app.features import config as C
from app.features import seeds

SEED = REPO_ROOT / "data" / "seed"

# Candidate products named in the gap files. Their titles are not a retrieved resolution.
# native_resolution_m stays off the row until a sidecar stores a number.


def _meta(site_id: str, stem: str) -> dict | None:
    path = SEED / site_id / f"{stem}.meta.json"
    if not path.is_file():
        return None
    doc = json.loads(path.read_text(encoding="utf-8"))
    return doc if isinstance(doc, dict) else None


def _record_years(meta: dict | None) -> str:
    if not meta:
        return "none"
    notes = str(meta.get("processing_notes") or "")
    if "1991-01-01" in notes and "2024-12-31" in notes:
        return "1991-2024"
    retrieved = meta.get("retrieved_on")
    if isinstance(retrieved, str) and retrieved.strip():
        return retrieved.strip()
    return "none"


def uncertainty_layers(site_id: str) -> list[dict]:
    """Layers that already have a sourced resolution in metres.

    POWER uses the 55 km figure published on ``POWER_SOURCE``. SoilGrids uses 250 m
    when ``soil.json`` is present. Satellite gap files say the resolution was not
    retrieved, so those products are not given a made-up metre value.
    """

    layers = []
    power_meta = _meta(site_id, "power_daily")
    layers.append({
        "layer": "nasa_power",
        "native_resolution_m": float(C.POWER_SOURCE["resolution_m"]),
        "record_years": _record_years(power_meta) if power_meta else "1991-2024",
        "confidence": "medium",
        "resolution_note": C.POWER_RESOLUTION_NOTE,
        "needs_local_validation": True,
    })
    if seeds.load_soil(site_id) is not None:
        layers.append({
            "layer": "soilgrids",
            "native_resolution_m": float(C.SOILGRIDS_SOURCE["resolution_m"]),
            "record_years": _record_years(_meta(site_id, "soil")),
            "confidence": "low",
            "resolution_note": C.SOILGRIDS_RESOLUTION_NOTE,
            "needs_local_validation": True,
        })
    return layers


def station_bias(site_id: str) -> dict | None:
    """POWER minus a daily station series. None when the station file was not stored.

    UBC Farm's ``station_gap.json`` says the ECCC product was not copied into the
    repo. This function does not fill a bias from the climate normals page.
    """

    gap = SEED / site_id / "station_gap.json"
    if gap.is_file():
        doc = json.loads(gap.read_text(encoding="utf-8"))
        if isinstance(doc, dict) and doc.get("status") == "not_included":
            return None
    daily = None
    for name in ("station_daily.json", "station_daily.json.gz"):
        path = SEED / site_id / name
        if path.is_file():
            daily = path
            break
    if daily is None:
        return None
    # A stored daily file would be differenced here. No curated site has one yet,
    # and this branch does not invent the column layout.
    _ = daily
    return None


def gap_notes(site_id: str) -> list[str]:
    """One sentence per satellite product whose loader returns None."""

    named = (
        ("ndvi", seeds.load_ndvi, "No NDVI seed is stored."),
        ("smap", seeds.load_smap, "No SMAP seed is stored. A field moisture map was not produced."),
        ("ecostress", seeds.load_ecostress, "No ECOSTRESS seed is stored."),
        ("grace", seeds.load_grace, "No GRACE-FO seed is stored."),
        ("dem", seeds.load_dem, "No DEM seed is stored. Zones are not drawn from an elevation grid."),
    )
    notes = []
    for _name, loader, sentence in named:
        if loader(site_id) is None:
            notes.append(sentence)
    return notes
