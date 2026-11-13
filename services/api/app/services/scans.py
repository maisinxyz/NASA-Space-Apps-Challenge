"""Land Scan jobs. Fixture-backed (BE-03 replaces this with the real pipeline)."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.core.errors import ApiError, not_found
from app.providers.fixtures import MOCK_FAIL_SCAN_ID, MOCK_SCAN_ID, store

MAX_IMAGES = 6
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

_STATUS = {MOCK_SCAN_ID: "scans/scan_status.json", MOCK_FAIL_SCAN_ID: "scans/scan_status_failed.json"}
_EVENTS = {MOCK_SCAN_ID: "scans/sse_success.txt", MOCK_FAIL_SCAN_ID: "scans/sse_fail_coverage.txt"}


def parse_bbox(bbox: str | None) -> list[float] | None:
    if bbox is None or bbox == "":
        return None
    try:
        vals = [float(v) for v in bbox.split(",")]
    except ValueError:
        vals = []
    if len(vals) != 4 or not (vals[0] < vals[2] and vals[1] < vals[3]):
        raise ApiError("INVALID_INPUT", "bbox must be minLon,minLat,maxLon,maxLat.", "Redraw the rectangle on the map.")
    return vals


def create_scan(lat: float, lon: float, bbox: str | None, image_types: list[str | None]) -> dict:
    if len(image_types) > MAX_IMAGES:
        raise ApiError("INVALID_INPUT", f"At most {MAX_IMAGES} images.", "Remove some photos.")
    for ct in image_types:
        if ct not in ALLOWED_TYPES:
            raise ApiError("UNSUPPORTED_FILE", "Only JPG, PNG and WEBP images are supported.", "Upload a photo in one of those formats.")
    parse_bbox(bbox)
    # Mock: every scan becomes the successful fixture scan.
    return store().json("scans/scan_created.json")


def get_scan(scan_id: str) -> dict:
    if scan_id not in _STATUS:
        raise not_found("scan", scan_id)
    return store().json(_STATUS[scan_id])


async def scan_events(scan_id: str, delay_s: float) -> AsyncIterator[str]:
    if scan_id not in _EVENTS:
        raise not_found("scan", scan_id)
    blocks = [b for b in store().text(_EVENTS[scan_id]).split("\n\n") if b.strip()]

    async def gen():
        for i, block in enumerate(blocks):
            if i and delay_s:
                await asyncio.sleep(delay_s)
            yield block + "\n\n"

    return gen()
