"""Review flags. Each flag names the layer and the rule that fired. No invented disease."""

from __future__ import annotations

from app.features import config as C
from app.twin import config as TC
from app.twin.explain.uncertainty import gap_notes, quality_issues
from app.twin.score import review_flags, unrated_crops
from app.twin.types import Plan, ForecastRequest


def _crop_text(crop: dict) -> str:
    parts = [str(crop.get("notes") or ""), str(crop.get("name") or "")]
    hosts = crop.get("host_families") or []
    if isinstance(hosts, list):
        parts.extend(str(item) for item in hosts)
    return " ".join(parts).lower()


def clubroot_flags(strategy_id: str, plan: Plan, catalog) -> list[dict]:
    """Repeat of a family whose catalog text names clubroot.

    The seed catalog does not name clubroot, and ``host_families`` is empty.
    This rule stays quiet until a sourced trait says the family is clubroot-prone.
    """

    crops = TC.index_crops(catalog)
    by_year: dict[int, list[str]] = {}
    cycle = plan.cycle_years if plan.cycle_years >= 1 else 1
    for slot in plan.slots:
        if slot.year_index > cycle or slot.crop_id == "fallow":
            continue
        crop = crops.get(slot.crop_id) or {}
        if crop.get("cover_crop") or crop.get("category") == "cover":
            continue
        by_year.setdefault(slot.year_index, []).append(slot.crop_id)
    years = sorted(by_year)
    if len(years) < 1:
        return []
    flagged = []
    pairs = list(zip(years, years[1:] + years[:1])) if len(years) > 1 else []
    for left_year, right_year in pairs:
        for left in by_year[left_year]:
            for right in by_year[right_year]:
                left_crop = crops.get(left) or {}
                right_crop = crops.get(right) or {}
                if not left_crop or not right_crop:
                    continue
                if left_crop.get("family") != right_crop.get("family"):
                    continue
                if "clubroot" not in _crop_text(left_crop) and "clubroot" not in _crop_text(right_crop):
                    continue
                flagged.append(left_crop.get("family") or left)
    if not flagged:
        return []
    family = flagged[0]
    return [{
        "id": f"{strategy_id}_clubroot_{family}",
        "strategy_id": strategy_id,
        "severity": "caution",
        "text": f"{family} repeats in this cycle and the catalog text names clubroot. Check local clubroot history before using this plan.",
        "trigger": {"layer": "crop_catalog", "rule": "clubroot_family_repeat"},
    }]


def site_flags(strategy_id: str, site_id: str) -> list[dict]:
    flags = [{
        "id": f"{strategy_id}_power_resolution",
        "strategy_id": strategy_id,
        "severity": "caution",
        "text": (
            f"NASA POWER is a {int(C.POWER_SOURCE['resolution_m'])} m grid. "
            f"{C.POWER_RESOLUTION_NOTE}"
        ),
        "trigger": {"layer": "nasa_power", "rule": "resolution_coarser_than_field"},
    }]
    for index, note in enumerate(gap_notes(site_id)):
        flags.append({
            "id": f"{strategy_id}_gap_{index}",
            "strategy_id": strategy_id,
            "severity": "info",
            "text": note,
            "trigger": {"layer": "satellite_seed", "rule": "layer_not_retrieved"},
        })
    for index, issue in enumerate(quality_issues(site_id)):
        flags.append({
            "id": f"{strategy_id}_quality_{issue['rule']}_{index}",
            "strategy_id": strategy_id,
            "severity": "info",
            "text": issue["text"],
            "trigger": {"layer": issue["layer"], "rule": issue["rule"]},
        })
    return flags


def strategy_flags(strategy_id: str, plan: Plan, simulation, req: ForecastRequest, catalog, site_id: str) -> list[dict]:
    income_missing = req.economics is None or not (req.economics.crop_prices or {})
    flags = review_flags(
        strategy_id,
        simulation.review_notes,
        unrated=unrated_crops(plan, req),
        income_missing=income_missing,
    )
    flags.extend(clubroot_flags(strategy_id, plan, catalog))
    flags.extend(site_flags(strategy_id, site_id))
    return flags
