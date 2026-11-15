"""Farm fit, income, fertilizer saved, and the seven-criterion scorecard (PRD §5.6, D1).

Min-max is across the strategies passed in. All equal scores 50. Lower-is-better
criteria are flipped so a higher score is always better. Priority weights change
the rank and not the set of strategies.
"""

from __future__ import annotations

import numpy as np

from app.twin import config as C
from app.twin.run import series_to_dict
from app.twin.types import (
    QUOTA_STATUSES,
    ForecastRequest,
    Number,
    Plan,
    YearPoint,
    YearSeries,
)


def _year_values(series: YearSeries, attr: str) -> list[float]:
    return [float(getattr(point, attr) if getattr(point, attr) is not None else point.p50) for point in series.points if point.year >= 1]


def _mean(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def _number(value: float, unit: str, basis: str, confidence: str, p10: float | None = None, p90: float | None = None) -> dict:
    out = {"value": value, "unit": unit, "basis": basis, "confidence": confidence, "p50": value}
    if p10 is not None:
        out["p10"] = p10
    if p90 is not None:
        out["p90"] = p90
    return out


def _field(req: ForecastRequest):
    return req.fields[0] if req.fields else None


def _planted(plan: Plan) -> list[str]:
    seen: list[str] = []
    for slot in plan.slots:
        if slot.crop_id != "fallow" and slot.crop_id not in seen:
            seen.append(slot.crop_id)
    return seen


def _forage_fraction(plan: Plan, catalog) -> float:
    """Share of non-fallow slots that are forage or a grazing, hay, or silage use."""
    crops = C.index_crops(catalog)
    slots = [slot for slot in plan.slots if slot.crop_id != "fallow"]
    if not slots:
        return 0.0
    good = 0
    for slot in slots:
        crop = crops.get(slot.crop_id) or {}
        use = crop.get("forage_use")
        if crop.get("category") == "forage" or use in C.FORAGE_USES:
            good += 1
    return good / len(slots)


def unrated_crops(plan: Plan, req: ForecastRequest) -> list[str]:
    ratings = req.market_ratings or {}
    return [crop_id for crop_id in _planted(plan) if crop_id not in ratings]


def rank_stability_note() -> str:
    """Honest stand-in. W8 owns the share of the climate grid that keeps this rank."""
    return (
        "This rank is the priority-weighted score on the requested scenario. "
        "How often that rank holds across the climate grid is computed by the sensitivity run."
    )


def farm_fit(plan: Plan, series: dict, req: ForecastRequest, catalog) -> dict:
    """Group 4 for one strategy. `series` is the `Simulation` dict from `simulate`."""
    field = _field(req)
    quota = None
    if field is not None and field.irrigation.quota_mm_per_season is not None:
        quota = float(field.irrigation.quota_mm_per_season)
    elif req.farm_water_quota_mm_per_season is not None:
        quota = float(req.farm_water_quota_mm_per_season)
    need = series["irrigation_need_mm"]
    p50 = _mean(_year_values(need, "p50"))
    p10 = _mean(_year_values(need, "p10"))
    p90 = _mean(_year_values(need, "p90"))
    if quota is None:
        status = "no_quota_given"
    elif p50 > quota:
        status = "exceeds"
    elif p90 > quota or p50 > C.QUOTA_TIGHT_FRACTION * quota:
        status = "tight"
    else:
        status = "within"
    if status not in QUOTA_STATUSES:
        raise ValueError(status)
    crops = C.index_crops(catalog)
    planted = _planted(plan)
    have = set(req.constraints.equipment)
    needed = set()
    specialty_blocked = False
    labour_ok = True
    cap = C.LABOUR_PEAK_WEEK_CAP[req.constraints.labour_level]
    for crop_id in planted:
        crop = crops.get(crop_id) or {}
        needed |= set(crop.get("needs_equipment") or [])
        if crop.get("needs_specialty_equipment") and not have:
            specialty_blocked = True
        if len(crop.get("labour_peak_weeks") or []) > cap:
            labour_ok = False
    if not needed:
        equipment_score = 40.0 if specialty_blocked else 100.0
    else:
        equipment_score = 100.0 * len(needed & have) / len(needed)
    labour_score = 100.0 if labour_ok else 40.0
    operational = 0.5 * equipment_score + 0.5 * labour_score
    ratings = req.market_ratings or {}
    rated = [int(ratings[crop_id]) for crop_id in planted if crop_id in ratings]
    market = None if not rated else _number(_mean([float(value) for value in rated]), "1-5", "assumed", "low")
    return {
        "water_vs_quota": {
            "irrigation_need_p50": _number(p50, "mm/season", "modeled", "low", p10, p90),
            "irrigation_need_p90": _number(p90, "mm/season", "modeled", "low", p10, p90),
            "quota_mm_per_season": quota,
            "status": status,
        },
        "forage_suitability": _number(100.0 * _forage_fraction(plan, catalog), "index 0-100", "relative", "low"),
        "operational_fit": _number(operational, "index 0-100", "relative", "low"),
        "market_fit": market,
    }


def _price_per_tonne(price) -> float | None:
    unit = price.unit.strip().lower().replace("_", " ")
    if unit in C.PRICE_UNITS_PER_TONNE or "tonne" in unit:
        return float(price.value)
    return None


def income_estimate(plan: Plan, simulation, req: ForecastRequest) -> tuple[dict | None, tuple[str, ...]]:
    """Field total, currency/yr. Null when no per-tonne price was entered. Costs that were not entered are not treated as zero."""
    notes: list[str] = []
    economics = req.economics
    if economics is None or not economics.crop_prices:
        return None, ("No crop prices were entered, so income_estimate is null.",)
    field = _field(req)
    area = float(field.area_ha) if field is not None else 1.0
    if field is None:
        notes.append("No field area was on the request; income is reported as if the field were 1 ha.")
    planted = _planted(plan)
    priced = []
    for crop_id in planted:
        price = economics.crop_prices.get(crop_id)
        if price is None:
            notes.append(f"{crop_id}: no price was entered")
            continue
        per_tonne = _price_per_tonne(price)
        if per_tonne is None:
            notes.append(f"{crop_id}: price unit {price.unit!r} is not per tonne, so it was not multiplied")
            continue
        series = simulation.yield_by_crop.get(crop_id)
        if series is None:
            notes.append(f"{crop_id}: no yield series, so it adds no revenue")
            continue
        priced.append((series, per_tonne))
    if not priced:
        notes.append("No priced crop has a yield series, so income_estimate is null.")
        return None, tuple(notes)
    costs = economics.input_costs
    need = simulation["n_fertilizer_need_kg_ha"]
    irrig = simulation["irrigation_need_mm"]
    years = [point.year for point in need.points if point.year >= 1]

    def _cost(attr: str) -> float:
        fert = 0.0
        if costs.fertilizer_per_kg_n is not None:
            fert = float(costs.fertilizer_per_kg_n) * _mean(_year_values(need, attr))
        water = 0.0
        if costs.irrigation_per_mm_ha is not None:
            water = float(costs.irrigation_per_mm_ha) * _mean(_year_values(irrig, attr))
        seed = 0.0
        if costs.seed_per_ha:
            for crop_id in planted:
                if crop_id in costs.seed_per_ha:
                    seed += float(costs.seed_per_ha[crop_id])
        return fert + water + seed

    if costs.fertilizer_per_kg_n is None or costs.irrigation_per_mm_ha is None or not costs.seed_per_ha:
        notes.append("A cost the farmer did not enter was not subtracted. This income is not a full net.")
    if costs.labour_per_hour is not None:
        notes.append("Labour hours are not simulated, so labour_per_hour was not subtracted.")

    def _revenue(attr: str) -> float:
        total = 0.0
        for series, per_tonne in priced:
            total += _mean(_year_values(series, attr)) * per_tonne
        return total

    # p10 income uses low yield and high costs. p90 uses high yield and low costs.
    p50 = (_revenue("p50") - _cost("p50")) * area
    p10 = (_revenue("p10") - _cost("p90")) * area
    p90 = (_revenue("p90") - _cost("p10")) * area
    lo, hi = min(p10, p50, p90), max(p10, p50, p90)
    return _number(p50, f"{economics.currency}/yr", "modeled", "low", lo, hi), tuple(dict.fromkeys(notes))


def fertilizer_saved(need: YearSeries, existing: YearSeries) -> YearSeries:
    """Existing need minus this need, kg N/ha/yr. Positive means this plan uses less fertilizer."""
    points = []
    for current, base in zip(need.points, existing.points):
        p50 = base.p50 - current.p50
        p10 = (base.p10 if base.p10 is not None else base.p50) - (current.p90 if current.p90 is not None else current.p50)
        p90 = (base.p90 if base.p90 is not None else base.p50) - (current.p10 if current.p10 is not None else current.p50)
        lo, hi = min(p10, p50, p90), max(p10, p50, p90)
        points.append(YearPoint(current.year, p50, lo, hi))
    return YearSeries("n_fertilizer_saved_kg_ha", "kg N/ha/yr", "assumed", "low", True, tuple(points))


def estimates(simulation, saved: YearSeries, income: dict | None) -> dict:
    """StrategyEstimates object. `income` is null when prices were not entered."""
    return {
        "yield_t_ha": [
            {"crop_id": crop_id, "series": series_to_dict(series)}
            for crop_id, series in sorted(simulation.yield_by_crop.items())
        ],
        "forage_yield_t_ha": series_to_dict(simulation["forage_yield_t_ha"]),
        "soil_loss_t_ha_yr": series_to_dict(simulation["soil_loss_t_ha_yr"]),
        "n_fertilizer_need_kg_ha": series_to_dict(simulation["n_fertilizer_need_kg_ha"]),
        "n_fertilizer_saved_kg_ha": series_to_dict(saved),
        "income_estimate": income,
    }


def _normalize(values: list[float], lower_is_better: bool) -> list[float]:
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [50.0] * len(values)
    if lower_is_better:
        return [100.0 * (hi - value) / (hi - lo) for value in values]
    return [100.0 * (value - lo) / (hi - lo) for value in values]


def _weights(priorities: dict) -> dict[str, float]:
    if priorities.get("weights"):
        raw = {criterion: float(priorities["weights"].get(criterion, 0.0)) for criterion in C.CRITERIA}
    elif priorities.get("weight_preset") in C.WEIGHT_PRESETS:
        raw = {criterion: 0.0 for criterion in C.CRITERIA}
        raw.update(C.WEIGHT_PRESETS[priorities["weight_preset"]])
    else:
        raw = {criterion: 1.0 for criterion in C.CRITERIA}
    selected = priorities.get("criteria_selected") or []
    if selected:
        raw = {criterion: raw[criterion] if criterion in selected else 0.0 for criterion in C.CRITERIA}
    total = sum(raw.values())
    if total <= 0:
        return {criterion: 1.0 / len(C.CRITERIA) for criterion in C.CRITERIA}
    return {criterion: raw[criterion] / total for criterion in C.CRITERIA}


def _metric_bundle(simulation, fit: dict) -> tuple[dict[str, float], dict[str, float]]:
    def year10(metric: str) -> float:
        return next(point.p50 for point in simulation[metric].points if point.year == simulation[metric].points[-1].year)

    def mean(metric: str) -> float:
        return _mean(_year_values(simulation[metric], "p50"))

    market = 0.0 if fit["market_fit"] is None else float(fit["market_fit"]["value"])
    forage = float(fit["forage_suitability"]["value"])
    year10_map = {
        "nutrient_cycling": year10("n_balance"),
        "erosion_risk": year10("soil_loss_t_ha_yr"),
        "organic_matter": year10("soil_organic_index"),
        "pest_disruption": 100.0 - year10("pest_pressure_index"),
        "water_use": year10("irrigation_need_mm"),
        "forage_potential": forage,
        "market_suitability": market,
    }
    mean_map = {
        "nutrient_cycling": mean("n_balance"),
        "erosion_risk": mean("soil_loss_t_ha_yr"),
        "organic_matter": mean("soil_organic_index"),
        "pest_disruption": 100.0 - mean("pest_pressure_index"),
        "water_use": mean("irrigation_need_mm"),
        "forage_potential": forage,
        "market_suitability": market,
    }
    return year10_map, mean_map


def scorecards(simulations: list, fits: list[dict]) -> list[list[dict]]:
    """One scorecard list per strategy, in the same order. Scores are min-max across this list."""
    bundles = [_metric_bundle(simulation, fit) for simulation, fit in zip(simulations, fits)]
    year10 = {criterion: [bundle[0][criterion] for bundle in bundles] for criterion in C.CRITERIA}
    scores = {criterion: _normalize(year10[criterion], criterion in C.LOWER_IS_BETTER) for criterion in C.CRITERIA}
    ranges = _score_ranges(simulations, fits)
    cards = []
    for index, (simulation, fit) in enumerate(zip(simulations, fits)):
        card = []
        y10, mean = bundles[index]
        for criterion in C.CRITERIA:
            entry = {
                "criterion": criterion,
                "score": round(scores[criterion][index], 6),
                "unit": C.SCORE_UNIT,
                "basis": C.CRITERION_BASIS[criterion],
                "confidence": "low",
                "needs_local_review": True,
                "year10_value": y10[criterion],
                "mean_value": mean[criterion],
                "inputs": [{
                    "name": "year10",
                    "value": y10[criterion],
                    "unit": C.CRITERION_UNIT[criterion],
                    "basis": C.CRITERION_BASIS[criterion],
                }],
            }
            notes = []
            if len({round(value, 9) for value in year10[criterion]}) == 1:
                notes.append("All strategies are equal on this criterion, so each scores 50.")
            if criterion in ranges:
                entry["range"] = ranges[criterion][index]
            if notes:
                entry["note"] = " ".join(notes)
            card.append(entry)
        cards.append(card)
    return cards


def _score_ranges(simulations: list, fits: list[dict]) -> dict[str, list[dict]]:
    """Ensemble range of the 0-100 score for the two climate-driven criteria, when member vectors exist."""
    out = {}
    mapping = {"water_use": "irrigation_need_mm", "erosion_risk": "soil_loss_t_ha_yr"}
    for criterion, key in mapping.items():
        vectors = []
        for simulation in simulations:
            member = getattr(simulation, "member_year10", {}).get(key)
            if member is None:
                vectors = []
                break
            vectors.append(member)
        if not vectors:
            continue
        stacked = [list(row) for row in zip(*vectors)]
        per_strategy: list[list[float]] = [[] for _ in simulations]
        for row in stacked:
            normalized = _normalize([float(value) for value in row], criterion in C.LOWER_IS_BETTER)
            for index, score in enumerate(normalized):
                per_strategy[index].append(score)
        out[criterion] = []
        for column in per_strategy:
            if not column:
                continue
            p10, p90 = np.percentile(np.asarray(column, dtype=np.float64), [10, 90])
            out[criterion].append({"p10": float(p10), "p90": float(p90)})
    return out


def rank_by_priority(strategy_ids: list[str], cards: list[list[dict]], priorities: dict) -> list[str]:
    """Highest weighted score first. Ties break by strategy id. Weights do not change `cards`."""
    weights = _weights(priorities or {})
    overall = []
    for card in cards:
        by = {row["criterion"]: row["score"] for row in card}
        overall.append(sum(weights[criterion] * by[criterion] for criterion in C.CRITERIA))
    order = sorted(range(len(strategy_ids)), key=lambda index: (-overall[index], strategy_ids[index]))
    return [strategy_ids[index] for index in order]


def review_flags(strategy_id: str, notes: tuple[str, ...] | list[str], *, unrated: list[str] | None = None, income_missing: bool = False) -> list[dict]:
    flags = []
    for index, note in enumerate(dict.fromkeys(notes)):
        flags.append({
            "id": f"{strategy_id}_verify_{index}",
            "strategy_id": strategy_id,
            "severity": "verify",
            "text": note,
            "trigger": {"layer": "twin/config", "rule": "unverified_coefficient"},
        })
    for crop_id in unrated or []:
        flags.append({
            "id": f"{strategy_id}_market_{crop_id}",
            "strategy_id": strategy_id,
            "severity": "info",
            "text": f"{crop_id} has no buyer-demand rating.",
            "trigger": {"layer": "market_ratings", "rule": "unrated_crop"},
        })
    if income_missing:
        flags.append({
            "id": f"{strategy_id}_income_missing",
            "strategy_id": strategy_id,
            "severity": "verify",
            "text": "No usable crop price was entered, so income_estimate is null.",
            "trigger": {"layer": "economics", "rule": "missing_price"},
        })
    return flags


def deltas_vs_existing(simulations: list, strategy_ids: list[str], existing_id: str = "rot_existing") -> dict[str, dict]:
    """Year-10 p50 minus the existing strategy, as Number dicts."""
    by_id = {strategy_id: simulation for strategy_id, simulation in zip(strategy_ids, simulations)}
    base = by_id[existing_id]
    metrics = ("soil_organic_index", "irrigation_need_mm", "soil_loss_t_ha_yr", "n_balance")
    units = {
        "soil_organic_index": "index, year 0 = 100",
        "irrigation_need_mm": "mm/yr",
        "soil_loss_t_ha_yr": "t/ha/yr",
        "n_balance": "index, year 0 = 100",
    }
    basis = {
        "soil_organic_index": "relative",
        "irrigation_need_mm": "modeled",
        "soil_loss_t_ha_yr": "modeled",
        "n_balance": "relative",
    }
    out = {}
    for strategy_id, simulation in by_id.items():
        if strategy_id == existing_id:
            continue
        for metric in metrics:
            current = next(point.p50 for point in simulation[metric].points if point.year == simulation[metric].points[-1].year)
            previous = next(point.p50 for point in base[metric].points if point.year == base[metric].points[-1].year)
            out[f"{strategy_id}:{metric}"] = _number(current - previous, units[metric], basis[metric], "low")
    return out


# Number is re-exported so callers can validate a built income object if they want the dataclass.
def as_number(payload: dict) -> Number:
    return Number(
        value=float(payload["value"]),
        unit=payload["unit"],
        basis=payload["basis"],
        confidence=payload["confidence"],
        p10=payload.get("p10"),
        p50=payload.get("p50"),
        p90=payload.get("p90"),
    )
