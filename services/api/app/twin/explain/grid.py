"""Rain by temperature grid. Fewer ensemble members than the forecast, as the PRD asks.

15 cells = rain {-30, -15, 0, +15, +30} % × temperature {0, +1.5, +3} °C.
``SENSITIVITY_MEMBERS`` is 4. That count is a speed choice so the grid can stay
under 2 s. It is not a sample-size study. TODO(verify) on the demo machine.
"""

from __future__ import annotations

from app.features import pipeline as P
from app.twin.score import rank_by_priority, scorecards
from app.twin.types import Ramp, ScenarioApplied
from app.twin.weather_ensemble import build_members

# Specified in PRD group 5. Not a tunable guess.
RAIN_AXIS = (-30.0, -15.0, 0.0, 15.0, 30.0)
TEMP_AXIS = (0.0, 1.5, 3.0)
SENSITIVITY_MEMBERS = 4

_METRICS = (
    ("irrigation_need_mm", "mm/yr", "modeled"),
    ("soil_loss_t_ha_yr", "t/ha/yr", "modeled"),
    ("soil_organic_index", "index, year 0 = 100", "relative"),
    ("n_balance", "index, year 0 = 100", "relative"),
)


def _year10_number(simulation, metric: str, unit: str, basis: str) -> dict:
    point = simulation[metric].points[-1]
    return {
        "value": point.p50,
        "unit": unit,
        "basis": basis,
        "confidence": "low",
        "p10": point.p10,
        "p50": point.p50,
        "p90": point.p90,
    }


def _cell_scenario(preset: str, rain: float, temp: float, horizon: int) -> ScenarioApplied:
    """The cell is the axis value. Seasonal rain from the request is not added on top."""

    resolved = P.resolve_scenario(preset, rain, temp, {})
    return ScenarioApplied(
        preset=resolved["preset"],
        rain_scale_pct=float(resolved["rain_scale_pct"]),
        temp_offset_c=float(resolved["temp_offset_c"]),
        rain_scale_by_season=dict(resolved["rain_scale_by_season"]),
        label=resolved["label"],
        note=resolved["note"],
        ramp=Ramp(years=horizon),
    )


def run_grid(prepared, *, members: int = SENSITIVITY_MEMBERS) -> dict:
    """Year-10 metrics and how often each strategy ranks first across the 15 cells.

    ``prepared`` is the object from ``app.services.forecast.prepare``. The first
    field is the one ranked. Farm rollup is not re-simulated on every cell.
    """

    from app.services.forecast import simulate_plans
    from app.twin.score import farm_fit

    field = prepared.fields[0]
    horizon = prepared.req.horizon_years
    cells = []
    first_counts = {plan.strategy_id: 0 for plan in field.plans}
    for rain in RAIN_AXIS:
        for temp in TEMP_AXIS:
            scenario = _cell_scenario(prepared.scenario.preset, rain, temp, horizon)
            member_weather = build_members(
                prepared.weather, scenario, horizon, members, prepared.digest, lat=prepared.lat,
            )
            simulations = simulate_plans(field, member_weather, prepared.catalog, prepared.lat)
            fits = [farm_fit(plan, sim, prepared.req, prepared.catalog) for plan, sim in zip(field.plans, simulations)]
            cards = scorecards(simulations, fits)
            ids = [plan.strategy_id for plan in field.plans]
            ranking = rank_by_priority(ids, cards, prepared.req.priorities or {})
            first_counts[ranking[0]] += 1
            cells.append({
                "rain_scale_pct": rain,
                "temp_offset_c": temp,
                "per_strategy": {
                    plan.strategy_id: {
                        metric: _year10_number(sim, metric, unit, basis)
                        for metric, unit, basis in _METRICS
                    }
                    for plan, sim in zip(field.plans, simulations)
                },
            })
    n_cells = len(cells)
    return {
        "axes": {"rain_scale_pct": list(RAIN_AXIS), "temp_offset_c": list(TEMP_AXIS)},
        "cells": cells,
        "rank_stability": {
            "share_first_by_strategy": {
                strategy_id: first_counts[strategy_id] / n_cells for strategy_id in first_counts
            },
        },
    }
