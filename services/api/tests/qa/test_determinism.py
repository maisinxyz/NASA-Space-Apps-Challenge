"""Two builds of the same outlook are the same JSON. The cache is not the thing under test."""

from app.twin.climate import build_climate_outlook
from tests.qa.checks import canonical_json

SITES = ("site_usda_barc", "site_cornell_ruminant", "site_ucdavis_oakville", "site_ubc_farm")


def test_climate_outlook_is_byte_identical_across_builds():
    for site_id in SITES:
        for scenario in ("baseline", "both"):
            first = build_climate_outlook(site_id, scenario)
            second = build_climate_outlook(site_id, scenario)
            assert canonical_json(first) == canonical_json(second)
