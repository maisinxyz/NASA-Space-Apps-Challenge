"""Ten-year ensemble loop (PRD §5.1, W6c).

Expands a cycle to the horizon, runs each weather member, and returns
p10/p50/p90 `YearSeries`. Year 0 is the baseline state: relative indices are
100, cumulative nitrogen and pest pressure are 0. Flux series (water, soil
loss, fertilizer, yield) use the ensemble of simulated years and repeat the
year-1 distribution at year 0 so the line has a baseline point. That year-0
flux is the first simulated year, which already includes one step of the
scenario ramp.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from app.twin import config as C
from app.twin.nitrogen import n_balance_index, nitrogen_flux, update_nitrogen
from app.twin.pest import pressure_index, unverified_interval_notes, update_pest
from app.twin.soil import initial_state, organic_index, soil_loss_t_ha, update_soc
from app.twin.types import (
    Plan,
    PlanYear,
    Slot,
    SoilProps,
    Weather,
    YearPoint,
    YearSeries,
)
from app.twin.water import _number as _finite, run_water_year, year_profile


class Simulation(dict):
    """`dict[str, YearSeries]` plus yield-by-crop, review notes, and year-10 member vectors."""

    def __init__(self, series: dict[str, YearSeries], *, review_notes, yield_by_crop, member_year10):
        super().__init__(series)
        self.review_notes = tuple(review_notes)
        self.yield_by_crop = yield_by_crop
        self.member_year10 = member_year10


def expand_plan(plan: Plan, horizon: int) -> Plan:
    """Repeat `cycle_years` until `horizon`. Slot year indexes become 1..horizon."""
    if horizon < 1:
        raise ValueError("horizon must be at least 1")
    grouped: dict[int, list[Slot]] = defaultdict(list)
    for slot in plan.slots:
        grouped[slot.year_index].append(slot)
    cycle = plan.cycle_years if plan.cycle_years >= 1 else (max(grouped) if grouped else 1)
    expanded: list[Slot] = []
    for year in range(1, horizon + 1):
        source = ((year - 1) % cycle) + 1
        for slot in grouped.get(source, []):
            expanded.append(Slot(year, slot.season, slot.crop_id))
    return Plan(plan.strategy_id, tuple(expanded), cycle)


def series_to_dict(series: YearSeries) -> dict:
    """JSON object matching the `YearSeries` schema, including p10 and p90 on every point."""
    return {
        "metric": series.metric,
        "unit": series.unit,
        "basis": series.basis,
        "confidence": series.confidence,
        "needs_local_review": series.needs_local_review,
        "points": [
            {"year": point.year, "p50": point.p50, "p10": point.p10, "p90": point.p90}
            for point in series.points
        ],
    }


def _series(metric: str, unit: str, basis: str, confidence: str, review: bool, columns: np.ndarray, year0) -> YearSeries:
    """`columns` shape (members, horizon). Year 0 repeats `year0` when it is a triple, else the year-1 distribution."""
    points = []
    if year0 is None:
        p10, p50, p90 = _pct(columns[:, 0])
        points.append(YearPoint(0, p50, p10, p90))
    else:
        value = float(year0)
        points.append(YearPoint(0, value, value, value))
    for year in range(columns.shape[1]):
        p10, p50, p90 = _pct(columns[:, year])
        points.append(YearPoint(year + 1, p50, p10, p90))
    return YearSeries(metric, unit, basis, confidence, review, tuple(points))


def _pct(values: np.ndarray) -> tuple[float, float, float]:
    p10, p50, p90 = np.percentile(np.asarray(values, dtype=np.float64), [10, 50, 90])
    return float(p10), float(p50), float(p90)


def simulate(plan: Plan, members: list[Weather], soil: SoilProps, field, catalog, *, lat: float) -> Simulation:
    """Ensemble trajectories for one field plan. `lat` is keyword-only."""
    if not members:
        raise ValueError("simulate needs at least one weather member")
    horizon = int(members[0].years.shape[0])
    if any(int(member.years.shape[0]) != horizon for member in members):
        raise ValueError("every member must span the same horizon")
    expanded = expand_plan(plan, horizon)
    years = [PlanYear(year, tuple(slot for slot in expanded.slots if slot.year_index == year)) for year in range(1, horizon + 1)]
    profiles = [year_profile(plan_year, catalog, lat) for plan_year in years]
    n = len(members)
    keys = (
        "soil_organic_index", "n_balance", "n_balance_kg_ha", "n_fixed_share", "infiltration_index",
        "runoff_mm", "rain_mm", "pest_pressure_index", "bare_weeks", "water_demand_mm", "irrigation_need_mm",
        "soil_loss_t_ha_yr", "n_fertilizer_need_kg_ha", "forage_yield_t_ha",
    )
    grid = {key: np.zeros((n, horizon)) for key in keys}
    crop_ids = []
    seen = set()
    for slot in expanded.slots:
        if slot.crop_id != "fallow" and slot.crop_id not in seen:
            seen.add(slot.crop_id)
            crop_ids.append(slot.crop_id)
    yield_grid = {crop_id: np.zeros((n, horizon)) for crop_id in crop_ids}
    notes: list[str] = []
    for profile in profiles:
        notes.extend(profile.missing)
    notes.extend(unverified_interval_notes(expanded, catalog))
    crops = C.index_crops(catalog)
    for crop_id in crop_ids:
        crop = crops.get(crop_id)
        if crop is None:
            continue
        if _finite(crop.get("reference_yield")) is None:
            notes.append(f"{crop_id}: reference_yield is null, so its yield series is omitted")
        elif _finite(crop.get("yield_response_factor_ky")) is None and crop_id not in C.KY_FAO33:
            notes.append(f"{crop_id}: Ky is unknown, so its yield series is omitted")

    for member_i, member in enumerate(members):
        state = initial_state()
        storage = None
        for year_i, plan_year in enumerate(years):
            weather_year = member.year_slice(year_i)
            water = run_water_year(
                plan_year, weather_year, soil, state, field.irrigation,
                catalog=catalog, lat=lat, no_till=field.no_till, storage_start_mm=storage, profile=profiles[year_i],
            )
            storage = float(water.storage_end_mm[-1])
            flux = nitrogen_flux(state, plan_year, water, catalog)
            state = update_soc(state, plan_year, water, weather_year, catalog=catalog, soil=soil, no_till=field.no_till)
            state = update_nitrogen(state, plan_year, water, catalog=catalog)
            state = update_pest(state, expanded, plan_year.year_index, catalog)
            grid["soil_organic_index"][member_i, year_i] = organic_index(state)
            grid["n_balance"][member_i, year_i] = n_balance_index(state)
            grid["n_balance_kg_ha"][member_i, year_i] = state.n_pool
            grid["n_fixed_share"][member_i, year_i] = flux.fixed_share
            grid["infiltration_index"][member_i, year_i] = state.infiltration_idx
            grid["runoff_mm"][member_i, year_i] = float(np.sum(water.runoff_mm))
            grid["rain_mm"][member_i, year_i] = float(np.sum(water.rain_mm))
            grid["pest_pressure_index"][member_i, year_i] = pressure_index(state)
            grid["bare_weeks"][member_i, year_i] = water.bare_weeks
            grid["water_demand_mm"][member_i, year_i] = float(np.sum(water.etm_mm))
            grid["irrigation_need_mm"][member_i, year_i] = float(np.sum(water.irrigation_need_mm))
            grid["soil_loss_t_ha_yr"][member_i, year_i] = soil_loss_t_ha(
                water, weather_year, soil, field.slope_class, field.no_till,
            )
            grid["n_fertilizer_need_kg_ha"][member_i, year_i] = flux.fertilizer_need_kg_ha
            grid["forage_yield_t_ha"][member_i, year_i] = float(sum(water.forage_yield_t_ha.values()))
            for crop_id in crop_ids:
                yield_grid[crop_id][member_i, year_i] = water.yield_t_ha.get(crop_id, 0.0)
            if member_i == 0:
                notes.extend(flux.notes)

    reference = float(np.median(grid["runoff_mm"][:, 0]))
    if reference > 1e-6:
        runoff_index = 100.0 * grid["runoff_mm"] / reference
    else:
        runoff_index = np.full_like(grid["runoff_mm"], 100.0)

    series = {
        "soil_organic_index": _series("soil_organic_index", "index, year 0 = 100", "relative", "low", True, grid["soil_organic_index"], 100.0),
        "n_balance": _series("n_balance", "index, year 0 = 100", "relative", "low", True, grid["n_balance"], 100.0),
        "n_balance_kg_ha": _series("n_balance_kg_ha", "kg N/ha", "assumed", "low", True, grid["n_balance_kg_ha"], 0.0),
        "n_fixed_share": _series("n_fixed_share", "1", "assumed", "low", True, grid["n_fixed_share"], 0.0),
        "infiltration_index": _series("infiltration_index", "index, year 0 = 100", "modeled", "low", True, grid["infiltration_index"], 100.0),
        "runoff_index": _series("runoff_index", "index, year 0 = 100", "relative", "low", True, runoff_index, 100.0),
        "pest_pressure_index": _series("pest_pressure_index", "index 0-100", "assumed", "low", True, grid["pest_pressure_index"], 0.0),
        "bare_weeks": _series("bare_weeks", "weeks/yr", "derived", "low", True, grid["bare_weeks"], None),
        "water_demand_mm": _series("water_demand_mm", "mm/yr", "modeled", "low", True, grid["water_demand_mm"], None),
        "irrigation_need_mm": _series("irrigation_need_mm", "mm/yr", "modeled", "low", True, grid["irrigation_need_mm"], None),
        "soil_loss_t_ha_yr": _series("soil_loss_t_ha_yr", "t/ha/yr", "modeled", "low", True, grid["soil_loss_t_ha_yr"], None),
        "n_fertilizer_need_kg_ha": _series("n_fertilizer_need_kg_ha", "kg N/ha/yr", "assumed", "low", True, grid["n_fertilizer_need_kg_ha"], None),
        "forage_yield_t_ha": _series("forage_yield_t_ha", "t/ha", "modeled", "low", True, grid["forage_yield_t_ha"], None),
    }
    yield_by_crop = {}
    for crop_id, values in yield_grid.items():
        crop = crops.get(crop_id)
        if crop is None or _finite(crop.get("reference_yield")) is None:
            continue
        if _finite(crop.get("yield_response_factor_ky")) is None and crop_id not in C.KY_FAO33:
            continue
        yield_by_crop[crop_id] = _series(f"yield_t_ha:{crop_id}", "t/ha", "modeled", "low", True, values, None)
    notes.append("Nitrogen rates, the pest interval, and the RUSLE stand-in are assumed. TODO(verify). See twin/config.py.")
    # Year-10 vectors let W7 put an ensemble range on the climate-driven scores.
    member_year10 = {
        "irrigation_need_mm": grid["irrigation_need_mm"][:, -1].copy(),
        "soil_loss_t_ha_yr": grid["soil_loss_t_ha_yr"][:, -1].copy(),
        "water_demand_mm": grid["water_demand_mm"][:, -1].copy(),
    }
    # Preserve order and drop repeated notes.
    unique = list(dict.fromkeys(notes))
    return Simulation(series, review_notes=unique, yield_by_crop=yield_by_crop, member_year10=member_year10)
