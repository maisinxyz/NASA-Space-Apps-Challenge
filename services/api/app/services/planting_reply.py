"""Resolve crop comparisons and short follow-ups against the forecast engine."""

import re

from app.core.errors import ApiError
from app.services.forecast import forecast, prepare
from app.twin.catalog import load_catalog

CROP_QUESTION = re.compile(r"\b(?:plant(?:ed|ing)?|grow(?:ing)?|grew|sow(?:ed|ing)?|swap|replace)\b", re.I)
_FOLLOW_UP = re.compile(r"\b(?:instead|next year|drier|wetter|how much (?:water|irrigation)|what happens to (?:soil|it)|and if)\b", re.I)
_METRICS = ["irrigation_need_mm", "soil_organic_index"]
_WATER_GOAL = re.compile(r"\b(?:less water|water less|save water|drought|lower irrigation|least water|water.shortage)\b", re.I)
_SOIL_GOAL = re.compile(r"\b(?:healthier soil|improve (?:the )?soil|better soil|soil health|organic matter)\b", re.I)


def _mentions(text: str, crops: dict) -> list[dict]:
    matches = []
    for crop in sorted(crops.values(), key=lambda row: len(row["name"]), reverse=True):
        name = re.escape(crop["name"])
        pattern = rf"(?<!\w){name}(?:s|es)?(?!\w)"
        if re.search(pattern, text, re.I):
            matches.append(crop)
            text = re.sub(pattern, " ", text, flags=re.I)
    return matches


def reply_for_planting(site: str, body: dict, message: str, snapshot: dict, history: list[dict]) -> dict | None:
    crops = {entry["id"]: entry for entry in load_catalog()["crops"]}
    # With "replace X with Y", only Y is the proposed planting.
    target = re.split(r"\b(?:replace|swap)\b.+?\b(?:with|for)\b", message, maxsplit=1, flags=re.I)[-1]
    choices = _mentions(target, crops)
    season_text = message
    if not choices and _FOLLOW_UP.search(message):
        previous = next((item["content"] for item in reversed(history) if item["role"] == "user" and _mentions(item["content"], crops)), "")
        if previous:
            previous_target = re.split(r"\b(?:replace|swap)\b.+?\b(?:with|for)\b", previous, maxsplit=1, flags=re.I)[-1]
            choices = _mentions(previous_target, crops)
            if not re.search(r"\b(?:spring|summer|fall|winter)\b", message, re.I):
                season_text = previous
    if len(choices) > 1:
        return _reply(f"I found {' and '.join(crop['name'] for crop in choices)}. Which one should I compare with the existing crop?", [])
    water_goal = bool(_WATER_GOAL.search(message))
    soil_goal = bool(_SOIL_GOAL.search(message))
    if not choices and not (water_goal or soil_goal):
        if CROP_QUESTION.search(message) or re.search(r"\b(?:what should i do|what is best|any advice|what should i choose)\b", message, re.I):
            return _reply("What matters most this season: needing less irrigation or building soil organic matter? If you have a crop in mind, tell me its name and I can compare it with the current plan.", [])
        return None
    selected = snapshot.get("selected") or {}
    field_id = snapshot.get("field_id") or (selected.get("id") if selected.get("kind") == "field" else None)
    field = next((field for field in body["fields"] if field_id is None or field["field_id"] == field_id), None)
    if field is None:
        return _reply("That field is unavailable in the demo forecast. Select a demo field to compare a crop.", [])
    request = {**body, "fields": [field], "scenario": "baseline", "climate_source": "cmip6_delta"}
    if not choices:
        return _reply_for_priority(site, request, message, field_id, water_goal, soil_goal)
    replacement = choices[0]
    plan = prepare(site, request).fields[0].plans[0]
    main = [
        slot for slot in plan.slots
        if slot.year_index == 1 and slot.crop_id != "fallow" and not crops.get(slot.crop_id, {}).get("cover_crop")
    ]
    # "Drier summers" and "wetter winters" describe weather, not planting slots.
    season_text = re.sub(r"\b(?:drier|wetter|warmer|cooler|hotter|colder)\s+(?:spring|summer|fall|winter)s?\b", "", season_text, flags=re.I)
    seasons = {word.lower() for word in re.findall(r"\b(?:spring|summer|fall|winter)\b", season_text, re.I)}
    candidates = [slot for slot in main if not seasons or slot.season in seasons]
    if len(candidates) != 1:
        return _reply("This field has no single matching first-year main crop. Use Compare strategies to select the exact planting slot.", [])
    slot = candidates[0]
    chosen = {**field, "first_year_planting": {"season": slot.season, "crop_id": replacement["id"]}}
    scenarios = {"baseline": "Historical weather", "drier_summers": "Drier summers"}
    if re.search(r"\b(?:wetter|more rain|wet winters?)\b", message, re.I):
        scenarios["wetter_winters"] = "Wetter winters"
    try:
        runs = [
            forecast(site, {**request, "fields": [chosen], "scenario": scenario})
            for scenario in scenarios
        ]
    except ApiError as exc:
        if exc.code != "INVALID_INPUT":
            raise
        return _reply(f"I couldn’t run that substitution. {exc.message} Use Compare strategies to select the planting slot.", [])

    old_name = crops.get(slot.crop_id, {}).get("name", slot.crop_id)
    field_note = "" if field_id else " With no field selected, I used the first demo field."
    lines = [
        f"For {field['name']}, I modeled replacing {old_name} with {replacement['name']} once in year 1 ({slot.season}). "
        f"Both options use the same demo soil, sampled weather and later plantings.{field_note}",
    ]
    for name, run in zip(scenarios.values(), runs):
        strategies = run["fields"][0]["strategies"]
        baseline = strategies[0]
        planted = next(strategy for strategy in strategies if strategy["id"] == "rot_first_year_planting")
        final_year = run["horizon_years"]
        water = _comparison(baseline, planted, "irrigation_need_mm", 1)
        soil = _comparison(baseline, planted, "soil_organic_index", final_year)
        lines.append(f"{name}: modeled year-1 irrigation need {water} mm/year; relative year-{final_year} soil organic matter {soil} index points.")
    lines.append("Each pair shows keep-plan → change-crop medians with p10–p90 ranges. The soil index starts at 100.")
    return _reply("\n\n".join(lines), _METRICS)


def _reply_for_priority(site: str, request: dict, message: str, field_id: str | None, water: bool, soil: bool) -> dict:
    dry = bool(re.search(r"\b(?:drought|drier|dry)\b", message, re.I))
    run = forecast(site, {**request, "scenario": "drier_summers" if dry else "baseline"})
    field = run["fields"][0]
    strategies = field["strategies"]
    baseline = strategies[0]
    year = run["horizon_years"]
    assumption = "" if field_id else " I used the first demo field because no field was selected."
    lines = [f"I compared the preset rotations for {field['name']} under {'drier summers' if dry else 'historical weather'}.{assumption}"]
    if water:
        best = min(strategies, key=lambda row: row["trajectories"]["irrigation_need_mm"]["points"][1]["p50"])
        values = _comparison(baseline, best, "irrigation_need_mm", 1)
        lines.append(f"Lowest modeled first-year irrigation need: {best['label']}. Existing → this plan: {values} mm/year.")
        lines.append(f"Year-{year} soil organic matter for the same choice: {_comparison(baseline, best, 'soil_organic_index', year)} index points.")
    if soil:
        best = max(strategies, key=lambda row: row["trajectories"]["soil_organic_index"]["points"][year]["p50"])
        values = _comparison(baseline, best, "soil_organic_index", year)
        lines.append(f"Highest modeled year-{year} soil organic matter: {best['label']}. Existing → this plan: {values} index points.")
    lines.append("Values are model medians with p10–p90 ranges.")
    return _reply("\n\n".join(lines), _METRICS if water else ["soil_organic_index"])


def _comparison(baseline: dict, planted: dict, metric: str, year: int) -> str:
    def point(strategy: dict) -> str:
        p = strategy["trajectories"][metric]["points"][year]
        return f"{p['p50']:.2f} ({p['p10']:.2f}–{p['p90']:.2f})"
    return f"{point(baseline)} → {point(planted)}"


def _reply(text: str, layers: list[str]) -> dict:
    return {
        "reply": text,
        "referenced_layers": layers,
        "local_validation_tips": ["Confirm your actual rotation, soil test, crop dates and water availability with a local adviser."],
    }
