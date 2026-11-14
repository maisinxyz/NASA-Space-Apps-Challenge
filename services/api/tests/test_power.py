"""Tests for the NASA POWER weather client."""

from datetime import date
from urllib.error import URLError

import pytest

from app.core.errors import ApiError
from app.weather import power


START = date(2024, 1, 1)
END = date(2024, 1, 2)


def sample_payload():
    return {
        "header": {
            "fill_value": -999.0,
            "sources": ["MERRA2"],
            "time_standard": "LST",
            "start": "20240101",
            "end": "20240102",
        },
        "properties": {
            "parameter": {
                name: {"20240101": 1.5, "20240102": -999.0}
                for name in power.PARAMETERS
            }
        },
        "parameters": {
            name: {"units": "1" if name.startswith("GWET") else "mm/day"}
            for name in power.PARAMETERS
        },
    }


def test_missing_values_become_none():
    result = power._validate(sample_payload())

    for name in power.PARAMETERS:
        assert result["parameters"][name]["20240101"] == 1.5
        assert result["parameters"][name]["20240102"] is None


def test_offline_reads_cache_without_network(tmp_path, monkeypatch):
    import json

    path = tmp_path / "49.250_-123.120_20240101_20240102.json"
    path.write_text(json.dumps(sample_payload()), encoding="utf-8")

    monkeypatch.setenv("OFFLINE", "1")

    def forbidden_network(*args, **kwargs):
        raise AssertionError("Offline mode attempted a network request")

    monkeypatch.setattr(power, "urlopen", forbidden_network)

    result = power.get_daily(49.25, -123.12, START, END, tmp_path)

    assert result["cached"] is True
    assert result["parameters"]["GWETROOT"]["20240102"] is None


def test_offline_cache_miss_returns_503_error(tmp_path, monkeypatch):
    monkeypatch.setenv("OFFLINE", "1")

    with pytest.raises(ApiError) as exc:
        power.get_daily(49.25, -123.12, START, END, tmp_path)

    assert exc.value.code == "WEATHER_UNAVAILABLE"
    assert exc.value.status_code == 503


def test_upstream_failure_uses_cache(tmp_path, monkeypatch):
    import json

    path = tmp_path / "49.250_-123.120_20240101_20240102.json"
    path.write_text(json.dumps(sample_payload()), encoding="utf-8")

    monkeypatch.delenv("OFFLINE", raising=False)

    def failed_network(*args, **kwargs):
        raise URLError("Simulated NASA outage")

    monkeypatch.setattr(power, "urlopen", failed_network)

    result = power.get_daily(49.25, -123.12, START, END, tmp_path)

    assert result["cached"] is True


def test_upstream_failure_without_cache_returns_503(tmp_path, monkeypatch):
    monkeypatch.delenv("OFFLINE", raising=False)

    def failed_network(*args, **kwargs):
        raise URLError("Simulated NASA outage")

    monkeypatch.setattr(power, "urlopen", failed_network)

    with pytest.raises(ApiError) as exc:
        power.get_daily(49.25, -123.12, START, END, tmp_path)

    assert exc.value.code == "WEATHER_UNAVAILABLE"
    assert exc.value.status_code == 503


def test_invalid_date_range(tmp_path):
    with pytest.raises(ValueError):
        power.get_daily(49.25, -123.12, END, START, tmp_path)

@pytest.mark.parametrize("coordinate", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_coordinates_rejected(tmp_path, coordinate):
    with pytest.raises(ValueError, match="Invalid coordinates"):
        power.get_daily(coordinate, -123.12, START, END, tmp_path)

@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_nonfinite_weather_measurements_rejected(value):
    payload = sample_payload()
    payload["properties"]["parameter"]["PRECTOTCORR"]["20240101"] = value

    with pytest.raises(ValueError, match="Invalid weather measurement"):
        power._validate(payload)

def test_cache_write_failure_does_not_discard_live_data(tmp_path, monkeypatch):
    import json
    import io

    monkeypatch.delenv("OFFLINE", raising=False)

    class FakeResponse(io.StringIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.close()

    monkeypatch.setattr(
        power,
        "urlopen",
        lambda *args, **kwargs: FakeResponse(json.dumps(sample_payload())),
    )

    cache_path = tmp_path / "not_a_directory"
    cache_path.write_text("This is a file, not a directory", encoding="utf-8")

    result = power.get_daily(49.25, -123.12, START, END, cache_path)

    assert result["cached"] is False
    assert result["parameters"]["PRECTOTCORR"]["20240101"] == 1.5
