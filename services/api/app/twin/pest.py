"""Family return-interval pest pressure (PRD §5.4).

The index is 0–100 and assumed, not a measured pest count. A null
`return_interval_years` uses `PEST_RETURN_INTERVAL_YEARS` in config.
Pressure rises when a family returns before that interval and falls on a
non-host year. History is read from the plan, so the update does not need an
extra field on `State`.
"""

from __future__ import annotations

from app.twin import config as C
from app.twin.types import Plan, State


def _families(plan: Plan, year: int, crops: dict) -> set[str]:
    found: set[str] = set()
    for slot in plan.slots:
        if slot.year_index != year or slot.crop_id == "fallow":
            continue
        crop = crops.get(slot.crop_id)
        if not crop:
            continue
        family = crop.get("family")
        if family:
            found.add(str(family))
        for host in crop.get("host_families") or []:
            if host:
                found.add(str(host))
    return found


def _interval(plan: Plan, year: int, family: str, crops: dict) -> float:
    values: list[float] = []
    for slot in plan.slots:
        if slot.year_index != year:
            continue
        crop = crops.get(slot.crop_id)
        if not crop or str(crop.get("family")) != family:
            continue
        raw = crop.get("return_interval_years")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            values.append(float(raw))
    return max(values) if values else float(C.PEST_RETURN_INTERVAL_YEARS)


def _previous_year(plan: Plan, year: int, family: str, crops: dict) -> int | None:
    earlier = [y for y in range(1, year) if family in _families(plan, y, crops)]
    return earlier[-1] if earlier else None


def update_pest(state: State, plan: Plan, year: int, catalog) -> State:
    """One year. `catalog` is the seed document or an id → crop dict."""
    crops = C.index_crops(catalog)
    pest = {key: float(value) for key, value in state.pest.items()}
    this_year = _families(plan, year, crops)
    for family in sorted(this_year):
        previous = pest.get(family, 0.0)
        last = _previous_year(plan, year, family, crops)
        if last is None:
            pest[family] = min(C.PEST_INDEX_MAX, C.PEST_BASE)
            continue
        gap = year - last
        interval = _interval(plan, year, family, crops)
        if gap < interval:
            pest[family] = min(C.PEST_INDEX_MAX, previous + C.PEST_STEP * (interval - gap))
        else:
            pest[family] = max(0.0, previous - C.PEST_DECAY)
    for family in list(pest):
        if family not in this_year:
            pest[family] = max(0.0, pest[family] - C.PEST_DECAY)
    return State(state.soc_fast, state.soc_slow, state.infiltration_idx, state.n_pool, pest)


def pressure_index(state: State) -> float:
    """Highest family pressure this year. 0 when nothing has been recorded."""
    if not state.pest:
        return 0.0
    return float(max(0.0, min(C.PEST_INDEX_MAX, max(state.pest.values()))))


def unverified_interval_notes(plan: Plan, catalog) -> tuple[str, ...]:
    crops = C.index_crops(catalog)
    notes: list[str] = []
    seen: set[str] = set()
    for slot in plan.slots:
        if slot.crop_id in seen or slot.crop_id == "fallow":
            continue
        seen.add(slot.crop_id)
        crop = crops.get(slot.crop_id)
        if crop is None:
            continue
        if crop.get("return_interval_years") is None:
            notes.append(
                f"{slot.crop_id}: return_interval_years is null; used assumed "
                f"{C.PEST_RETURN_INTERVAL_YEARS:g} years"
            )
    return tuple(notes)
