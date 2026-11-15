"""Explain the repeating cycle using catalog traits and the generator's family rule."""

from app.twin import config as C
from app.twin.types import Plan

_ROLES = (
    ("n_fixing", True, "nitrogen_fixing", "Can fix nitrogen from the air through its root microbes."),
    ("cover_crop", True, "cover", "Protects the soil surface while it is growing."),
    ("root_depth_class", "deep", "deep_rooting", "Can draw water and nutrients from deeper soil."),
    ("drought_tolerance", "high", "drought_tolerant", "Can better tolerate drier periods."),
)


def _rule(rule_id: str, status: str, text: str) -> dict:
    return {"rule_id": rule_id, "status": status, "text": text}


def _presence(rule_id: str, crops: list[dict], trait: str, yes: str, no: str) -> dict:
    if any(crop.get(trait) is True for crop in crops):
        return _rule(rule_id, "met", yes)
    if not crops or any(crop.get(trait) is None for crop in crops):
        return _rule(rule_id, "unknown", "The crop catalog has incomplete information for this rule.")
    return _rule(rule_id, "broken", no)


def explain_rotation(plan: Plan, catalog, family_ok: bool | None, short_return: bool) -> tuple[dict, list[str]]:
    crops = C.index_crops(catalog)
    ids = list(dict.fromkeys(
        slot.crop_id for slot in plan.slots
        if slot.crop_id in crops and slot.year_index <= plan.cycle_years
    ))
    cycle = [crops[crop_id] for crop_id in ids]

    if family_ok is None:
        family = _rule("break_crop", "unknown", "The host-family sequence could not be evaluated for this cycle.")
    elif family_ok:
        family = _rule("break_crop", "met", "The main crops have a family break between years, allowing established perennial stands.")
    else:
        family = _rule("break_crop", "broken", "A main crop family returns in consecutive years without a family break.")

    if short_return:
        interval = _rule("return_interval", "broken", "A crop or its host family returns sooner than the interval listed in the catalog.")
    elif family_ok is None or any(crop.get("return_interval_years") is None for crop in cycle):
        interval = _rule("return_interval", "unknown", "The catalog has no confirmed return interval for at least one crop in this cycle.")
    else:
        interval = _rule("return_interval", "met", "The cycle meets the return intervals listed in the catalog.")

    rules = [
        family, interval,
        _presence("legume_in_cycle", cycle, "n_fixing", "The cycle contains a nitrogen-fixing crop.", "The cycle contains no nitrogen-fixing crop."),
        _presence("cover_in_cycle", cycle, "cover_crop", "The cycle includes a cover crop.", "The cycle contains no cover crop."),
    ]

    roles = []
    unverified = []
    for crop_id in ids:
        crop = crops[crop_id]
        chosen = [trait for trait in _ROLES if crop.get(trait[0]) == trait[1]]
        if chosen:
            for _, _, role, detail in chosen:
                roles.append({"crop_id": crop_id, "role": role, "text": detail})
        else:
            roles.append({"crop_id": crop_id, "role": "other", "text": "Part of the rotation's crop sequence."})
        checked = ("family", "return_interval_years", "n_fixing", "cover_crop", *(item[0] for item in chosen))
        sources = crop.get("trait_sources") or {}
        for trait in checked:
            source = sources.get(trait) or ""
            if crop.get(trait) is None or "https://" not in source or "TODO(verify)" in source:
                unverified.append(crop.get("name") or crop_id)
                break
    return {"rules": rules, "crop_roles": roles}, unverified


def merge_explanations(explanations: list[dict]) -> dict:
    rules = {}
    roles = {}
    for explanation in explanations:
        for rule in explanation["rules"]:
            rules.setdefault(rule["rule_id"], []).append(rule)
        for role in explanation["crop_roles"]:
            roles[(role["crop_id"], role["role"])] = role
    combined = []
    for rule_id, rows in rules.items():
        if len({row["status"] for row in rows}) == 1:
            combined.append(rows[0])
        elif any(row["status"] == "broken" for row in rows):
            combined.append(_rule(rule_id, "broken", "At least one field breaks this rule. See its field rotation for details."))
        else:
            combined.append(_rule(rule_id, "unknown", "The rule could not be confirmed for every field."))
    return {"rules": combined, "crop_roles": list(roles.values())}
