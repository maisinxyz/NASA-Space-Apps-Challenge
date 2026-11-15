"""Crop-trait library (backend rotation PRD §8.1): data/seed/crops/traits.json, hand-curated, every value TODO(verify)."""

from __future__ import annotations

import json
from functools import lru_cache

from app.features.seeds import SEED_DIR

TRAITS_PATH = SEED_DIR / "crops" / "traits.json"
GLOSSARY_PATH = SEED_DIR / "glossary.json"
TRAIT_FIELDS = (
    "family", "n_fixing", "season_window", "cover_curve", "water_need_class", "kc_stages", "root_depth_class", "cover_crop",
    "perennial", "drought_tolerance", "frost_tolerance_c", "heat_limit_c", "residue_class", "forage_suitable",
    "market_rating", "market_dependent", "needs_specialty_equipment",
)


@lru_cache(maxsize=1)
def library() -> dict[str, dict]:
    return {c["id"]: c for c in json.loads(TRAITS_PATH.read_text(encoding="utf-8"))}


@lru_cache(maxsize=1)
def glossary() -> list[dict]:
    return json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))


def problems() -> list[str]:
    """Empty when every row has every field, a source per trait, a family and valid day-of-year windows."""
    out = []
    for cid, c in library().items():
        out += [f"{cid}: missing {f}" for f in TRAIT_FIELDS if f not in c]
        out += [f"{cid}: no source for {f}" for f in TRAIT_FIELDS if not c.get("trait_sources", {}).get(f)]
        if not c.get("family"):
            out.append(f"{cid}: empty family")
        w = c.get("season_window", {})
        if not all(1 <= w.get(k, 0) <= 366 for k in ("plant_doy", "terminate_doy")):
            out.append(f"{cid}: bad season window")
    return out


def season_length(c: dict) -> int:
    w = c["season_window"]
    return (w["terminate_doy"] - w["plant_doy"]) % 365 or 365


def plant_season(doy: int) -> str:
    """Meteorological season of a day of year (northern hemisphere calendar)."""
    month = min(12, (doy - 1) * 12 // 365 + 1)
    return {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
            6: "summer", 7: "summer", 8: "summer"}.get(month, "fall")
