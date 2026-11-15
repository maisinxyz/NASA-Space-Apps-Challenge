"""Strategy search (PRD §5.5).

Alternatives are chosen with equal weights. Farmer priority weights are applied
later, in `score.py`, and do not change which plans are returned. Crops with a
null season window are left out of the search rather than given an invented date.
`weather` and `soil` are accepted so the PRD signature stays stable; this
search does not yet drop a crop for climate fit.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.rotation.config import DEFAULT_PRESET, SITE_PRESETS
from app.twin import config as C
from app.twin.run import expand_plan
from app.twin.score import farm_fit
from app.twin.types import ForecastRequest, Plan, Slot

__all__ = ["StrategySet", "build_strategies", "farm_fit", "generate_strategies"]

_DOY = np.arange(C.YEAR_DAYS)


@dataclass(frozen=True)
class StrategySet:
    plans: tuple[Plan, ...]
    roles: tuple[str, ...]
    labels: tuple[str, ...]
    warnings: tuple[dict, ...]


def generate_strategies(req: ForecastRequest, catalog, weather, soil, *, lat: float, site_id: str | None = None) -> list[Plan]:
    """Plans for one field. Index 0 is the existing rotation."""
    return list(build_strategies(req, catalog, weather, soil, lat=lat, site_id=site_id).plans)


def build_strategies(req: ForecastRequest, catalog, weather, soil, *, lat: float, site_id: str | None = None) -> StrategySet:
    _ = (weather, soil)
    crops = C.index_crops(catalog)
    warnings: list[dict] = []
    existing, existing_label = _existing(req, crops, site_id)
    horizon = req.horizon_years
    plans = [expand_plan(existing, horizon)]
    roles = ["existing"]
    labels = [existing_label]

    pool, blocked = _pool(req, crops)
    if blocked:
        warnings.append(_warning(
            "NO_FEASIBLE_ALTERNATIVES",
            "warning",
            "Some crops were left out of the search: " + "; ".join(blocked) + ".",
        ))
    pinned = tuple(crop_id for crop_id in req.selection.pinned if crop_id not in req.selection.excluded)
    missing_windows = [
        crop_id for crop_id in req.selection.crops
        if crop_id not in req.selection.excluded and crop_id in crops and not _placeable(crops[crop_id])
    ]
    if missing_windows:
        warnings.append(_warning(
            "NO_FEASIBLE_ALTERNATIVES",
            "info",
            "No season window is recorded for: " + ", ".join(missing_windows) + ". They were not given a planting date.",
        ))

    found = _search(pool, crops, pinned, req.constraints.max_cycle_years, lat)
    existing_keys = {_cycle_key(_seq_from_plan(existing, crops))}
    ranked = sorted(found, key=lambda seq: (-_equal_score(seq, crops), seq))
    alts = []
    seen = set(existing_keys)
    for seq in ranked:
        key = _cycle_key(seq)
        if key in seen:
            continue
        seen.add(key)
        alts.append(seq)
        if len(alts) >= req.strategy_count - 1:
            break
    if len(alts) < req.strategy_count - 1:
        warnings.append(_warning(
            "NO_FEASIBLE_ALTERNATIVES",
            "error",
            f"Found {len(alts)} alternative(s); {req.strategy_count - 1} were requested.",
        ))
    for index, seq in enumerate(alts, 1):
        slots = _slots_from_seq(seq, crops)
        cycle = Plan(f"rot_alt_{index}", tuple(slots), cycle_years=len(seq))
        plans.append(expand_plan(cycle, horizon))
        roles.append("alternative")
        labels.append(f"Alternative {index}")

    for index, custom in enumerate(req.custom_strategies or (), 1):
        cycle_years = max(slot.year_index for slot in custom)
        custom_plan = Plan(f"rot_custom_{index}", tuple(custom), cycle_years=cycle_years)
        plans.append(expand_plan(custom_plan, horizon))
        roles.append("custom")
        labels.append(f"Custom {index}")

    return StrategySet(tuple(plans), tuple(roles), tuple(labels), tuple(warnings))


def _warning(code: str, level: str, message: str) -> dict:
    return {"code": code, "level": level, "message": message}


def _placeable(crop: dict) -> bool:
    window = crop.get("season_window") or {}
    plant, terminate = window.get("plant_doy"), window.get("terminate_doy")
    return isinstance(plant, int) and isinstance(terminate, int) and not isinstance(plant, bool)


def _is_cover(crop: dict) -> bool:
    return bool(crop.get("cover_crop")) or crop.get("category") == "cover"


def _season(crop: dict | None, fallback: str) -> str:
    if crop is None or not _placeable(crop):
        return fallback
    doy = int(crop["season_window"]["plant_doy"])
    month = min(12, (doy - 1) * 12 // 365 + 1)
    return {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
            6: "summer", 7: "summer", 8: "summer"}.get(month, "fall")


def _existing(req: ForecastRequest, crops: dict, site_id: str | None) -> tuple[Plan, str]:
    field = req.fields[0] if req.fields else None
    if field is not None and isinstance(field.existing_rotation, tuple) and field.existing_rotation:
        cycle = max(slot.year_index for slot in field.existing_rotation)
        return Plan("rot_existing", field.existing_rotation, cycle_years=cycle), "Existing rotation"
    preset = SITE_PRESETS.get(site_id or "", DEFAULT_PRESET)
    slots: list[Slot] = []
    for year, main, off in preset["slots"]:
        main_crop = None if main == "fallow" else crops.get(main)
        off_crop = None if off == "fallow" else crops.get(off)
        slots.append(Slot(year, _season(main_crop, "spring"), main))
        slots.append(Slot(year, _season(off_crop, "winter"), off))
    cycle = max(slot.year_index for slot in slots)
    return Plan("rot_existing", tuple(slots), cycle_years=cycle), preset["name"]


def _pool(req: ForecastRequest, crops: dict) -> tuple[list[str], list[str]]:
    """Crop ids that can be searched, and human-readable reasons for the ones that cannot."""
    blocked: list[str] = []
    kept: list[str] = []
    cap = C.LABOUR_PEAK_WEEK_CAP[req.constraints.labour_level]
    have = set(req.constraints.equipment)
    for crop_id in req.selection.crops:
        if crop_id in req.selection.excluded:
            continue
        crop = crops.get(crop_id)
        if crop is None:
            blocked.append(f"{crop_id} is not in the catalog")
            continue
        if not _placeable(crop):
            continue
        needs = set(crop.get("needs_equipment") or [])
        if needs - have:
            blocked.append(f"{crop_id} needs equipment that was not listed")
            continue
        if crop.get("needs_specialty_equipment") and not have:
            blocked.append(f"{crop_id} is marked as needing specialty equipment and none was listed")
            continue
        peaks = crop.get("labour_peak_weeks") or []
        if len(peaks) > cap:
            blocked.append(f"{crop_id} has more peak-labour weeks than the {req.constraints.labour_level} cap")
            continue
        kept.append(crop_id)
    return sorted(kept), blocked


def _mask(crop: dict, lat: float) -> np.ndarray:
    plant = (int(crop["season_window"]["plant_doy"]) - 1) % C.YEAR_DAYS
    term = (int(crop["season_window"]["terminate_doy"]) - 1) % C.YEAR_DAYS
    if lat < 0:
        plant = (plant + C.SOUTH_SHIFT_DAYS) % C.YEAR_DAYS
        term = (term + C.SOUTH_SHIFT_DAYS) % C.YEAR_DAYS
    if term >= plant:
        return (_DOY >= plant) & (_DOY < term)
    return (_DOY >= plant) | (_DOY < term)


def _overlap(main: dict, off: dict | None, lat: float) -> int:
    if off is None:
        return 0
    return int(np.count_nonzero(_mask(main, lat) & _mask(off, lat)))


def _family_ok(mains: list[str], crops: dict) -> bool:
    if len(mains) <= 1:
        # A one-year non-perennial cycle repeats the same family next year.
        if len(mains) == 1 and not crops[mains[0]].get("perennial"):
            return False
        return True
    n = len(mains)
    for index in range(n):
        left, right = mains[index], mains[(index + 1) % n]
        if crops[left]["family"] != crops[right]["family"]:
            continue
        if not (left == right and crops[left].get("perennial")):
            return False
    for crop_id in set(mains):
        if not crops[crop_id].get("perennial"):
            continue
        run = best = 0
        for item in mains + mains:
            run = run + 1 if item == crop_id else 0
            best = max(best, run)
        if min(best, n) > C.MAX_PERENNIAL_YEARS:
            return False
    return True


def _next_ok(previous: str, main: str, seq: tuple, crops: dict) -> bool:
    if crops[previous]["family"] != crops[main]["family"]:
        return True
    if previous == main and crops[main].get("perennial"):
        run = 1
        for earlier, _off in reversed(seq):
            if earlier != main:
                break
            run += 1
        return run <= C.MAX_PERENNIAL_YEARS
    return False


def _search(pool: list[str], crops: dict, pinned: tuple[str, ...], max_years: int, lat: float) -> list[tuple]:
    mains = [crop_id for crop_id in pool if not _is_cover(crops[crop_id])]
    covers = [crop_id for crop_id in pool if _is_cover(crops[crop_id])]
    if not mains:
        return []
    offs = ["fallow", *covers]
    pinned_set = set(pinned)
    found: list[tuple] = []
    nodes = 0

    def dfs(seq: tuple, years: int) -> None:
        nonlocal nodes
        nodes += 1
        if nodes > C.SEARCH_NODE_CAP or len(found) >= C.CANDIDATE_CAP:
            return
        if len(seq) == years:
            crop_ids = [main for main, _off in seq] + [off for _main, off in seq if off != "fallow"]
            if pinned_set and not pinned_set <= set(crop_ids):
                return
            if not _family_ok([main for main, _off in seq], crops):
                return
            if seq != min(seq[k:] + seq[:k] for k in range(len(seq))):
                return
            found.append(seq)
            return
        for main in mains:
            if seq and not _next_ok(seq[-1][0], main, seq, crops):
                continue
            for off in offs:
                if off != "fallow" and _overlap(crops[main], crops[off], lat) > C.SEASON_SLACK_DAYS:
                    continue
                dfs(seq + ((main, off),), years)
                if nodes > C.SEARCH_NODE_CAP or len(found) >= C.CANDIDATE_CAP:
                    return

    for years in range(1, max_years + 1):
        dfs((), years)
        if len(found) >= C.CANDIDATE_CAP or nodes > C.SEARCH_NODE_CAP:
            break
    return found


def _equal_score(seq: tuple, crops: dict) -> float:
    """Higher is better. Every term has weight 1. Farmer priorities are not used."""
    ids = [main for main, _off in seq] + [off for _main, off in seq if off != "fallow"]
    if not ids:
        return 0.0
    families = len({crops[crop_id]["family"] for crop_id in ids}) / len(seq)
    legumes = sum(1 for crop_id in ids if crops[crop_id].get("n_fixing")) / len(ids)
    cover = sum(1 for _main, off in seq if off != "fallow") / len(seq)
    water_rank = {"low": 0.0, "medium": 0.5, "high": 1.0}
    water = sum(water_rank.get(crops[crop_id].get("water_need_class") or "", 0.5) for crop_id in ids) / len(ids)
    return families + legumes + cover + (1.0 - water)


def _slots_from_seq(seq: tuple, crops: dict) -> list[Slot]:
    slots = []
    for year, (main, off) in enumerate(seq, 1):
        slots.append(Slot(year, _season(crops[main], "spring"), main))
        off_crop = None if off == "fallow" else crops[off]
        slots.append(Slot(year, _season(off_crop, "winter"), off))
    return slots


def _seq_from_plan(plan: Plan, crops: dict) -> tuple:
    grouped: dict[int, list[str]] = {}
    for slot in plan.slots:
        grouped.setdefault(slot.year_index, []).append(slot.crop_id)
    seq = []
    for year in range(1, (plan.cycle_years or max(grouped)) + 1):
        ids = grouped.get(year, ["fallow"])
        mains = [crop_id for crop_id in ids if crop_id != "fallow" and not _is_cover(crops.get(crop_id, {}))]
        offs = [crop_id for crop_id in ids if crop_id != "fallow" and _is_cover(crops.get(crop_id, {}))]
        seq.append((mains[0] if mains else "fallow", offs[0] if offs else "fallow"))
    return tuple(seq)


def _cycle_key(seq: tuple) -> tuple:
    if not seq:
        return ()
    return min(seq[k:] + seq[:k] for k in range(len(seq)))
