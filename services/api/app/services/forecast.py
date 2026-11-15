"""POST /forecast. Composes climate, exposure, strategies, and the ensemble.

Same request dict in, same JSON out. Curated sites read seeds only, so OFFLINE=1
does not call the network. Income stays null when no per-tonne price was entered.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, replace

import numpy as np

from app.core.config import REPO_ROOT
from app.core.errors import ApiError
from app.features import pipeline as P
from app.features import seeds
from app.rotation.config import SITE_PRESETS
from app.services.features import base, sources
from app.twin import config as TC
from app.twin.catalog import load_catalog, validate_selection
from app.twin.explain.evidence import evidence_card
from app.twin.explain.flags import strategy_flags
from app.twin.explain.rotation import explain_rotation, merge_explanations
from app.twin.explain.uncertainty import gap_notes, station_bias, station_context, station_source, uncertainty_layers
from app.twin.generate import build_strategies, cycle_conflicts
from app.twin.run import series_to_dict, simulate
from app.twin.score import (
    estimates,
    farm_fit,
    fertilizer_saved,
    income_estimate,
    rank_by_priority,
    scorecards,
)
from app.twin.types import (
    ENSEMBLE_MEMBERS,
    SUPPORT_SENTENCE,
    Constraints,
    CropPrice,
    Economics,
    FieldCfg,
    ForecastRequest,
    InputCosts,
    IrrigationCfg,
    Ramp,
    ScenarioApplied,
    Selection,
    Slot,
    SoilOverride,
    SoilProps,
    Weather,
    request_hash,
)
from app.twin.weather_ensemble import build_members

# Used only when the farmer did not send a field. Area and slope are not a measurement.
# TODO(verify): the product has no default field size. 1 ha keeps the rollup in hectares.
_DEFAULT_AREA_HA = 1.0
_DEFAULT_SLOPE = "gentle"
_CACHE_LIMIT = 32
_memory: dict[str, dict] = {}
_memory_order: list[str] = []


@dataclass
class FieldRun:
    field: FieldCfg
    soil: SoilProps
    plans: tuple
    roles: tuple[str, ...]
    labels: tuple[str, ...]
    warnings: tuple[dict, ...]


@dataclass
class Prepared:
    site_id: str
    req: ForecastRequest
    body: dict
    digest: str
    lat: float
    info: dict
    weather: Weather
    catalog: dict
    scenario: ScenarioApplied
    fields: list[FieldRun]
    power_mode: str
    soil_summary: dict | None


def forecast(site_id: str, body: dict, *, members: int = ENSEMBLE_MEMBERS) -> dict:
    """Full forecast document. ``members`` defaults to 30. Tests may pass a smaller count."""

    key = _cache_key("forecast", site_id, body, members)
    cached = _read_cache(key)
    if cached is not None:
        return cached
    prepared = prepare(site_id, body)
    doc = _assemble(prepared, members)
    _write_cache(key, doc)
    return deepcopy(doc)


def prepare(site_id: str, body: dict) -> Prepared:
    if not isinstance(body, dict):
        raise ApiError("INVALID_INPUT", "Forecast body must be a JSON object.")
    req = _request(body)
    daily, power_mode, soil_summary, info = base(site_id)
    # The KPU point is a SoilGrids no-data cell. A nearby mapped cell is an
    # explicitly identified proxy, used only when a field has no soil test.
    if soil_summary is None and site_id == "site_kpu_langley":
        proxy = seeds.SEED_DIR / site_id / "soil_nearby_proxy.json"
        if proxy.is_file():
            soil_summary = json.loads(proxy.read_text(encoding="utf-8"))["summary"]
            soil_summary = {**soil_summary, "nearby_proxy": True}
    catalog = load_catalog()
    scenario = _scenario(req)
    weather = _historical_weather(daily)
    fields = _field_runs(req, site_id, info, soil_summary, catalog)
    return Prepared(
        site_id=site_id,
        req=req,
        body=body,
        digest=request_hash(body),
        lat=float(info["lat"]),
        info=info,
        weather=weather,
        catalog=catalog,
        scenario=scenario,
        fields=fields,
        power_mode=power_mode,
        soil_summary=soil_summary,
    )


def simulate_plans(field_run: FieldRun, members: list[Weather], catalog, lat: float) -> list:
    return [
        simulate(plan, members, field_run.soil, field_run.field, catalog, lat=lat)
        for plan in field_run.plans
    ]


def _assemble(prepared: Prepared, members_n: int) -> dict:
    from app.twin.climate import build_climate_outlook
    from app.twin.exposure import exposure_report

    req = prepared.req
    member_weather = build_members(
        prepared.weather, prepared.scenario, req.horizon_years, members_n, prepared.digest,
        lat=prepared.lat, site_id=prepared.site_id, climate_source=req.climate_source,
    )
    field_docs = []
    warnings = []
    seen_warning = set()
    for field_run in prepared.fields:
        simulations = simulate_plans(field_run, member_weather, prepared.catalog, prepared.lat)
        field_docs.append(_field_doc(prepared, field_run, simulations))
        for warning in field_run.warnings:
            mark = (warning["code"], warning["level"], warning["message"])
            if mark not in seen_warning:
                seen_warning.add(mark)
                warnings.append(warning)
    rollup = _rollup(field_docs)
    ids = [item["id"] for item in rollup["strategies"]]
    ranking = _rank_from_scorecards(ids, [item["scorecard"] for item in rollup["strategies"]], req.priorities or {})
    planted = []
    for field_run in prepared.fields:
        for plan in field_run.plans:
            for slot in plan.slots:
                if slot.crop_id != "fallow" and slot.crop_id not in planted:
                    planted.append(slot.crop_id)
    outlook = build_climate_outlook(prepared.site_id, prepared.scenario.preset, req.climate_source)
    scenario = _scenario_dict(prepared.scenario)
    forecast_sources = sources(prepared.soil_summary)
    station_source_row = station_source(_site_id(prepared))
    if station_source_row:
        forecast_sources.append(station_source_row)
    if req.climate_source == "cmip6_delta" and prepared.scenario.preset != "baseline":
        scenario["note"] = outlook["scenario"]["note"]
        if len(outlook["sources"]) > 1:
            scenario["temp_offset_c"] = outlook["scenario"]["temp_offset_c"]
            scenario["rain_scale_pct"] = outlook["scenario"]["rain_scale_pct"]
            scenario["rain_scale_by_season"] = outlook["scenario"]["rain_scale_by_season"]
            forecast_sources.extend(outlook["sources"][1:])
    exposure = exposure_report(_site_id(prepared), ",".join(planted) if planted else None)
    proxy_used = bool(prepared.soil_summary and prepared.soil_summary.get("nearby_proxy")) and any(
        item.field.soil_override is None for item in prepared.fields
    )
    if proxy_used:
        # Soil-driven model outputs depend on an assumed transfer from a nearby
        # cell. Do not present those strategy numbers as local measurements.
        for field_doc, field_run in zip(field_docs, prepared.fields):
            if field_run.field.soil_override is None:
                _mark_proxy_assumptions(field_doc)
        _mark_proxy_assumptions(rollup)
    limited = proxy_used or any(fn(_site_id(prepared)) is None for fn in (
        seeds.load_ndvi, seeds.load_smap, seeds.load_ecostress, seeds.load_grace, seeds.load_dem,
    ))
    return {
        "site_id": _site_id(prepared),
        "schema_version": "1.2.0",
        "pipeline_version": TC.ENGINE_VERSION,
        "request_hash": prepared.digest,
        "horizon_years": req.horizon_years,
        "scenario": scenario,
        "data_mode": "limited_data" if limited else prepared.power_mode,
        "disclaimer": TC.DISCLAIMER,
        "support_sentence": SUPPORT_SENTENCE,
        "climate_outlook": outlook,
        "exposure": exposure,
        "fields": field_docs,
        "farm_rollup": rollup,
        "comparison": {
            "rank_by_priority": ranking,
            "rank_stability": (
                "This rank is the priority-weighted score on the requested scenario. "
                "The share of the rain and temperature grid that keeps a strategy first is on POST /forecast/sensitivity."
            ),
            "deltas_vs_existing_year10": _rollup_deltas(rollup),
        },
        "uncertainty": {"layers": uncertainty_layers(_site_id(prepared)), "station_bias": station_bias(_site_id(prepared))},
        "warnings": warnings,
        "sources": forecast_sources,
        "assumptions": _assumptions(prepared),
    }


def _site_id(prepared: Prepared) -> str:
    return prepared.site_id


def _mark_proxy_assumptions(value) -> None:
    if isinstance(value, dict):
        if value.get("basis") in ("modeled", "derived") and "unit" in value:
            value["basis"] = "assumed"
        for child in value.values():
            _mark_proxy_assumptions(child)
    elif isinstance(value, list):
        for child in value:
            _mark_proxy_assumptions(child)


def _field_doc(prepared: Prepared, field_run: FieldRun, simulations: list) -> dict:
    req = prepared.req
    fits = [farm_fit(plan, sim, _req_for_field(req, field_run.field), prepared.catalog) for plan, sim in zip(field_run.plans, simulations)]
    cards = scorecards(simulations, fits)
    ids = [plan.strategy_id for plan in field_run.plans]
    ranking = rank_by_priority(ids, cards, req.priorities or {})
    rank_of = {strategy_id: index + 1 for index, strategy_id in enumerate(ranking)}
    existing = next(sim for plan, sim in zip(field_run.plans, simulations) if plan.strategy_id == "rot_existing")
    strategies = []
    crops = TC.index_crops(prepared.catalog)
    for plan, sim, fit, card in zip(field_run.plans, simulations, fits, cards):
        saved = fertilizer_saved(sim["n_fertilizer_need_kg_ha"], existing["n_fertilizer_need_kg_ha"])
        income, income_notes = income_estimate(plan, sim, _req_for_field(req, field_run.field))
        flags = strategy_flags(
            plan.strategy_id, plan, sim, req, prepared.catalog, _site_id(prepared),
        )
        cycle = [[] for _ in range(min(plan.cycle_years, req.horizon_years))]
        for slot in plan.slots:
            if slot.year_index <= len(cycle):
                cycle[slot.year_index - 1].append(slot.crop_id)
        matches = cycle_conflicts(cycle, crops) if len(cycle) == plan.cycle_years else (None, False)
        explanation, unverified = explain_rotation(plan, crops, *matches)
        if unverified:
            flags.append({
                "id": f"{plan.strategy_id}_uncited_rotation_trait",
                "strategy_id": plan.strategy_id,
                "severity": "verify",
                "text": "Confirm crop traits or return intervals locally for: " + ", ".join(unverified) + ".",
                "trigger": {"layer": "rotation", "rule": "uncited_rotation_trait"},
            })
        if prepared.soil_summary and prepared.soil_summary.get("nearby_proxy") and field_run.field.soil_override is None:
            flags.append({
                "id": f"{plan.strategy_id}_soil_proxy",
                "strategy_id": plan.strategy_id,
                "severity": "verify",
                "text": "Soil inputs use a nearby SoilGrids cell, not a field measurement; check a local soil test.",
                "trigger": {"layer": "soil", "rule": "nearby_soil_proxy"},
            })
        if income is None and not any(flag["trigger"]["rule"] == "missing_price" for flag in flags):
            flags.append({
                "id": f"{plan.strategy_id}_income_missing",
                "strategy_id": plan.strategy_id,
                "severity": "verify",
                "text": "No usable per-tonne price was entered, so income_estimate is null.",
                "trigger": {"layer": "economics", "rule": "missing_price"},
            })
        gaps = list(sim.review_notes) + list(income_notes) + gap_notes(_site_id(prepared))
        strategies.append({
            "id": plan.strategy_id,
            "role": field_run.roles[ids.index(plan.strategy_id)],
            "label": field_run.labels[ids.index(plan.strategy_id)],
            "cycle_years": plan.cycle_years,
            "plan": [{"year_index": slot.year_index, "season": slot.season, "crop_id": slot.crop_id} for slot in plan.slots],
            "trajectories": {key: series_to_dict(sim[key]) for key in (
                "soil_organic_index", "n_balance", "n_balance_kg_ha", "n_fixed_share",
                "infiltration_index", "runoff_index", "pest_pressure_index", "bare_weeks",
                "water_demand_mm", "irrigation_need_mm",
            )},
            "farm_fit": fit,
            "scorecard": card,
            "estimates": estimates(sim, saved, income),
            "vulnerable_seasons": [],
            "evidence_card": evidence_card(
                plan.strategy_id,
                role=field_run.roles[ids.index(plan.strategy_id)],
                rank=rank_of[plan.strategy_id],
                n_strategies=len(ids),
                scorecard=card,
                gaps=gaps,
                risks=[flag["text"] for flag in flags if flag["severity"] in ("caution", "verify")],
            ),
            "review_flags": flags,
            "rotation_explanation": explanation,
        })
    _attach_exposure(strategies, prepared)
    return {
        "field_id": field_run.field.field_id,
        "name": field_run.field.name,
        "area_ha": field_run.field.area_ha,
        "strategies": strategies,
    }


def _attach_exposure(strategies: list[dict], prepared: Prepared) -> None:
    from app.twin.exposure import exposure_report

    planted = []
    for strategy in strategies:
        for slot in strategy["plan"]:
            if slot["crop_id"] != "fallow" and slot["crop_id"] not in planted:
                planted.append(slot["crop_id"])
    report = exposure_report(_site_id(prepared), ",".join(planted) if planted else None)
    by_crop: dict[str, list] = {}
    for season in report.get("vulnerable_seasons") or []:
        by_crop.setdefault(season["crop_id"], []).append(season)
    for strategy in strategies:
        crops = {slot["crop_id"] for slot in strategy["plan"]}
        seasons = []
        for crop_id in sorted(crops):
            seasons.extend(by_crop.get(crop_id, []))
        strategy["vulnerable_seasons"] = seasons


def _req_for_field(req: ForecastRequest, field: FieldCfg) -> ForecastRequest:
    return replace(req, fields=(field,))


def _rollup(field_docs: list[dict]) -> dict:
    ids = []
    for doc in field_docs:
        for strategy in doc["strategies"]:
            if strategy["id"] not in ids:
                ids.append(strategy["id"])
    strategies = []
    for strategy_id in ids:
        rows = []
        for doc in field_docs:
            match = next((item for item in doc["strategies"] if item["id"] == strategy_id), None)
            if match is not None:
                rows.append((float(doc["area_ha"]), match))
        strategies.append(_blend_strategy(strategy_id, rows))
    return {"strategies": strategies}


def _blend_strategy(strategy_id: str, rows: list[tuple[float, dict]]) -> dict:
    total = sum(area for area, _ in rows)
    first = rows[0][1]

    def blend_series(key: str) -> dict:
        template = first["trajectories"][key]
        points = []
        for index, point in enumerate(template["points"]):
            def avg(attr: str, index=index) -> float:
                return sum(area * item["trajectories"][key]["points"][index][attr] for area, item in rows) / total
            points.append({"year": point["year"], "p50": avg("p50"), "p10": avg("p10"), "p90": avg("p90")})
        return {**template, "points": points}

    def blend_estimate(key: str) -> dict:
        template = first["estimates"][key]
        points = []
        for index, point in enumerate(template["points"]):
            def avg(attr: str, index=index) -> float:
                return sum(area * item["estimates"][key]["points"][index][attr] for area, item in rows) / total
            points.append({"year": point["year"], "p50": avg("p50"), "p10": avg("p10"), "p90": avg("p90")})
        return {**template, "points": points}

    trajectories = {key: blend_series(key) for key in first["trajectories"]}
    scorecard = []
    for index, row in enumerate(first["scorecard"]):
        def avg_row(attr: str, index=index) -> float:
            return sum(area * item["scorecard"][index][attr] for area, item in rows) / total
        blended = dict(row)
        blended["score"] = avg_row("score")
        blended["year10_value"] = avg_row("year10_value")
        blended["mean_value"] = avg_row("mean_value")
        blended["note"] = "Area-weighted average of the field scores. Not a new min-max across the farm."
        scorecard.append(blended)
    incomes = [item["estimates"]["income_estimate"] for _area, item in rows]
    if any(item is None for item in incomes):
        income = None
    else:
        income = {
            "value": sum(item["value"] for item in incomes),
            "unit": incomes[0]["unit"],
            "basis": incomes[0]["basis"],
            "confidence": incomes[0]["confidence"],
            "p10": sum(item["p10"] for item in incomes),
            "p50": sum(item["p50"] for item in incomes),
            "p90": sum(item["p90"] for item in incomes),
        }
    fit = _blend_fit(rows, total)
    return {
        "id": strategy_id,
        "rotation_explanation": merge_explanations([item["rotation_explanation"] for _, item in rows]),
        "trajectories": trajectories,
        "farm_fit": fit,
        "scorecard": scorecard,
        "estimates": {
            "yield_t_ha": _blend_yields(rows, total),
            "forage_yield_t_ha": blend_estimate("forage_yield_t_ha"),
            "soil_loss_t_ha_yr": blend_estimate("soil_loss_t_ha_yr"),
            "n_fertilizer_need_kg_ha": blend_estimate("n_fertilizer_need_kg_ha"),
            "n_fertilizer_saved_kg_ha": blend_estimate("n_fertilizer_saved_kg_ha"),
            "income_estimate": income,
        },
    }


def _blend_yields(rows: list[tuple[float, dict]], total: float) -> list[dict]:
    by_crop: dict[str, list[tuple[float, dict]]] = {}
    for area, item in rows:
        for entry in item["estimates"]["yield_t_ha"]:
            by_crop.setdefault(entry["crop_id"], []).append((area, entry["series"]))
    out = []
    for crop_id, series_rows in sorted(by_crop.items()):
        template = series_rows[0][1]
        weight = sum(area for area, _ in series_rows)
        points = []
        for index, point in enumerate(template["points"]):
            def avg(attr: str, index=index) -> float:
                return sum(area * series["points"][index][attr] for area, series in series_rows) / weight
            points.append({"year": point["year"], "p50": avg("p50"), "p10": avg("p10"), "p90": avg("p90")})
        out.append({"crop_id": crop_id, "series": {**template, "points": points}})
    _ = total
    return out


def _blend_fit(rows: list[tuple[float, dict]], total: float) -> dict:
    def num(path: tuple[str, ...]) -> dict:
        template = rows[0][1]["farm_fit"]
        node = template
        for key in path:
            node = node[key]
        value = sum(area * _dig(item["farm_fit"], path)["value"] for area, item in rows) / total
        blended = {**node, "value": value, "p50": value}
        if "p10" in node and node["p10"] is not None:
            blended["p10"] = sum(area * _dig(item["farm_fit"], path)["p10"] for area, item in rows) / total
            blended["p90"] = sum(area * _dig(item["farm_fit"], path)["p90"] for area, item in rows) / total
        return blended

    p50 = num(("water_vs_quota", "irrigation_need_p50"))
    p90 = num(("water_vs_quota", "irrigation_need_p90"))
    quota = rows[0][1]["farm_fit"]["water_vs_quota"]["quota_mm_per_season"]
    if quota is None:
        status = "no_quota_given"
    elif p50["value"] > quota:
        status = "exceeds"
    elif p90["value"] > quota or p50["value"] > TC.QUOTA_TIGHT_FRACTION * quota:
        status = "tight"
    else:
        status = "within"
    markets = [(area, item["farm_fit"]["market_fit"]) for area, item in rows if item["farm_fit"]["market_fit"] is not None]
    if not markets:
        market = None
    else:
        weight = sum(area for area, _ in markets)
        market = {**markets[0][1], "value": sum(area * item["value"] for area, item in markets) / weight}
        market["p50"] = market["value"]
    return {
        "water_vs_quota": {
            "irrigation_need_p50": p50,
            "irrigation_need_p90": p90,
            "quota_mm_per_season": quota,
            "status": status,
        },
        "forage_suitability": num(("forage_suitability",)),
        "operational_fit": num(("operational_fit",)),
        "market_fit": market,
    }


def _dig(doc: dict, path: tuple[str, ...]) -> dict:
    node = doc
    for key in path:
        node = node[key]
    return node


def _rank_from_scorecards(ids: list[str], cards: list[list[dict]], priorities: dict) -> list[str]:
    return rank_by_priority(ids, cards, priorities)


def _rollup_deltas(rollup: dict) -> dict[str, dict]:
    by_id = {item["id"]: item for item in rollup["strategies"]}
    if "rot_existing" not in by_id:
        return {}
    base = by_id["rot_existing"]
    metrics = {
        "soil_organic_index": ("index, year 0 = 100", "relative"),
        "irrigation_need_mm": ("mm/yr", "modeled"),
        "soil_loss_t_ha_yr": ("t/ha/yr", "modeled"),
        "n_balance": ("index, year 0 = 100", "relative"),
    }
    out = {}
    for strategy_id, item in by_id.items():
        if strategy_id == "rot_existing":
            continue
        for metric, (unit, basis) in metrics.items():
            if metric not in item["trajectories"]:
                # soil_loss and irrigation live on estimates, not trajectories, except irrigation_need_mm.
                current_series = item["trajectories"].get(metric) or item["estimates"].get(metric)
                base_series = base["trajectories"].get(metric) or base["estimates"].get(metric)
            else:
                current_series = item["trajectories"][metric]
                base_series = base["trajectories"][metric]
            if current_series is None or base_series is None:
                continue
            current = current_series["points"][-1]["p50"]
            previous = base_series["points"][-1]["p50"]
            delta = current - previous
            out[f"{strategy_id}:{metric}"] = {
                "value": delta, "unit": unit, "basis": basis, "confidence": "low", "p50": delta,
            }
    return out


def _assumptions(prepared: Prepared) -> list[str]:
    lines = [
        "The climate path is a linear ramp from year 0 to the horizon. The ramp shape is assumed.",
        "Absolute estimates are scenario comparisons. They are not a prediction of harvest, profit, or soil loss.",
        "A cost the farmer did not enter was not treated as zero.",
        "Farm rollup series are area-weighted averages of the field percentiles, not a new ensemble.",
        "Sensitivity cells use the rain and temperature axis alone. Seasonal rain from the request is not added on that grid.",
    ]
    station = station_context(_site_id(prepared))
    if station:
        span = station.get("overlap_years") or []
        years = f"{span[0]}–{span[1]}" if len(span) == 2 else "no overlapping years"
        lines.append(
            f"Station cross-check: {station.get('name')} (ECCC climate identifier "
            f"{station.get('climate_identifier')}), {station.get('distance_to_site_km')} km from the site; "
            f"paired POWER overlap {years}. The headline station bias is POWER minus station mean temperature. "
            "The monthly rainfall comparison pairs POWER corrected total precipitation with ECCC TOTAL_RAIN; "
            "these differ because POWER precipitation may include frozen precipitation."
        )
    if prepared.soil_summary and prepared.soil_summary.get("nearby_proxy") and any(
        field.field.soil_override is None for field in prepared.fields
    ):
        lines.append(
            "KPU's SoilGrids point has no values. Fields without a soil test use an assumed "
            "nearby SoilGrids proxy at 49.109, -122.639, about 470 m away; this is not a "
            "field measurement. Check it with a local soil test."
        )
    preset = SITE_PRESETS.get(_site_id(prepared))
    if preset is not None and any(run.field.existing_rotation == "preset" for run in prepared.fields):
        if preset["name"] == "Current rotation":
            lines.append("Current rotation uses the team's starting preset for fields without an entered rotation.")
        else:
            lines.append(
                f'The existing rotation uses the site preset "{preset["name"]}". '
                "Confirm the sequence with the farm. TODO(verify)."
            )
    if not prepared.body.get("fields"):
        lines.append(
            f"No field was entered. The run uses {_DEFAULT_AREA_HA} ha and slope class {_DEFAULT_SLOPE}. "
            "Those are not a measurement of this farm. TODO(verify)."
        )
    if not prepared.body.get("constraints"):
        lines.append("Constraints were omitted. Equipment is empty, the cycle cap is 4 years, tillage is conventional, and labour is medium.")
    lines.extend(gap_notes(_site_id(prepared)))
    lines.extend(TC.assumption_notes())
    return list(dict.fromkeys(lines))


def _scenario_dict(scenario: ScenarioApplied) -> dict:
    return {
        "preset": scenario.preset,
        "rain_scale_pct": scenario.rain_scale_pct,
        "temp_offset_c": scenario.temp_offset_c,
        "rain_scale_by_season": dict(scenario.rain_scale_by_season),
        "label": scenario.label,
        "note": scenario.note,
        "ramp": {"shape": scenario.ramp.shape, "years": scenario.ramp.years, "basis": scenario.ramp.basis},
    }


def _scenario(req: ForecastRequest) -> ScenarioApplied:
    raw = req.scenario
    if isinstance(raw, str):
        resolved = P.resolve_scenario(raw)
    else:
        resolved = P.resolve_scenario(
            str(raw.get("preset") or "baseline"),
            raw.get("rain_scale_pct"),
            raw.get("temp_offset_c"),
            raw.get("rain_scale_by_season"),
        )
    return ScenarioApplied(
        preset=resolved["preset"],
        rain_scale_pct=float(resolved["rain_scale_pct"]),
        temp_offset_c=float(resolved["temp_offset_c"]),
        rain_scale_by_season={str(k): float(v) for k, v in resolved["rain_scale_by_season"].items()},
        label=resolved["label"],
        note=resolved["note"],
        ramp=Ramp(years=req.horizon_years),
    )


def _historical_weather(daily: P.Daily) -> Weather:
    years, rain = P.weekly(daily, daily.v[P.RAIN], "sum")
    _, tmax = P.weekly(daily, daily.v[P.TMAX], "max")
    _, tmin = P.weekly(daily, daily.v[P.TMIN], "min")
    _, et0 = P.weekly(daily, P.et0_hargreaves(daily), "sum")
    return Weather(np.asarray(years, dtype=np.int64), tmax, tmin, rain, et0)


def _soil_props(summary: dict | None, override: SoilOverride | None) -> SoilProps:
    if override is not None:
        sand, silt, clay = override.sand_pct, override.silt_pct, override.clay_pct
        soc = override.organic_carbon_pct
    elif summary is not None:
        sand, silt, clay = float(summary["sand_pct"]), float(summary["silt_pct"]), float(summary["clay_pct"])
        soc = float(summary["soc_g_per_kg"]) / 10.0
    else:
        raise ApiError(
            "DATA_SOURCE_UNAVAILABLE",
            "No soil seed and no soil override for this site.",
            "Enter a soil test on the field, or use a curated site.",
        )
    return SoilProps(TC.taw_mm_per_m(sand, silt, clay), sand, silt, clay, soc)


def _field_runs(req: ForecastRequest, site_id: str, info: dict, summary: dict | None, catalog) -> list[FieldRun]:
    fields = list(req.fields) if req.fields else [_default_field(req, site_id, info)]
    total_area = sum(field.area_ha for field in fields)
    farm_quota = req.farm_water_quota_mm_per_season
    runs = []
    for field in fields:
        # quota_mm_per_season is a depth. The farm value applies to each hectare.
        # It is not divided by area. A field that entered its own quota keeps that depth.
        if farm_quota is not None and field.irrigation.quota_mm_per_season is None:
            field = replace(field, irrigation=IrrigationCfg(field.irrigation.available, farm_quota))
        _ = total_area
        soil = _soil_props(summary, field.soil_override)
        field_req = _req_for_field(req, field)
        if field.selection_override is not None:
            selected = field.selection_override
            field_req = replace(field_req, selection=Selection(selected.crops, selected.pinned, selected.excluded))
        built = build_strategies(field_req, catalog, None, None, lat=float(info["lat"]), site_id=site_id)
        runs.append(FieldRun(field, soil, built.plans, built.roles, built.labels, built.warnings))
    return runs


def _default_field(req: ForecastRequest, site_id: str, info: dict) -> FieldCfg:
    quota = req.farm_water_quota_mm_per_season
    return FieldCfg(
        field_id="field_1",
        name=str(info.get("name") or site_id),
        area_ha=_DEFAULT_AREA_HA,
        slope_class=_DEFAULT_SLOPE,
        irrigation=IrrigationCfg(available=True, quota_mm_per_season=quota),
        existing_rotation="preset",
        no_till=req.constraints.no_till,
    )


def _request(body: dict) -> ForecastRequest:
    selection = body.get("selection") or {}
    crops = list(selection.get("crops") or [])
    validate_selection(crops)
    pinned = list(selection.get("pinned") or [])
    excluded = list(selection.get("excluded") or [])
    known = {crop["id"] for crop in load_catalog()["crops"]}
    unknown = [cid for cid in pinned + excluded if cid not in known]
    if unknown:
        raise ApiError("UNKNOWN_CROP", "Unknown crop in pinned or excluded.", hint=", ".join(unknown))
    horizon = int(body.get("horizon_years") or 10)
    if horizon < 5 or horizon > 10:
        raise ApiError("HORIZON_OUT_OF_RANGE", "horizon_years must be 5..10.", hint=f"Got {horizon}.")
    strategy_count = int(body.get("strategy_count") or 3)
    if strategy_count < 2 or strategy_count > 4:
        raise ApiError("INVALID_INPUT", "strategy_count must be 2..4.", hint=f"Got {strategy_count}.")
    climate = str(body.get("climate_source") or "history_resample")
    if climate not in ("cmip6_delta", "history_resample"):
        raise ApiError("INVALID_INPUT", "climate_source must be history_resample or cmip6_delta.")
    priorities = dict(body.get("priorities") or {})
    _check_weights(priorities)
    quota = body.get("farm_water_quota_mm_per_season")
    if quota is not None and float(quota) < 0:
        raise ApiError("INVALID_QUOTA", "The water quota cannot be negative.")
    constraints = _constraints(body.get("constraints"))
    fields = _fields(body.get("fields"), constraints.no_till)
    try:
        return ForecastRequest(
            selection=Selection(tuple(crops), tuple(pinned), tuple(excluded)),
            constraints=constraints,
            horizon_years=horizon,
            climate_source=climate,
            strategy_count=strategy_count,
            priorities=priorities,
            scenario=body.get("scenario") or "baseline",
            fields=tuple(fields) if fields else None,
            farm_water_quota_mm_per_season=None if quota is None else float(quota),
            custom_strategies=_customs(body.get("custom_strategies")),
            market_ratings=_ratings(body.get("market_ratings")),
            economics=_economics(body.get("economics")),
        )
    except ValueError as exc:
        raise ApiError("INVALID_INPUT", str(exc)) from exc


def _check_weights(priorities: dict) -> None:
    weights = priorities.get("weights")
    if not isinstance(weights, dict) or not weights:
        return
    unknown = [key for key in weights if key not in TC.CRITERIA]
    if unknown:
        raise ApiError("INVALID_INPUT", "Unknown criterion in weights.", hint=", ".join(unknown))
    if all(float(weights.get(criterion, 0.0)) == 0.0 for criterion in TC.CRITERIA):
        raise ApiError("INVALID_WEIGHTS", "Priority weights are all zero.", "Enter a weight above zero or leave weights out.")


def _constraints(raw) -> Constraints:
    raw = raw or {}
    labour = raw.get("labour_level") or "medium"
    cycle = int(raw.get("max_cycle_years") or 4)
    equipment = tuple(raw.get("equipment") or [])
    try:
        return Constraints(
            equipment=equipment,
            max_cycle_years=cycle,
            no_till=bool(raw.get("no_till") or False),
            labour_level=str(labour),
            livestock_on_farm=bool(raw.get("livestock_on_farm") or False),
        )
    except ValueError as exc:
        raise ApiError("INVALID_INPUT", str(exc)) from exc


def _fields(raw, no_till: bool) -> list[FieldCfg] | None:
    if not raw:
        return None
    if not isinstance(raw, list):
        raise ApiError("INVALID_INPUT", "fields must be a list.")
    fields = []
    for item in raw:
        quota = item.get("irrigation", {}).get("quota_mm_per_season")
        if quota is not None and float(quota) < 0:
            raise ApiError("INVALID_QUOTA", "A field water quota cannot be negative.")
        rotation = item.get("existing_rotation")
        if rotation == "preset":
            existing: str | tuple[Slot, ...] = "preset"
        elif isinstance(rotation, list) and rotation:
            existing = tuple(Slot(int(slot["year_index"]), slot["season"], slot["crop_id"]) for slot in rotation)
        else:
            raise ApiError("INVALID_INPUT", "existing_rotation must be 'preset' or a list of slots.")
        override = item.get("soil_override")
        soil = None
        if override:
            soil = SoilOverride(
                float(override["sand_pct"]), float(override["silt_pct"]),
                float(override["clay_pct"]), float(override["organic_carbon_pct"]),
            )
        selection = item.get("selection_override")
        from app.twin.types import SelectionOverride
        parsed_selection = None
        if selection:
            parsed_selection = SelectionOverride(
                tuple(selection.get("crops") or ()),
                tuple(selection.get("pinned") or ()),
                tuple(selection.get("excluded") or ()),
            )
        fields.append(FieldCfg(
            field_id=str(item["field_id"]),
            name=str(item.get("name") or item["field_id"]),
            area_ha=float(item["area_ha"]),
            slope_class=str(item["slope_class"]),
            irrigation=IrrigationCfg(bool(item["irrigation"]["available"]), None if quota is None else float(quota)),
            existing_rotation=existing,
            no_till=bool(item.get("no_till", no_till)),
            soil_override=soil,
            polygon=item.get("polygon"),
            selection_override=parsed_selection,
        ))
    return fields


def _customs(raw):
    if not raw:
        return None
    cycles = []
    for cycle in raw:
        cycles.append(tuple(Slot(int(slot["year_index"]), slot["season"], slot["crop_id"]) for slot in cycle))
    return tuple(cycles)


def _ratings(raw):
    if not raw:
        return None
    return {str(key): int(value) for key, value in raw.items()}


def _economics(raw):
    if not raw:
        return None
    prices = {}
    for crop_id, price in (raw.get("crop_prices") or {}).items():
        prices[str(crop_id)] = CropPrice(float(price["value"]), str(price["unit"]))
    costs = raw.get("input_costs") or {}
    return Economics(
        str(raw["currency"]),
        prices,
        InputCosts(
            fertilizer_per_kg_n=costs.get("fertilizer_per_kg_n"),
            seed_per_ha=costs.get("seed_per_ha"),
            irrigation_per_mm_ha=costs.get("irrigation_per_mm_ha"),
            labour_per_hour=costs.get("labour_per_hour"),
        ),
    )


def _cache_key(kind: str, site_id: str, body: dict, members: int) -> str:
    return request_hash({"kind": kind, "engine": TC.ENGINE_VERSION, "site_id": site_id, "members": members, "body": body})


def _cache_path(key: str):
    return REPO_ROOT / "data" / "cache" / "forecast" / f"{key}.json"


def _read_cache(key: str) -> dict | None:
    if key in _memory:
        return deepcopy(_memory[key])
    path = _cache_path(key)
    if not path.is_file():
        return None
    doc = json.loads(path.read_text(encoding="utf-8"))
    _remember(key, doc)
    return deepcopy(doc)


def _write_cache(key: str, doc: dict) -> None:
    _remember(key, doc)
    path = _cache_path(key)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False), encoding="utf-8")
    except OSError:
        return


def _remember(key: str, doc: dict) -> None:
    if key in _memory:
        return
    _memory[key] = doc
    _memory_order.append(key)
    while len(_memory_order) > _CACHE_LIMIT:
        old = _memory_order.pop(0)
        _memory.pop(old, None)


def clear_forecast_cache() -> None:
    """Test helper. Does not delete files another process may be reading."""

    _memory.clear()
    _memory_order.clear()
