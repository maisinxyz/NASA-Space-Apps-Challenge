from __future__ import annotations

from app.rotation.config import SITE_PRESETS, field_preset
from app.twin.catalog import load_catalog
from app.twin.generate import _existing, build_strategies
from app.twin.types import Constraints, FieldCfg, ForecastRequest, IrrigationCfg, Selection, Slot


VEGETABLES = (
    "crop_cabbage", "crop_bean_green", "crop_beet", "crop_carrot", "crop_garlic",
    "crop_kale", "crop_lettuce", "crop_onion", "crop_tomato", "crop_zucchini",
)
FIELD_IDS = (
    "d3-brassicas", "d4-goosefoots", "d6-alliums", "d6-nightshades", "d7-cucurbits", "d5-maya",
)


def _field_req(field_id: str, *, existing="preset", selection=VEGETABLES):
    field = FieldCfg(
        field_id=field_id, name=field_id, area_ha=0.5, slope_class="gentle",
        irrigation=IrrigationCfg(available=False), existing_rotation=existing, no_till=False,
    )
    return ForecastRequest(
        selection=Selection(selection),
        constraints=Constraints(equipment=(), max_cycle_years=6, no_till=False, labour_level="high", livestock_on_farm=False),
        horizon_years=6, climate_source="history_resample", fields=(field,),
    )


def test_curated_vegetable_windows_are_sourced_and_only_the_picked_pool_is_filled():
    catalog = {crop["id"]: crop for crop in load_catalog()["crops"]}
    for crop_id in VEGETABLES:
        crop = catalog[crop_id]
        assert crop["season_window"]["plant_doy"] is not None
        assert crop["season_window"]["terminate_doy"] is not None
        source = crop["trait_sources"]["season_window"]
        assert "http" in source
        assert "proxy" in source and "exclusive" in source
    assert catalog["crop_cucumber"]["season_window"] == {"plant_doy": None, "terminate_doy": None}


def test_ubc_per_field_current_rotation_tracks_named_plot_family_and_cover_crop():
    catalog = load_catalog()
    crops = {row["id"]: row for row in catalog["crops"]}
    expected_first = {
        "d3-brassicas": "crop_cabbage",
        "d4-goosefoots": "crop_beet",
        "d6-alliums": "crop_onion",
        "d6-nightshades": "crop_tomato",
        "d7-cucurbits": "crop_zucchini",
        "d5-maya": "crop_bean_green",
    }
    first_crops = set()
    for field_id in FIELD_IDS:
        preset = field_preset("site_ubc_farm", field_id)
        assert preset is not None and preset["name"] == "Current rotation"
        req = _field_req(field_id)
        plan, label = _existing(req, crops, "site_ubc_farm")
        assert label == "Current rotation"
        first_crops.add(plan.slots[0].crop_id)
        assert plan.slots[1].crop_id == "crop_rye_cover"
        assert plan.cycle_years == 6
        assert plan.slots[0].crop_id == expected_first[field_id]
        if field_id == "d6-nightshades":
            assert "crop_garlic" in {slot.crop_id for slot in plan.slots}
    assert len(first_crops) == len(FIELD_IDS)


def test_ubc_sourced_vegetable_pool_generates_existing_and_two_alternatives():
    catalog = load_catalog()
    req = _field_req("d3-brassicas")
    result = build_strategies(req, catalog, None, None, lat=49.25, site_id="site_ubc_farm")
    assert result.roles == ("existing", "alternative", "alternative")
    assert result.labels[0] == "Current rotation"
    assert all(slot.crop_id in VEGETABLES or slot.crop_id in {"crop_rye_cover", "fallow"} for plan in result.plans for slot in plan.slots)


def test_kpu_current_rotation_preserves_ft_ec2_sequence_and_custom_edits_win():
    kpu = SITE_PRESETS["site_kpu_langley"]
    assert kpu["name"] == "Current rotation"
    assert kpu["slots"] == [(1, "crop_cabbage", "crop_rye_cover"), (2, "crop_lettuce", "crop_rye_cover")]
    custom = (Slot(1, "summer", "crop_bean_green"), Slot(1, "winter", "crop_rye_cover"))
    plan, label = _existing(_field_req("d3-brassicas", existing=custom), {row["id"]: row for row in load_catalog()["crops"]}, "site_ubc_farm")
    assert plan.slots == custom
    assert label == "Existing rotation"


def test_forecast_resolves_each_fields_preset_and_keeps_explicit_edits(monkeypatch, tmp_path):
    from app.services import forecast as service

    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setattr(service, "_cache_path", lambda key: tmp_path / key)
    fields = [
        {
            "field_id": field_id,
            "area_ha": 0.5,
            "slope_class": "flat",
            "irrigation": {"available": False},
            "existing_rotation": "preset",
        }
        for field_id in FIELD_IDS
    ]
    doc = service.forecast("site_ubc_farm", {"fields": fields, "selection": {"crops": list(VEGETABLES)}}, members=1)
    for field in doc["fields"]:
        first = field["strategies"][0]
        expected = field_preset("site_ubc_farm", field["field_id"])["slots"][0][1]
        assert first["label"] == "Current rotation"
        assert first["plan"][0]["crop_id"] == expected

    fields[1]["existing_rotation"] = [{"year_index": 1, "season": "spring", "crop_id": "crop_carrot"}]
    edited = service.forecast("site_ubc_farm", {"fields": fields, "selection": {"crops": list(VEGETABLES)}}, members=1)
    assert edited["fields"][1]["strategies"][0]["plan"][0]["crop_id"] == "crop_carrot"
    assert edited["fields"][0]["strategies"][0]["plan"][0]["crop_id"] == "crop_cabbage"
