"""Resolve crop comparisons and short follow-ups against the forecast engine."""

import re

from app.core.errors import ApiError
from app.services.forecast import forecast, prepare
from app.twin.catalog import load_catalog

CROP_QUESTION = re.compile(r"\b(?:plant(?:ed|ing)?|grow(?:ing)?|grew|sow(?:ed|ing)?|swap|replace)\b", re.I)
_FOLLOW_UP = re.compile(r"\b(?:instead|next year|drier|wetter|how much (?:water|irrigation)|what happens to (?:soil|it)|what (?:does that|do you) mean|enough water|and if)\b", re.I)
_METRICS = ["irrigation_need_mm", "soil_organic_index"]
_WATER_GOAL = re.compile(r"\b(?:less water|water less|save water|drought|lower irrigation|least water|water.shortage)\b", re.I)
_SOIL_GOAL = re.compile(r"\b(?:healthier soil|improve (?:the )?soil|better soil|soil health|organic matter)\b", re.I)
_DETAILS = re.compile(r"\b(?:numbers|figures|breakdown|details|ranges?|data)\b", re.I)



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
    if not choices and (_FOLLOW_UP.search(message) or _DETAILS.search(message)):
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
    weather = {"baseline": "past weather", "drier_summers": "drier summers", "wetter_winters": "wetter winters"}
    scenario = "baseline"
    if re.search(r"\b(?:drier|dry|drought)\b", message, re.I):
        scenario = "drier_summers"
    elif re.search(r"\b(?:wetter|more rain|wet winters?)\b", message, re.I):
        scenario = "wetter_winters"
    detailed = bool(_DETAILS.search(message))
    scenarios = list(weather) if detailed else [scenario]
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
    crop_name = replacement["name"]
    field_name = field["name"] if field_id else f"the demo field {field['name']}"
    lines = []
    for scenario, run in zip(scenarios, runs):
        strategies = run["fields"][0]["strategies"]
        baseline = strategies[0]
        planted = next(strategy for strategy in strategies if strategy["id"] == "rot_first_year_planting")
        final_year = run["horizon_years"]
        water = _points(baseline, planted, "irrigation_need_mm", 1)
        soil = _points(baseline, planted, "soil_organic_index", final_year)
        if detailed:
            lines.append(
                f"With {weather[scenario]}, first-year irrigation is about {water[0]['p50']:.0f} mm for {old_name} "
                f"and {water[1]['p50']:.0f} mm for {crop_name}. "
                f"Most model runs put those needs at {_range(water[0])} and {_range(water[1])}, respectively. "
                f"By year {final_year}, the soil organic matter score is {soil[0]['p50']:.1f} with {old_name} "
                f"and {soil[1]['p50']:.1f} with {crop_name}, on a scale that starts at 100."
            )
        else:
            lines.append(
                f"On {field_name}, planting {crop_name} instead of {old_name} this {slot.season} "
                f"would likely mean {_change(water, 'irrigation')} in the first year. "
                f"Using {weather[scenario]}, the model estimates about {water[1]['p50']:.0f} mm for {crop_name} "
                f"versus {water[0]['p50']:.0f} mm for {old_name}. "
                f"Over the longer term, the model shows {_change(soil, 'soil organic matter', tolerance=0.02)}."
            )
    if detailed:
        lines.insert(0, f"Here’s what the model shows for planting {crop_name} instead of {old_name} on {field_name}.")
    elif re.search(r"\b(?:enough|afford|water supply|water available)\b", message, re.I):
        lines.append("Check that estimate against how much irrigation water you can supply.")
    return _reply("\n\n".join(lines), _METRICS)


def _reply_for_priority(site: str, request: dict, message: str, field_id: str | None, water: bool, soil: bool) -> dict:
    dry = bool(re.search(r"\b(?:drought|drier|dry)\b", message, re.I))
    run = forecast(site, {**request, "scenario": "drier_summers" if dry else "baseline"})
    field = run["fields"][0]
    strategies = field["strategies"]
    baseline = strategies[0]
    year = run["horizon_years"]
    field_name = field["name"] if field_id else f"the demo field {field['name']}"
    weather = "drier summers" if dry else "past weather"
    lines = []
    if water:
        best = min(strategies, key=lambda row: row["trajectories"]["irrigation_need_mm"]["points"][1]["p50"])
        before, after = _points(baseline, best, "irrigation_need_mm", 1)
        lines.append(
            f"On {field_name}, {best['label']} has the lowest estimated irrigation need in the first year "
            f"using {weather}. The model puts it at about {after['p50']:.0f} mm, "
            f"compared with {before['p50']:.0f} mm for the current plan."
        )
        if not soil:
            soil_points = _points(baseline, best, "soil_organic_index", year)
            lines.append(f"The model shows {_change(soil_points, 'soil organic matter', tolerance=0.02)} over the longer term.")
    if soil:
        best = max(strategies, key=lambda row: row["trajectories"]["soil_organic_index"]["points"][year]["p50"])
        soil_points = _points(baseline, best, "soil_organic_index", year)
        lines.append(
            f"On {field_name}, {best['label']} gives the highest long-term soil organic matter in the model "
            f"using {weather}. That amounts to {_change(soil_points, 'soil organic matter', tolerance=0.02)} "
            "compared with the current plan."
        )
    return _reply(" ".join(lines), _METRICS if water else ["soil_organic_index"])


def _points(baseline: dict, planted: dict, metric: str, year: int) -> tuple[dict, dict]:
    return baseline["trajectories"][metric]["points"][year], planted["trajectories"][metric]["points"][year]


def _change(points: tuple[dict, dict], subject: str, tolerance: float = 0) -> str:
    before, after = (point["p50"] for point in points)
    if abs(after - before) <= max(tolerance * abs(before), 0.5 if subject == "irrigation" else 0):
        return f"about the same amount of {subject}"
    return f"{'more' if after > before else 'less'} {subject}"


def _range(point: dict) -> str:
    return f"{point['p10']:.0f} to {point['p90']:.0f} mm"


def _reply(text: str, layers: list[str]) -> dict:
    return {
        "reply": text,
        "referenced_layers": layers,
        "local_validation_tips": ["Check how much water you can supply before changing crops."] if "irrigation_need_mm" in layers else [],
    }
