"""Curated sites. Fixture-backed (BE-11 replaces with seed data)."""

from app.core.errors import not_found
from app.providers.fixtures import store


def list_sites() -> list[dict]:
    return store().json("sites.json")


def get_site(site_id: str) -> dict:
    for site in list_sites():
        if site["id"] == site_id:
            return site
    raise not_found("site", site_id)
