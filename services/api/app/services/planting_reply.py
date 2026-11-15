"""Answer explicit crop substitutions using the forecast engine."""

import re

from app.core.errors import ApiError
from app.services.forecast import forecast, prepare
from app.twin.catalog import load_catalog

CROP_QUESTION = re.compile(r"\b(?:plant(?:ing)?|grow(?:ing)?|sow(?:ing)?|replace\b.+?\bwith)\s+(?:some\s+)?(.+)", re.I)
_METRICS = ["irrigation_need_mm", "soil_organic_index"]


def reply_for_planting(site: str, body: dict, message: str, snapshot: dict) -> dict | None:
    match = CROP_QUESTION.search(message)
    if not match:
        return None
    crops = {entry["id"]: entry for entry in load_catalog()["crops"]}
    candidates = sorted(crops.values(), key=lambda crop: len(crop["name"]), reverse=True)
    replacement = next(
        (crop for crop in candidates if re.match(re.escape(crop["name"]) + r"\b", match[1], re.I)),
        None,
    )
    if replacement is None:
        return None
    selected = snapshot.get("selected") or {}
    field_id = snapshot.get("field_id") or (selected.get("id") if selected.get("kind") == "field" else None)
    field = next((field for field in body["fields"] if field_id is None or field["field_id"] == field_id), None)
    if field is None:
        return _reply("That field is unavailable in the demo forecast. Select a demo field to compare a crop.", [])
    request = {**body, "fields": [field], "scenario": "baseline", "climate_source": "cmip6_delta"}
    plan = prepare(site, request).fields[0].plans[0]
    main = [
        slot for slot in plan.slots
        if slot.year_index == 1 and slot.crop_id != "fallow" and not crops.get(slot.crop_id, {}).get("cover_crop")
    ]
    seasons = {word.lower() for word in re.findall(r"\b(?:spring|summer|fall|winter)\b", message, re.I)}
    candidates = [slot for slot in main if not seasons or slot.season in seasons]
    if len(candidates) != 1:
        return _reply("This field has no single matching first-year main crop. Use Compare strategies to select the exact planting slot.", [])
    slot = candidates[0]
    chosen = {**field, "first_year_planting": {"season": slot.season, "crop_id": replacement["id"]}}
    try:
        runs = [
            forecast(site, {**request, "fields": [chosen], "scenario": scenario})
            for scenario in ("baseline", "drier_summers")
        ]
    except ApiError as exc:
        if exc.code != "INVALID_INPUT":
            raise
        return _reply(f"I couldn’t run that substitution. {exc.message} Use Compare strategies to select the planting slot.", [])

    old_name = crops.get(slot.crop_id, {}).get("name", slot.crop_id)
    lines = [
        f"For {field['name']}, I modeled replacing {old_name} with {replacement['name']} once in year 1 ({slot.season}). "
        "Both options use the same demo soil, sampled weather and later plantings.",
    ]
    for name, run in zip(("Historical weather", "Drier summers"), runs):
        strategies = run["fields"][0]["strategies"]
        baseline = strategies[0]
        planted = next(strategy for strategy in strategies if strategy["id"] == "rot_first_year_planting")
        final_year = run["horizon_years"]
        water = _comparison(baseline, planted, "irrigation_need_mm", 1)
        soil = _comparison(baseline, planted, "soil_organic_index", final_year)
        lines.append(f"{name}: modeled year-1 irrigation need {water} mm/year; relative year-{final_year} soil organic matter {soil} index points.")
    lines.append("Each pair shows keep-plan → change-crop medians with p10–p90 ranges. The soil index starts at 100.")
    return _reply("\n\n".join(lines), _METRICS)


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
