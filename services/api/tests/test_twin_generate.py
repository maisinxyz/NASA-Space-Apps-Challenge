"""W7: strategy search, farm fit, scorecard, income."""

from app.twin.catalog import load_catalog
from app.twin.generate import build_strategies
from app.twin.score import (
    as_number,
    deltas_vs_existing,
    farm_fit,
    fertilizer_saved,
    income_estimate,
    rank_by_priority,
    rank_stability_note,
    review_flags,
    scorecards,
    unrated_crops,
)
from app.twin.types import (
    WEEK_COUNT,
    Constraints,
    CropPrice,
    Economics,
    FieldCfg,
    ForecastRequest,
    InputCosts,
    IrrigationCfg,
    Plan,
    Selection,
    Slot,
    YearPoint,
    YearSeries,
)

import numpy as np


def _constraints(**kwargs) -> Constraints:
    base = dict(equipment=(), max_cycle_years=3, no_till=False, labour_level="medium", livestock_on_farm=False)
    base.update(kwargs)
    return Constraints(**base)


def _request(crops, *, pinned=(), excluded=(), priorities=None, strategy_count=3, economics=None, quota=None, ratings=None, custom=None) -> ForecastRequest:
    field = FieldCfg(
        field_id="field_1", name="North", area_ha=4.0, slope_class="gentle",
        irrigation=IrrigationCfg(available=True, quota_mm_per_season=quota),
        existing_rotation=(
            Slot(1, "summer", "crop_maize"),
            Slot(1, "winter", "fallow"),
            Slot(2, "summer", "crop_soybean"),
            Slot(2, "winter", "fallow"),
        ),
        no_till=False,
    )
    return ForecastRequest(
        selection=Selection(tuple(crops), tuple(pinned), tuple(excluded)),
        constraints=_constraints(equipment=("equip_mower",)),
        horizon_years=6,
        climate_source="history_resample",
        strategy_count=strategy_count,
        priorities=priorities or {},
        fields=(field,),
        economics=economics,
        market_ratings=ratings,
        custom_strategies=custom,
    )


def _plans(req, catalog=None):
    return build_strategies(req, catalog or load_catalog(), None, None, lat=49.25, site_id="site_ubc_farm")


def test_pinned_excluded_family_and_determinism_on_the_real_catalog():
    crops = ["crop_maize", "crop_soybean", "crop_barley", "crop_wheat_winter", "crop_rye_cover"]
    water = _request(crops, pinned=("crop_soybean",), excluded=("crop_barley",), priorities={"weight_preset": "water"})
    soil = _request(crops, pinned=("crop_soybean",), excluded=("crop_barley",), priorities={"weight_preset": "soil_structure"})
    first = _plans(water)
    second = _plans(soil)
    assert [plan.slots for plan in first.plans] == [plan.slots for plan in second.plans]
    again = _plans(water)
    assert [plan.slots for plan in first.plans] == [plan.slots for plan in again.plans]
    assert first.roles[0] == "existing"
    assert len(first.plans) == 3
    for plan in first.plans[1:]:
        ids = {slot.crop_id for slot in plan.slots}
        assert "crop_soybean" in ids
        assert "crop_barley" not in ids
        mains = [slot.crop_id for slot in plan.slots if slot.season != "winter"]
        # Same family does not occupy consecutive main slots, including the cycle wrap, unless it is the perennial case.
        families = []
        catalog = load_catalog()
        by_id = {crop["id"]: crop for crop in catalog["crops"]}
        for year in range(1, plan.cycle_years + 1):
            year_ids = [slot.crop_id for slot in plan.slots if slot.year_index == year and slot.crop_id != "fallow" and not by_id[slot.crop_id].get("cover_crop")]
            if year_ids:
                families.append(by_id[year_ids[0]]["family"])
        for left, right in zip(families, families[1:] + families[:1]):
            assert left != right


def test_uncurated_vegetable_stays_unplaced_while_sourced_pool_generates_alternatives():
    crops = ["crop_cabbage", "crop_tomato", "crop_lettuce", "crop_bean_green", "crop_cucumber"]
    built = _plans(_request(crops))
    assert built.roles == ("existing", "alternative", "alternative")
    assert any("crop_cucumber" in item["message"] for item in built.warnings)
    assert all(slot.crop_id != "crop_cucumber" for plan in built.plans for slot in plan.slots)


def test_custom_strategy_is_expanded_as_entered():
    custom = ((Slot(1, "summer", "crop_barley"), Slot(1, "winter", "fallow")),)
    req = _request(
        ["crop_maize", "crop_soybean", "crop_wheat_winter", "crop_barley"],
        excluded=("crop_barley",),
        strategy_count=2,
        custom=custom,
    )
    built = _plans(req)
    customs = [plan for plan, role in zip(built.plans, built.roles) if role == "custom"]
    assert [plan.strategy_id for plan in customs] == ["rot_custom_1"]
    barley_years = {slot.year_index for slot in customs[0].slots if slot.crop_id == "crop_barley"}
    assert barley_years == {1, 2, 3, 4, 5, 6}
    for plan, role in zip(built.plans, built.roles):
        if role == "alternative":
            assert all(slot.crop_id != "crop_barley" for slot in plan.slots)


def test_grain_forage_and_mixed_pools_each_return_plans():
    grain = _plans(_request(["crop_maize", "crop_soybean", "crop_barley", "crop_wheat_winter"]))
    forage = _plans(_request(["crop_alfalfa", "crop_red_clover", "crop_rye_cover", "crop_maize"]))
    mixed = _plans(_request(["crop_maize", "crop_soybean", "crop_alfalfa", "crop_cabbage", "crop_rye_cover"]))
    assert len(grain.plans) >= 2
    assert len(forage.plans) >= 2
    assert len(mixed.plans) >= 2
    assert grain.plans[0].strategy_id == "rot_existing"


def _series(metric: str, unit: str, basis: str, values: list[float]) -> YearSeries:
    points = [YearPoint(0, values[0], values[0], values[0])]
    for year, value in enumerate(values, 1):
        points.append(YearPoint(year, value, value - 1.0, value + 1.0))
    return YearSeries(metric, unit, basis, "low", True, tuple(points))


class _Sim(dict):
    def __init__(self, irrigation, loss, organic, nitrogen, pest, yield_maize):
        super().__init__({
            "irrigation_need_mm": _series("irrigation_need_mm", "mm/yr", "modeled", irrigation),
            "soil_loss_t_ha_yr": _series("soil_loss_t_ha_yr", "t/ha/yr", "modeled", loss),
            "soil_organic_index": _series("soil_organic_index", "index, year 0 = 100", "relative", organic),
            "n_balance": _series("n_balance", "index, year 0 = 100", "relative", nitrogen),
            "pest_pressure_index": _series("pest_pressure_index", "index 0-100", "assumed", pest),
            "n_fertilizer_need_kg_ha": _series("n_fertilizer_need_kg_ha", "kg N/ha/yr", "assumed", [40, 40]),
            "forage_yield_t_ha": _series("forage_yield_t_ha", "t/ha", "modeled", [0, 0]),
        })
        self.yield_by_crop = {"crop_maize": _series("yield_t_ha:crop_maize", "t/ha", "modeled", yield_maize)}
        self.member_year10 = {
            "irrigation_need_mm": np.array(irrigation[1:], dtype=float),
            "soil_loss_t_ha_yr": np.array(loss[1:], dtype=float),
        }
        self.review_notes = ("Nitrogen rates are assumed.",)


def _fit_plan(crop_ids) -> Plan:
    slots = tuple(Slot(year, "summer", crop_id) for year, crop_id in enumerate(crop_ids, 1))
    return Plan("rot_x", slots, cycle_years=len(slots))


def test_quota_market_income_and_equal_scores():
    catalog = load_catalog()
    plan = _fit_plan(["crop_maize", "crop_alfalfa"])
    wet = _Sim([80, 80], [2, 2], [100, 100], [100, 110], [10, 20], [8, 8])
    req = _request(["crop_maize", "crop_alfalfa"], quota=100, ratings={"crop_maize": 4})
    fit = farm_fit(plan, wet, req, catalog)
    assert fit["water_vs_quota"]["status"] == "within"
    assert fit["market_fit"]["value"] == 4
    assert fit["forage_suitability"]["value"] == 50
    tight = farm_fit(plan, _Sim([90, 90], [2, 2], [100, 100], [100, 100], [0, 0], [8, 8]), req, catalog)
    assert tight["water_vs_quota"]["status"] == "tight"
    over = farm_fit(plan, _Sim([140, 140], [2, 2], [100, 100], [100, 100], [0, 0], [8, 8]), req, catalog)
    assert over["water_vs_quota"]["status"] == "exceeds"
    missing = _request(["crop_maize", "crop_alfalfa"], quota=None)
    assert farm_fit(plan, wet, missing, catalog)["water_vs_quota"]["status"] == "no_quota_given"
    assert farm_fit(plan, wet, missing, catalog)["market_fit"] is None

    none_income, notes = income_estimate(plan, wet, req)
    assert none_income is None and notes
    bushel = _request(
        ["crop_maize", "crop_alfalfa"],
        economics=Economics("CAD", {"crop_maize": CropPrice(200.0, "per bushel")}, InputCosts()),
    )
    bushel_income, bushel_notes = income_estimate(plan, wet, bushel)
    assert bushel_income is None
    assert any("per bushel" in note for note in bushel_notes)
    assert unrated_crops(plan, req) == ["crop_alfalfa"]
    assert "sensitivity run" in rank_stability_note()
    priced = _request(
        ["crop_maize", "crop_alfalfa"],
        economics=Economics(
            "CAD",
            {"crop_maize": CropPrice(200.0, "per tonne")},
            InputCosts(fertilizer_per_kg_n=2.0, seed_per_ha={"crop_maize": 50.0}, irrigation_per_mm_ha=0.1),
        ),
    )
    income, _income_notes = income_estimate(plan, wet, priced)
    assert income is not None
    assert income["unit"] == "CAD/yr"
    assert income["p10"] <= income["value"] <= income["p90"]
    as_number(income)
    flags = review_flags("rot_existing", wet.review_notes, unrated=["crop_alfalfa"], income_missing=False)
    assert flags[0]["severity"] == "verify"
    assert any(flag["trigger"]["rule"] == "unrated_crop" for flag in flags)

    same = scorecards([wet, wet], [fit, fit])
    assert all(row["score"] == 50 for row in same[0])
    saved = fertilizer_saved(wet["n_fertilizer_need_kg_ha"], wet["n_fertilizer_need_kg_ha"])
    assert saved.points[1].p50 == 0


def test_weights_change_rank_and_not_the_score_values_origin():
    low_water = _Sim([20, 20], [8, 8], [100, 100], [100, 100], [10, 10], [6, 6])
    low_erosion = _Sim([80, 80], [1, 1], [100, 130], [100, 100], [10, 10], [6, 6])
    fits = []
    catalog = load_catalog()
    plan = _fit_plan(["crop_maize"])
    req = _request(["crop_maize", "crop_soybean"], quota=200, ratings={"crop_maize": 3})
    for sim in (low_water, low_erosion):
        fits.append(farm_fit(plan, sim, req, catalog))
    cards = scorecards([low_water, low_erosion], fits)
    water_rank = rank_by_priority(["rot_existing", "rot_alt_1"], cards, {"weight_preset": "water"})
    erosion_rank = rank_by_priority(["rot_existing", "rot_alt_1"], cards, {"weight_preset": "erosion"})
    assert water_rank[0] == "rot_existing"
    assert erosion_rank[0] == "rot_alt_1"
    # The same cards were ranked twice. Weights did not rewrite them.
    assert cards[0][4]["criterion"] == "water_use"
    deltas = deltas_vs_existing([low_water, low_erosion], ["rot_existing", "rot_alt_1"])
    assert "rot_alt_1:soil_organic_index" in deltas
    assert deltas["rot_alt_1:soil_organic_index"]["value"] == 30
