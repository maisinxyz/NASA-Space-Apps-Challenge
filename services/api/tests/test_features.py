"""Backend A: feature pipeline, hazards, zones, seeds (backend rotation PRD §7, §12.2, §13, §18)."""

import json
import socket
from pathlib import Path

import numpy as np
import pytest

from app.core.errors import ApiError
from app.features import config as C
from app.features import pipeline as P
from app.features import seeds
from app.services import features as F
from fixtures_lib import contract

API = "/api/v1"
FIX = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures"
SITES = sorted(C.CURATED_SITES)


def toy_daily(rain, tmin=None, lat=40.0, start="2001-01-01"):
    n = len(rain)
    days = np.arange(np.datetime64(start, "D"), np.datetime64(start, "D") + np.timedelta64(n, "D"))
    params = {}
    tmin = [5.0] * n if tmin is None else tmin
    cols = {"PRECTOTCORR": rain, "T2M": [t + 5 for t in tmin], "T2M_MAX": [t + 10 for t in tmin], "T2M_MIN": tmin,
            "GWETROOT": [0.5] * n, "GWETTOP": [0.5] * n}
    for k, vals in cols.items():
        params[k] = {str(d).replace("-", ""): v for d, v in zip(days, vals)}
    return P.daily_from_power({"parameters": params}, lat)


# ---------------------------------------------------------------- unit: hand-computed series
def test_weekly_sum_and_missing_week_is_none():
    rain = [1.0] * 365
    rain[10] = None  # day 11 -> week 1
    d = toy_daily(rain)
    years, g = P.weekly(d, d.v["PRECTOTCORR"], "sum")
    assert years == [2001]
    assert g[0, 0] == 7.0
    assert np.isnan(g[0, 1])  # never filled
    assert g[0, 51] == 8.0  # days 358-365 fold into week 51


def test_in_runs():
    m = np.array([1, 1, 0, 1, 1, 1, 0, 1], bool)
    assert P.in_runs(m, 3).tolist() == [0, 0, 0, 1, 1, 1, 0, 0]


def test_extraterrestrial_radiation_matches_fao56_example():
    # FAO-56 Example 8: 20 degS, 3 September (J = 246) -> Ra = 32.2 MJ m-2 day-1
    assert P.extraterrestrial_radiation(-20.0, np.array([246]))[0] == pytest.approx(32.2, abs=0.1)


def test_hargreaves_hand_value():
    d = toy_daily([0.0] * 365)
    ra = P.extraterrestrial_radiation(40.0, d.doy)
    expected = 0.0023 * 0.408 * ra * (10 + 17.8) * np.sqrt(10)
    assert np.allclose(P.et0_hargreaves(d), expected)


def test_anomaly_zero_when_std_zero():
    base = np.ones((3, 52))
    assert (P.anomaly(base, base) == 0).all()


def test_scenario_range_and_preset_equivalence():
    with pytest.raises(ApiError) as e:
        P.resolve_scenario(rain_scale_pct=80)
    assert e.value.code == "SCENARIO_OUT_OF_RANGE"
    with pytest.raises(ApiError):
        P.resolve_scenario(temp_offset_c=9)
    preset = P.resolve_scenario("drier_summers")
    custom = P.resolve_scenario("drier_summers", **{k: C.SCENARIO_PRESETS["drier_summers"][k] for k in ("rain_scale_pct", "temp_offset_c", "rain_scale_by_season")})
    assert preset == custom


def test_season_months_flip_south():
    assert P.season_months("winter", 40) == (12, 1, 2)
    assert P.season_months("winter", -33) == (6, 7, 8)


def test_vulnerable_weeks():
    ft = json.loads((FIX / "features" / "site_usda_barc.json").read_text())
    out = P.vulnerable_weeks(ft, range(52))
    frost = next(x for x in out if x["hazards"] == ["frost_prob"])
    assert 0 in frost["weeks"] and 28 not in frost["weeks"]  # January frosty, late July not


# ---------------------------------------------------------------- routes + contract
@pytest.mark.parametrize("site", SITES)
def test_feature_table_matches_contract(client, site):
    r = client.get(f"{API}/sites/{site}/features")
    assert r.status_code == 200, r.text
    body = r.json()
    contract.validate_response(body, "/sites/{siteId}/features")
    contract.validate_schema(body, "FeatureTable")
    assert body["data_mode"] == "seed"
    assert body["quality"]["years_available"] >= 30
    # A curated point can have a real SoilGrids response whose means are all null
    # (site_kpu_langley, 2026-11-15). That is limited_data, not a missing seed.
    if body["soil"] is None:
        assert body["quality"]["limited_data"] is True
    else:
        assert body["quality"]["limited_data"] is False and body["soil"]["texture_class"]
    satellite_ids = {"ndvi", "ndvi_anomaly", "smap_anomaly"}
    for fid, f in body["features"].items():
        assert f["unit"] and f["basis"] in ("measured", "derived", "modeled", "assumed", "relative")
        if fid not in satellite_ids:
            assert len(f["by_year"]) == body["quality"]["years_available"]
    assert all(s["license"] and s["attribution"] for s in body["sources"])


@pytest.mark.parametrize("url,template", [
    ("/sites/site_usda_barc/hazard-calendar", "/sites/{siteId}/hazard-calendar"),
    ("/sites/site_ucdavis_oakville/hazard-calendar?scenario=both", "/sites/{siteId}/hazard-calendar"),
    ("/sites/site_cornell_ruminant/hazards", "/sites/{siteId}/hazards"),
    ("/sites/site_usda_barc/zones", "/sites/{siteId}/zones"),
    ("/sites/site_ubc_farm/zones", "/sites/{siteId}/zones"),
    ("/sites/site_usda_barc/features?scenario=drier_summers", "/sites/{siteId}/features"),
])
def test_v11_routes_match_contract(client, url, template):
    r = client.get(API + url)
    assert r.status_code == 200, r.text
    contract.validate_response(r.json(), template)


def test_route_equals_committed_fixture_and_is_deterministic(client):
    a = client.get(f"{API}/sites/site_usda_barc/features").content
    b = client.get(f"{API}/sites/site_usda_barc/features").content
    assert a == b
    body = json.loads(a)
    if seeds.load_ndvi("site_usda_barc") is None and seeds.load_smap("site_usda_barc") is None:
        assert body == json.loads((FIX / "features" / "site_usda_barc.json").read_text())
    else:
        contract.validate_schema(body, "FeatureTable")
        if seeds.load_ndvi("site_usda_barc") is not None:
            assert "ndvi" in body["features"] and "ndvi_anomaly" in body["features"]
        if seeds.load_smap("site_usda_barc") is not None:
            assert "smap_anomaly" in body["features"] and body["quality"]["sources_agree"] in (True, False, None)


def test_scenario_moves_features_the_right_way():
    base = F.feature_table("site_ucdavis_oakville")
    dry = F.feature_table("site_ucdavis_oakville", P.resolve_scenario("drier_summers"))
    assert dry["scenario"]["label"] == "modeled scenario, not a forecast"
    jul = 28
    assert dry["features"]["rain_mm"]["mean"][jul] <= base["features"]["rain_mm"]["mean"][jul]
    assert dry["features"]["et0_mm"]["mean"][jul] > base["features"]["et0_mm"]["mean"][jul]
    assert dry["features"]["rain_mm"]["mean"][2] == base["features"]["rain_mm"]["mean"][2]  # January untouched
    assert dry["thresholds"] == base["thresholds"]  # thresholds stay on the baseline


def test_unknown_site_and_bad_scenario(client):
    r = client.get(f"{API}/sites/site_nowhere/features")
    assert r.status_code == 404 and r.json()["error"]["code"] == "SITE_NOT_FOUND"
    assert client.get(f"{API}/sites/site_usda_barc/features?scenario=apocalypse").status_code == 422


def test_limited_data_fixture_has_no_satellite_values():
    ft = json.loads((FIX / "features" / "site_explore_pirque.json").read_text())
    assert ft["quality"]["limited_data"] is True and ft["soil"] is None
    assert not {"ndvi", "ndvi_anomaly", "smap_anomaly"} & set(ft["features"])
    assert [s["role"] for s in ft["sources"]] == ["weather"]


def test_no_prediction_words_in_payloads(client):
    for url in ("/sites/site_usda_barc/features", "/sites/site_usda_barc/hazards", "/sites/site_kpu_langley/zones"):
        text = client.get(API + url).text.lower()
        assert "yield" not in text and "profit" not in text


def test_mock_mode_only_for_mock_terrain(client):
    # KPU is curated. Zones stay on the seed path even though sites.json still
    # labels the same id "(mock)" and points it at terr_mock_hills.
    body = client.get(f"{API}/sites/site_kpu_langley/zones").json()
    assert body["data_mode"] == "seed"
    assert body["terrain_id"] is None
    for s in SITES:
        assert client.get(f"{API}/sites/{s}/features").json()["data_mode"] != "mock"


# ---------------------------------------------------------------- offline (PRD §13)
@pytest.fixture()
def no_network(monkeypatch):
    def refuse(*a, **k):
        raise AssertionError("network call in OFFLINE mode")

    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setattr(socket.socket, "connect", refuse)
    F.base.cache_clear()
    F._computed.cache_clear()
    F._table.cache_clear()
    yield
    F.base.cache_clear()
    F._computed.cache_clear()
    F._table.cache_clear()


def test_offline_curated_sites_work_without_network(client, no_network):
    for s in SITES:
        assert client.get(f"{API}/sites/{s}/hazard-calendar").status_code == 200


def test_offline_cache_miss_is_weather_unavailable(client, no_network, monkeypatch, tmp_path):
    from app.weather import power

    monkeypatch.setattr(power, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(F.site_svc, "list_sites", lambda: [{"id": "site_lite_x", "name": "x", "location": [10.0, 50.0]}])
    r = client.get(f"{API}/sites/site_lite_x/features")
    assert r.status_code == 503 and r.json()["error"]["code"] == "WEATHER_UNAVAILABLE"


# ---------------------------------------------------------------- seeds (PRD §6, §18 Data)
def test_every_seed_file_has_complete_sidecar():
    assert seeds.seed_files(), "no seed files"
    assert seeds.sidecar_problems() == []


def test_usda_texture():
    assert seeds.usda_texture(40, 40, 20) == "loam"
    assert seeds.usda_texture(90, 5, 5) == "sand"
    assert seeds.usda_texture(10, 30, 60) == "clay"
    assert seeds.usda_texture(50, 10, 38) == "sandy clay"


def _flat_year(year: int, value: float, holes: set[int] | None = None) -> dict:
    holes = holes or set()
    values = [None if week in holes else value for week in range(52)]
    return {"year": year, "values": values, "n_obs": [0 if week in holes else 3 for week in range(52)]}


def test_weekly_seed_grid_keeps_nulls_and_rejects_a_short_row():
    years, grid = P.weekly_seed_grid({
        "weekly": [
            _flat_year(2019, 0.4, holes={2}),
            {"year": 2020, "values": [1.0], "n_obs": [1]},
        ],
    })
    assert years == [2019]
    assert np.isnan(grid[0, 2]) and grid[0, 0] == 0.4


def test_sign_agreement_is_the_share_of_matching_signs():
    left = np.array([[1.0, -1.0, 0.0, np.nan]])
    right = np.array([[1.0, 1.0, -1.0, 1.0]])
    assert P.sign_agreement(left, [2018], right, [2018]) == 0.5
    assert P.sign_agreement(left, [2018], right, [2019]) is None


def test_satellite_features_present_absent_and_coarse(monkeypatch):
    """Synthetic weekly docs. Nothing is written under data/seed."""
    from dataclasses import replace

    site = "site_usda_barc"
    b = F.base(site)
    c = F.computed(site, P.resolve_scenario())
    plain = F.build_table(site, b, c)
    assert "ndvi" not in plain["features"] and plain["quality"]["sources_agree"] is None

    y0, y1 = int(c.years[0]), int(c.years[1])
    ndvi = {
        "site_id": site, "layer": "ndvi", "variable": "NDVI", "unit": "1", "basis": "measured",
        "native_resolution_m": 30, "weekly": [_flat_year(2018, 0.2), _flat_year(2019, 0.6)],
    }
    smap = {
        "site_id": site, "layer": "smap", "variable": "sm_rootzone", "unit": "m3/m3", "basis": "modeled",
        "native_resolution_m": 9000,
        "weekly": [_flat_year(y0, 0.1), _flat_year(y1, 0.4)],
    }
    anom = np.array(c.grids["soil_moisture_anomaly"], copy=True)
    anom[0, :] = -1.0
    anom[1, :] = 1.0
    grids = dict(c.grids)
    grids["soil_moisture_anomaly"] = anom
    aligned = replace(c, grids=grids)
    monkeypatch.setattr(seeds, "load_ndvi", lambda _site: ndvi)
    monkeypatch.setattr(seeds, "load_smap", lambda _site: smap)
    monkeypatch.setattr(seeds, "load_ecostress", lambda _site: None)
    rich = F.build_table(site, b, aligned)
    assert {"ndvi", "ndvi_anomaly", "smap_anomaly"} <= set(rich["features"])
    assert "smap" not in rich["features"]
    assert rich["features"]["ndvi"]["unit"] == "1" and rich["features"]["ndvi"]["basis"] == "measured"
    assert rich["features"]["ndvi_anomaly"]["unit"] == "sigma" and rich["features"]["ndvi_anomaly"]["basis"] == "derived"
    assert rich["features"]["ndvi_anomaly"]["by_year"]["2018"][0] < 0
    assert rich["features"]["ndvi_anomaly"]["by_year"]["2019"][0] > 0
    assert rich["features"]["smap_anomaly"]["basis"] == "derived"
    assert rich["quality"]["sources_agree"] is True
    assert rich["quality"]["limited_data"] is False
    contract.validate_schema(rich, "FeatureTable")
    # A 9 km pixel is a source row only when the sidecar stores a licence. This fixture has none.
    assert all(row["role"] != "soil_moisture" for row in rich["sources"])
    anom[0, :] = 1.0
    disagree = F.build_table(site, b, aligned)
    assert disagree["quality"]["sources_agree"] is False


def test_feature_schema_file_is_current():
    import sys

    sys.path.insert(0, str(FIX.parents[2] / "scripts"))
    from build_seed import bundled_schema

    on_disk = json.loads((FIX.parent / "schemas" / "feature_table.schema.json").read_text(encoding="utf-8"))
    assert on_disk == bundled_schema("FeatureTable"), "run `make seed`"
