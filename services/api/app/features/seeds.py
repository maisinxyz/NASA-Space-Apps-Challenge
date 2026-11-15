"""Seed files for curated sites (PRD §6 sidecar rule): data/seed/<site_id>/X.* has data/seed/<site_id>/X.meta.json.

Seeds hold license-safe copies so curated sites run with OFFLINE=1 and no cache.
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

from app.core.config import REPO_ROOT

SEED_DIR = REPO_ROOT / "data" / "seed"
SIDECAR_FIELDS = (
    "source_name", "source_url", "product_version", "retrieved_on", "license",
    "attribution", "resolution_spatial", "resolution_temporal", "processing_notes",
)
POWER_FILE = "power_daily.json.gz"
SOIL_FILE = "soil.json"


def sidecar_path(p: Path) -> Path:
    return p.with_name(p.name.split(".")[0] + ".meta.json")


def seed_files(root: Path = SEED_DIR) -> list[Path]:
    return sorted(p for p in root.rglob("*") if p.is_file() and not p.name.endswith(".meta.json") and p.name != ".gitkeep")


def sidecar_problems(root: Path = SEED_DIR) -> list[str]:
    """Empty list when every seed file has a complete sidecar."""
    problems = []
    for p in seed_files(root):
        meta = sidecar_path(p)
        if not meta.is_file():
            problems.append(f"{p.relative_to(root)}: missing {meta.name}")
            continue
        data = json.loads(meta.read_text(encoding="utf-8"))
        problems += [f"{meta.relative_to(root)}: empty {k}" for k in SIDECAR_FIELDS if not str(data.get(k) or "").strip()]
    return problems


def load_power(site_id: str, root: Path = SEED_DIR) -> dict | None:
    """Raw POWER API payload (same shape the live client caches), or None."""
    p = root / site_id / POWER_FILE
    if not p.is_file():
        return None
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


def _load_weekly(site_id: str, name: str, root: Path) -> dict | None:
    """A retrieved weekly series, or None.

    Gap records (`<name>.gap.json`) are not series. None means the layer was
    not retrieved (`data_mode: limited_data`). Nothing is synthesized.
    """
    path = root / site_id / f"{name}.json.gz"
    if not path.is_file():
        return None
    with gzip.open(path, "rt", encoding="utf-8") as f:
        doc = json.load(f)
    if not isinstance(doc, dict) or not isinstance(doc.get("weekly"), list):
        return None
    return doc


def load_ndvi(site_id: str, root: Path = SEED_DIR) -> dict | None:
    """Weekly NDVI, or None. See `ndvi.gap.json` for why it is missing."""
    return _load_weekly(site_id, "ndvi", root)


def load_smap(site_id: str, root: Path = SEED_DIR) -> dict | None:
    """Weekly SMAP moisture, or None. See `smap.gap.json`."""
    return _load_weekly(site_id, "smap", root)


def load_ecostress(site_id: str, root: Path = SEED_DIR) -> dict | None:
    """Weekly ECOSTRESS ET, or None. See `ecostress.gap.json`."""
    return _load_weekly(site_id, "ecostress", root)


def load_grace(site_id: str, root: Path = SEED_DIR) -> dict | None:
    """GRACE-FO series, or None. See `grace.gap.json`."""
    return _load_weekly(site_id, "grace", root)


def load_dem(site_id: str, root: Path = SEED_DIR) -> dict | None:
    """DEM summary, or None. See `dem.gap.json`. A missing DEM is not a flat field."""
    path = root / site_id / "dem.json.gz"
    if not path.is_file():
        return None
    with gzip.open(path, "rt", encoding="utf-8") as f:
        doc = json.load(f)
    if not isinstance(doc, dict) or doc.get("elevation") is None:
        return None
    return doc


def load_soil(site_id: str, root: Path = SEED_DIR) -> dict | None:
    p = root / site_id / SOIL_FILE
    return json.loads(p.read_text(encoding="utf-8"))["summary"] if p.is_file() else None


# ---------------------------------------------------------------- soil
def usda_texture(sand: float, silt: float, clay: float) -> str:
    """USDA texture triangle class (NRCS rules; https://www.nrcs.usda.gov/resources/education-and-teaching-materials/soil-texture-calculator)."""
    total = sand + silt + clay
    sand, silt, clay = (100 * x / total for x in (sand, silt, clay))
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 2 * clay < 30:
        return "loamy sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if silt >= 50 and clay < 27:
        return "silt loam"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "sandy clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "silty clay loam"
    if 27 <= clay < 40 and sand <= 45:
        return "clay loam"
    if clay >= 35 and sand > 45:
        return "sandy clay"
    if clay >= 40 and silt >= 40:
        return "silty clay"
    return "clay"


# TODO(verify): texture -> infiltration class mapping is our assumption (coarser = faster infiltration).
INFILTRATION = {
    "sand": "high", "loamy sand": "high", "sandy loam": "high",
    "loam": "medium", "silt loam": "medium", "silt": "medium", "sandy clay loam": "medium",
    "clay loam": "low", "silty clay loam": "low", "sandy clay": "low", "silty clay": "low", "clay": "low",
}
SOIL_DEPTHS = ("0-5cm", "5-15cm", "15-30cm")
_WIDTHS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}


def soil_summary(soilgrids: dict) -> dict:
    """SoilGrids v2.0 point query -> 0-30 cm depth-weighted summary. Unit conversion uses the response's own d_factor."""
    vals = {}
    for layer in soilgrids["properties"]["layers"]:
        d = layer["unit_measure"]["d_factor"]
        rows = [(_WIDTHS[x["label"]], x["values"]["mean"]) for x in layer["depths"] if x["label"] in _WIDTHS]
        if rows and all(v is not None for _, v in rows):
            vals[layer["name"]] = sum(w * v for w, v in rows) / sum(w for w, _ in rows) / d
    texture = usda_texture(vals["sand"], vals["silt"], vals["clay"])
    return {
        "clay_pct": round(vals["clay"], 1),
        "sand_pct": round(vals["sand"], 1),
        "silt_pct": round(vals["silt"], 1),
        "soc_g_per_kg": round(vals["soc"], 1),
        "ph": round(vals["phh2o"], 1),
        "depth": "0-30cm",
        "texture_class": texture,
        "infiltration_class": INFILTRATION[texture],
        "basis": "modeled",
        "source": "SoilGrids 2.0 (ISRIC), CC BY 4.0",
    }
