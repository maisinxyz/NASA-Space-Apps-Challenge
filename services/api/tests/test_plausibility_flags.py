from types import SimpleNamespace

from app.twin.explain.flags import plausibility_flags
from app.twin.types import YearPoint


def simulation(loss, pest):
    return {
        "soil_loss_t_ha_yr": SimpleNamespace(points=tuple(YearPoint(year, value) for year, value in enumerate(loss))),
        "pest_pressure_index": SimpleNamespace(points=tuple(YearPoint(year, value) for year, value in enumerate(pest))),
    }


def test_severe_erosion_is_strictly_above_33_and_points_to_first_year():
    flags = plausibility_flags("rot_existing", simulation([0, 33, 33.01, 45], [0, 20, 30, 40]))
    erosion = [f for f in flags if f["trigger"]["rule"] == "ruslefac_severe"]
    assert len(erosion) == 1
    assert "Year 2" in erosion[0]["text"] and "33 t/ha/yr" in erosion[0]["text"]
    assert erosion[0]["trigger"]["layer"] == "soil_loss_t_ha_yr"
    assert not any(f["trigger"]["rule"] == "assumed_index_saturated" for f in flags)


def test_pest_saturation_is_an_assumed_model_ceiling_not_measured():
    flags = plausibility_flags("rot_alt_1", simulation([0, 1, 2], [0, 99, 100]))
    pest = next(f for f in flags if f["trigger"]["rule"] == "assumed_index_saturated")
    assert "Year 2" in pest["text"] and "not a measured pest count" in pest["text"]
    n = next(f for f in flags if f["trigger"]["rule"] == "assumed_nitrogen_index")
    assert "relative" in n["text"] and "not a soil test" in n["text"]
