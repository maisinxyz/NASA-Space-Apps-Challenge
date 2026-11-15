"""Crop catalog v2 (forecast PRD W5). Seed file, no network, no defaults for nulls."""

from __future__ import annotations

import json
import re

from app.core.errors import ApiError
from app.features.seeds import SEED_DIR

CATALOG_PATH = SEED_DIR / "crops" / "catalog_v2.json"
CATEGORIES = ("vegetable", "grain", "forage", "cover", "fruit_perennial")
SITE_ID = re.compile(r"^site_[A-Za-z0-9_-]+$")
SELECTION_MIN = 2
SELECTION_MAX = 30
# Keys that are not traits. Every other key on a crop must have trait_sources.
NOT_TRAITS = frozenset({"id", "name", "notes", "source", "trait_sources"})

# No curated site has a verified climate-class id yet, so a site_id filter
# keeps crops with an empty region_fit and drops nothing else. UBC Farm's
# "oceanic" label is named in the contract description and is not stored here.
SITE_CLIMATE_CLASS: dict[str, str] = {}


def load_catalog() -> dict:
    """The seed catalog. Null numbers stay null."""
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def catalog_problems(doc: dict | None = None) -> list[str]:
    """Empty when the catalog meets the W5 checks this module can do."""
    doc = load_catalog() if doc is None else doc
    problems: list[str] = []
    crops = doc.get("crops") or []
    if len(crops) < 40:
        problems.append(f"need at least 40 crops, found {len(crops)}")
    ids = [crop.get("id") for crop in crops]
    if len(ids) != len(set(ids)):
        problems.append("duplicate crop id")
    equipment = {item.get("id") for item in doc.get("equipment") or []}
    for crop in crops:
        cid = crop.get("id", "?")
        if crop.get("category") not in CATEGORIES:
            problems.append(f"{cid}: bad category")
        sources = crop.get("trait_sources") or {}
        for key in crop:
            if key in NOT_TRAITS:
                continue
            if not str(sources.get(key) or "").strip():
                problems.append(f"{cid}: trait_sources missing {key}")
        unknown = set(crop.get("needs_equipment") or []) - equipment
        if unknown:
            problems.append(f"{cid}: needs_equipment not in catalog.equipment {sorted(unknown)}")
    return problems


def list_catalog(category: str | None = None, site_id: str | None = None) -> dict:
    """GET /crop-catalog. Empty region_fit is kept when a site is named."""
    if category is not None and category not in CATEGORIES:
        raise ApiError("INVALID_INPUT", f"Unknown category '{category}'.", hint="Use vegetable, grain, forage, cover, or fruit_perennial.")
    if site_id is not None and not SITE_ID.match(site_id):
        raise ApiError("INVALID_INPUT", f"site_id '{site_id}' is not a site id.")
    doc = load_catalog()
    climate = SITE_CLIMATE_CLASS.get(site_id or "")
    crops = []
    for crop in doc["crops"]:
        if category is not None and crop["category"] != category:
            continue
        if site_id is not None:
            fit = crop.get("region_fit") or []
            if fit and climate not in fit:
                continue
        crops.append(crop)
    return {"data_mode": doc.get("data_mode", "seed"), "crops": crops, "equipment": doc.get("equipment") or []}


def validate_selection(crop_ids: list[str]) -> None:
    """Forecast selection: 2 to 30 catalog ids. Raises ApiError."""
    if not isinstance(crop_ids, list):
        raise ApiError("INVALID_INPUT", "Selection crops must be a list.")
    known = {crop["id"] for crop in load_catalog()["crops"]}
    unknown = [cid for cid in crop_ids if cid not in known]
    if unknown:
        raise ApiError("UNKNOWN_CROP", "Unknown crop in the selection.", hint=", ".join(unknown))
    if len(crop_ids) < SELECTION_MIN:
        raise ApiError(
            "SELECTION_TOO_SMALL",
            f"Select at least {SELECTION_MIN} crops.",
            hint=f"Got {len(crop_ids)}.",
        )
    if len(crop_ids) > SELECTION_MAX:
        raise ApiError("INVALID_INPUT", f"Select at most {SELECTION_MAX} crops.", hint=f"Got {len(crop_ids)}.")
    if len(crop_ids) != len(set(crop_ids)):
        raise ApiError("INVALID_INPUT", "Selection crops must be unique.")
