"""Curated climate outlooks do not open a socket."""

import socket

from app.twin.climate import build_climate_outlook

SITES = ("site_usda_barc", "site_cornell_ruminant", "site_ucdavis_oakville", "site_ubc_farm")


def test_climate_outlook_offline_for_four_sites(monkeypatch):
    def _refuse(*_args, **_kwargs):
        raise AssertionError("climate outlook tried to open a socket")

    monkeypatch.setattr(socket.socket, "connect", _refuse)
    for site_id in SITES:
        doc = build_climate_outlook(site_id, "baseline")
        assert doc["site_id"] == site_id
        assert doc["data_mode"] == "limited_data"
        assert doc["sources"][0]["name"]
